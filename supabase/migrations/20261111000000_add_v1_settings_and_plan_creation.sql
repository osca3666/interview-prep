begin;

create or replace function private.v1_stable_hash(p_value text)
returns bigint
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_hash bigint := 2166136261;
  v_bytes bytea := pg_catalog.convert_to(p_value, 'UTF8');
  v_index integer;
begin
  for v_index in 0..pg_catalog.length(v_bytes) - 1 loop
    v_hash := ((v_hash # pg_catalog.get_byte(v_bytes, v_index)) * 16777619) % 4294967296;
  end loop;
  return v_hash;
end;
$$;

revoke all on function private.v1_stable_hash(text) from public, anon, authenticated;

create or replace function public.save_study_plan_settings(
  p_daily_new_target integer,
  p_daily_review_target integer,
  p_followed_roadmap_id text,
  p_new_selection_mode text,
  p_review_source text,
  p_review_roadmap_ids text[],
  p_apply_when text,
  p_time_zone text
)
returns public.study_plan_setting_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_time_zone text;
  v_today date;
  v_effective_date date;
  v_review_roadmap_ids text[];
  v_fingerprint text;
  v_context public.review_allocation_contexts%rowtype;
  v_revision public.study_plan_setting_revisions%rowtype;
  v_version integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_daily_new_target is null or p_daily_new_target not between 0 and 10
    or p_daily_review_target is null or p_daily_review_target not between 0 and 20
    or p_new_selection_mode not in ('sequential', 'shuffled')
    or p_review_source not in ('all', 'selected_roadmaps')
    or p_apply_when not in ('today', 'tomorrow') then
    raise exception 'invalid_settings' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-study-plan:' || v_user_id::text, 0)
  );

  select preferences.time_zone into v_time_zone
  from public.user_study_preferences preferences
  where preferences.user_id = v_user_id;
  if not found then
    v_time_zone := pg_catalog.btrim(p_time_zone);
    if v_time_zone is null or v_time_zone = '' or not exists (
      select 1 from pg_catalog.pg_timezone_names where name = v_time_zone
    ) then
      raise exception 'invalid_time_zone' using errcode = 'P0001';
    end if;
    insert into public.user_study_preferences(user_id, time_zone)
    values (v_user_id, v_time_zone);
  end if;

  v_today := (pg_catalog.clock_timestamp() at time zone v_time_zone)::date;
  v_effective_date := v_today + case when p_apply_when = 'tomorrow' then 1 else 0 end;

  if p_followed_roadmap_id is not null and not exists (
    select 1 from public.study_roadmaps where id = p_followed_roadmap_id
  ) then
    raise exception 'invalid_roadmap' using errcode = 'P0001';
  end if;

  select coalesce(pg_catalog.array_agg(roadmap_id order by roadmap_id), '{}'::text[])
  into v_review_roadmap_ids
  from (
    select distinct pg_catalog.btrim(value) as roadmap_id
    from pg_catalog.unnest(coalesce(p_review_roadmap_ids, '{}'::text[])) value
    where pg_catalog.btrim(value) <> ''
  ) selected;

  if (p_review_source = 'all' and pg_catalog.cardinality(v_review_roadmap_ids) <> 0)
    or (p_review_source = 'selected_roadmaps' and pg_catalog.cardinality(v_review_roadmap_ids) = 0)
    or exists (
      select 1 from pg_catalog.unnest(v_review_roadmap_ids) roadmap_id
      where not exists (select 1 from public.study_roadmaps where id = roadmap_id)
    ) then
    raise exception 'invalid_review_source' using errcode = 'P0001';
  end if;

  if p_apply_when = 'today' and exists (
    select 1 from public.daily_study_plans
    where user_id = v_user_id and study_date = v_today and selection_version = 'v1-policy'
  ) then
    raise exception 'apply_today_requires_reconciliation' using errcode = 'P0001';
  end if;

  v_fingerprint := p_review_source || ':' || pg_catalog.array_to_string(v_review_roadmap_ids, ',');
  insert into public.review_allocation_contexts(user_id, review_source, filter_fingerprint)
  values (v_user_id, p_review_source, v_fingerprint)
  on conflict (user_id, filter_fingerprint) do update
    set filter_fingerprint = excluded.filter_fingerprint
  returning * into v_context;

  insert into public.review_allocation_context_roadmaps(context_id, user_id, roadmap_id)
  select v_context.id, v_user_id, roadmap_id
  from pg_catalog.unnest(v_review_roadmap_ids) roadmap_id
  on conflict do nothing;

  select coalesce(pg_catalog.max(version), 0) + 1 into v_version
  from public.study_plan_setting_revisions
  where user_id = v_user_id;

  insert into public.study_plan_setting_revisions(
    user_id, version, effective_study_date, daily_new_target,
    daily_review_target, followed_roadmap_id, new_selection_mode,
    review_allocation_context_id
  ) values (
    v_user_id, v_version, v_effective_date, p_daily_new_target,
    p_daily_review_target, p_followed_roadmap_id, p_new_selection_mode,
    v_context.id
  ) returning * into v_revision;

  return v_revision;
end;
$$;

revoke execute on function public.save_study_plan_settings(
  integer, integer, text, text, text, text[], text, text
) from public, anon;
grant execute on function public.save_study_plan_settings(
  integer, integer, text, text, text, text[], text, text
) to authenticated;

create or replace function public.get_effective_study_plan_settings(p_reference_time timestamptz default now())
returns table (
  revision_id uuid,
  version integer,
  effective_study_date date,
  daily_new_target integer,
  daily_review_target integer,
  followed_roadmap_id text,
  new_selection_mode text,
  review_allocation_context_id uuid,
  review_source text,
  review_roadmap_ids text[],
  time_zone text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_time_zone text;
  v_study_date date;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_reference_time is null then
    raise exception 'invalid_submission' using errcode = 'P0001';
  end if;
  select preferences.time_zone into v_time_zone
  from public.user_study_preferences preferences where preferences.user_id = v_user_id;
  if not found then return; end if;
  v_study_date := (p_reference_time at time zone v_time_zone)::date;

  return query
  select revision.id, revision.version, revision.effective_study_date,
    revision.daily_new_target, revision.daily_review_target,
    revision.followed_roadmap_id, revision.new_selection_mode,
    revision.review_allocation_context_id, context.review_source,
    coalesce((
      select pg_catalog.array_agg(link.roadmap_id order by link.roadmap_id)
      from public.review_allocation_context_roadmaps link
      where link.context_id = context.id and link.user_id = v_user_id
    ), '{}'::text[]), v_time_zone
  from public.study_plan_setting_revisions revision
  join public.review_allocation_contexts context
    on context.id = revision.review_allocation_context_id and context.user_id = revision.user_id
  where revision.user_id = v_user_id
    and revision.effective_study_date <= v_study_date
  order by revision.effective_study_date desc, revision.version desc
  limit 1;
end;
$$;

revoke execute on function public.get_effective_study_plan_settings(timestamptz) from public, anon;
grant execute on function public.get_effective_study_plan_settings(timestamptz) to authenticated;

create or replace function public.create_v1_daily_study_plan(
  p_time_zone text,
  p_reference_time timestamptz,
  p_settings_revision_id uuid,
  p_tasks jsonb
)
returns public.daily_study_plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_time_zone text;
  v_now timestamptz;
  v_study_date date;
  v_day_starts_at timestamptz;
  v_day_ends_at timestamptz;
  v_plan public.daily_study_plans%rowtype;
  v_revision public.study_plan_setting_revisions%rowtype;
  v_context public.review_allocation_contexts%rowtype;
  v_review_roadmaps text[];
  v_task jsonb;
  v_problem public.user_problems%rowtype;
  v_position integer := 0;
  v_review_count integer := 0;
  v_new_count integer := 0;
  v_practiced_review_count integer := 0;
  v_practiced_new_count integer := 0;
  v_remaining_reviews integer;
  v_remaining_new integer;
  v_pool text;
  v_expected_pool text;
  v_imported_size integer;
  v_established_size integer;
  v_imported_weight integer;
  v_established_weight integer;
  v_imported_deficit bigint;
  v_established_deficit bigint;
  v_expected_id uuid;
  v_established_selected integer := 0;
  v_source_roadmap text;
  v_expected_slug text;
  v_expected_problem_id uuid;
  v_seed text;
  v_task_id uuid;
  v_allocation_key text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-study-plan:' || v_user_id::text, 0)
  );
  v_now := pg_catalog.clock_timestamp();

  select preferences.time_zone into v_time_zone
  from public.user_study_preferences preferences where preferences.user_id = v_user_id;
  if not found then
    v_time_zone := pg_catalog.btrim(p_time_zone);
    if v_time_zone is null or v_time_zone = '' or not exists (
      select 1 from pg_catalog.pg_timezone_names where name = v_time_zone
    ) then raise exception 'invalid_time_zone' using errcode = 'P0001'; end if;
    insert into public.user_study_preferences(user_id, time_zone) values (v_user_id, v_time_zone);
  end if;

  v_study_date := (v_now at time zone v_time_zone)::date;
  v_day_starts_at := v_study_date::timestamp at time zone v_time_zone;
  v_day_ends_at := (v_study_date + 1)::timestamp at time zone v_time_zone;
  select * into v_plan from public.daily_study_plans
  where user_id = v_user_id and study_date = v_study_date;
  if found then return v_plan; end if;

  if p_reference_time is null or (p_reference_time at time zone v_time_zone)::date <> v_study_date
    or p_reference_time > v_now + interval '30 seconds' or p_tasks is null
    or pg_catalog.jsonb_typeof(p_tasks) <> 'array' then
    raise exception 'stale_recommendations' using errcode = 'P0001';
  end if;

  select revision.* into v_revision
  from public.study_plan_setting_revisions revision
  where revision.id = p_settings_revision_id and revision.user_id = v_user_id
    and revision.effective_study_date <= v_study_date
    and not exists (
      select 1 from public.study_plan_setting_revisions newer
      where newer.user_id = revision.user_id and newer.effective_study_date <= v_study_date
        and (newer.effective_study_date, newer.version) > (revision.effective_study_date, revision.version)
    );
  if not found then raise exception 'stale_settings' using errcode = 'P0001'; end if;

  select * into v_context from public.review_allocation_contexts
  where id = v_revision.review_allocation_context_id and user_id = v_user_id;
  select coalesce(pg_catalog.array_agg(roadmap_id order by roadmap_id), '{}'::text[])
    into v_review_roadmaps
  from public.review_allocation_context_roadmaps
  where context_id = v_context.id and user_id = v_user_id;

  select count(*) filter (where pre_practice_problem_type = 'review'),
    count(*) filter (where pre_practice_problem_type = 'new')
  into v_practiced_review_count, v_practiced_new_count
  from public.review_events
  where user_id = v_user_id and reviewed_at >= v_day_starts_at and reviewed_at < v_day_ends_at;
  v_remaining_reviews := greatest(0, v_revision.daily_review_target - v_practiced_review_count);
  v_remaining_new := greatest(0, v_revision.daily_new_target - v_practiced_new_count);
  if pg_catalog.jsonb_array_length(p_tasks) > v_remaining_reviews + v_remaining_new then
    raise exception 'invalid_submission' using errcode = 'P0001';
  end if;

  v_source_roadmap := coalesce(v_revision.followed_roadmap_id, 'neetcode-150');
  v_seed := v_user_id::text || ':' || v_study_date::text || ':' || v_revision.version::text;

  insert into public.daily_study_plans(
    user_id, study_date, time_zone, day_starts_at, day_ends_at, roadmap_id,
    selection_version, reference_time, review_target, new_problem_target,
    planned_task_count, settings_revision_id, settings_version_snapshot,
    followed_roadmap_id_snapshot, new_selection_mode_snapshot,
    review_source_snapshot, review_roadmap_ids_snapshot, shuffle_seed,
    review_shortage_count, new_problem_shortage_count
  ) values (
    v_user_id, v_study_date, v_time_zone, v_day_starts_at, v_day_ends_at,
    v_source_roadmap, 'v1-policy', p_reference_time,
    v_revision.daily_review_target, v_revision.daily_new_target,
    pg_catalog.jsonb_array_length(p_tasks), v_revision.id, v_revision.version,
    v_revision.followed_roadmap_id, v_revision.new_selection_mode,
    v_context.review_source, v_review_roadmaps, v_seed, 0, 0
  ) returning * into v_plan;

  for v_task in select value from pg_catalog.jsonb_array_elements(p_tasks) loop
    if pg_catalog.jsonb_typeof(v_task) <> 'object' then
      raise exception 'invalid_submission' using errcode = 'P0001';
    end if;

    if v_task->>'kind' in ('review', 'calibration') then
      v_review_count := v_review_count + 1;
      if v_review_count > v_remaining_reviews then
        raise exception 'invalid_submission' using errcode = 'P0001';
      end if;
      select * into v_problem from public.user_problems
      where id = (v_task->>'user_problem_id')::uuid and user_id = v_user_id
      for update;
      if not found or v_problem.lifecycle_state <> 'active'
        or v_problem.schedule_version <> (v_task->>'schedule_version')::bigint then
        raise exception 'stale_recommendations' using errcode = 'P0001';
      end if;
      v_pool := case
        when v_problem.total_reviews > 0 then 'established'
        when v_problem.source = 'leetcode_import' and v_problem.external_practice_status = 'accepted' then 'imported'
        else null
      end;
      if v_pool is null or v_pool is distinct from v_task->>'review_pool'
        or (v_pool = 'imported' and v_task->>'kind' <> 'calibration')
        or (v_pool = 'established' and v_task->>'kind' <> 'review')
        or (v_context.review_source = 'selected_roadmaps' and not exists (
          select 1 from public.study_roadmap_problems member
          where member.leetcode_slug = v_problem.leetcode_slug
            and member.roadmap_id = any(v_review_roadmaps)
        ))
        or (v_pool = 'imported' and v_problem.external_activity_date is not null
          and v_study_date < v_problem.external_activity_date + 3)
        or (v_pool = 'established' and not (
          v_problem.next_review_at <= p_reference_time
          or (v_problem.last_reviewed_at is not null
            and v_problem.last_reviewed_at <= p_reference_time - interval '48 hours')
        )) then
        raise exception 'stale_recommendations' using errcode = 'P0001';
      end if;

      -- The TypeScript engine chooses ordering. PostgreSQL revalidates the
      -- candidate state, source, pool, weights, and fairness choice atomically.
      select count(*) filter (where pool = 'imported'), count(*) filter (where pool = 'established')
      into v_imported_size, v_established_size
      from (
        select case when p.total_reviews > 0 then 'established' else 'imported' end as pool
        from public.user_problems p
        where p.user_id = v_user_id and p.lifecycle_state = 'active'
          and ((p.total_reviews > 0 and (
            p.next_review_at <= p_reference_time
            or (p.last_reviewed_at is not null and p.last_reviewed_at <= p_reference_time - interval '48 hours')
          )) or (p.total_reviews = 0 and p.source = 'leetcode_import'
            and p.external_practice_status = 'accepted'
            and (p.external_activity_date is null or v_study_date >= p.external_activity_date + 3)))
          and (v_context.review_source = 'all' or exists (
            select 1 from public.study_roadmap_problems member
            where member.leetcode_slug = p.leetcode_slug and member.roadmap_id = any(v_review_roadmaps)
          ))
          and not exists (
            select 1 from public.daily_study_plan_tasks chosen
            where chosen.plan_id = v_plan.id and chosen.user_problem_id = p.id
          )
      ) eligible;
      if v_imported_size = 0 then
        v_imported_weight := 0; v_established_weight := 1;
      elsif v_established_size = 0 then
        v_imported_weight := 1; v_established_weight := 0;
      elsif v_imported_size = v_established_size then
        v_imported_weight := 1; v_established_weight := 1;
      elsif v_imported_size > v_established_size then
        v_imported_weight := 3; v_established_weight := 2;
      else
        v_imported_weight := 2; v_established_weight := 3;
      end if;
      select coalesce(sum(imported_weight - case when pool = 'imported' then imported_weight + established_weight else 0 end), 0),
        coalesce(sum(established_weight - case when pool = 'established' then imported_weight + established_weight else 0 end), 0)
      into v_imported_deficit, v_established_deficit
      from public.review_allocation_entries
      where context_id = v_context.id and user_id = v_user_id and active;
      v_expected_pool := case
        when v_imported_size = 0 then 'established'
        when v_established_size = 0 then 'imported'
        when v_imported_deficit + v_imported_weight >= v_established_deficit + v_established_weight then 'imported'
        else 'established'
      end;
      if v_pool <> v_expected_pool
        or (v_task->>'imported_weight')::integer <> v_imported_weight
        or (v_task->>'established_weight')::integer <> v_established_weight then
        raise exception 'stale_allocation' using errcode = 'P0001';
      end if;

      select candidate.id into v_expected_id
      from public.user_problems candidate
      where candidate.user_id = v_user_id and candidate.lifecycle_state = 'active'
        and ((v_expected_pool = 'imported' and candidate.total_reviews = 0
          and candidate.source = 'leetcode_import'
          and candidate.external_practice_status = 'accepted'
          and (candidate.external_activity_date is null
            or v_study_date >= candidate.external_activity_date + 3))
        or (v_expected_pool = 'established' and candidate.total_reviews > 0
          and (candidate.next_review_at <= p_reference_time
            or (candidate.last_reviewed_at is not null
              and candidate.last_reviewed_at <= p_reference_time - interval '48 hours'))))
        and (v_context.review_source = 'all' or exists (
          select 1 from public.study_roadmap_problems member
          where member.leetcode_slug = candidate.leetcode_slug
            and member.roadmap_id = any(v_review_roadmaps)
        ))
        and not exists (
          select 1 from public.daily_study_plan_tasks chosen
          where chosen.plan_id = v_plan.id and chosen.user_problem_id = candidate.id
        )
      order by
        case when v_expected_pool = 'imported'
          then case when candidate.external_activity_date is null then 1 else 0 end end,
        case when v_expected_pool = 'imported' then candidate.external_activity_date end,
        case when v_expected_pool = 'established'
          then case when candidate.next_review_at <= p_reference_time then 0 else 1 end end,
        case when v_expected_pool = 'established' and v_established_selected = 0
          and candidate.next_review_at <= p_reference_time then candidate.next_review_at end,
        case when v_expected_pool = 'established' and v_established_selected > 0
          and candidate.next_review_at <= p_reference_time then -(
            extract(epoch from (p_reference_time - candidate.next_review_at)) / 86400
            + (10 - candidate.mastery_score)
          ) end,
        case when v_expected_pool = 'established' then candidate.next_review_at end,
        case when v_expected_pool = 'established' and v_established_selected > 0
          and candidate.next_review_at <= p_reference_time then candidate.mastery_score end,
        candidate.id
      limit 1;
      if v_expected_id is distinct from v_problem.id then
        raise exception 'stale_recommendations' using errcode = 'P0001';
      end if;

      v_allocation_key := 'v1:' || v_study_date::text || ':review:' || v_position::text;
      if v_task->>'allocation_key' is distinct from v_allocation_key then
        raise exception 'invalid_submission' using errcode = 'P0001';
      end if;
      insert into public.daily_study_plan_tasks(
        plan_id, user_id, position, kind, origin, user_problem_id, original_user_problem_id,
        leetcode_frontend_id, leetcode_slug, title, difficulty, leetcode_url,
        mastery_score_snapshot, next_review_at_snapshot, schedule_version_snapshot,
        review_pool_snapshot
      ) values (
        v_plan.id, v_user_id, v_position, v_task->>'kind', 'tracked', v_problem.id, v_problem.id,
        v_problem.leetcode_frontend_id, v_problem.leetcode_slug, v_problem.title,
        v_problem.difficulty, v_problem.leetcode_url,
        case when v_pool = 'imported' then 3 else v_problem.mastery_score end,
        v_problem.next_review_at, v_problem.schedule_version, v_pool
      ) returning id into v_task_id;
      update public.user_problems set scheduling_policy_version = 'v1'
      where id = v_problem.id and user_id = v_user_id;
      insert into public.review_allocation_entries(
        context_id, user_id, allocation_key, candidate_user_problem_id,
        candidate_problem_id_snapshot, pool, source, imported_weight,
        established_weight, daily_study_plan_task_id, daily_study_plan_task_id_snapshot
      ) values (
        v_context.id, v_user_id, v_allocation_key, v_problem.id, v_problem.id,
        v_pool, 'generated', v_imported_weight, v_established_weight,
        v_task_id, v_task_id
      );
      if v_pool = 'established' then v_established_selected := v_established_selected + 1; end if;
    elsif v_task->>'kind' = 'new_problem' and v_task->>'origin' in ('tracked', 'roadmap') then
      v_new_count := v_new_count + 1;
      if v_new_count > v_remaining_new then raise exception 'invalid_submission' using errcode = 'P0001'; end if;

      select member.leetcode_slug, problem.id into v_expected_slug, v_expected_problem_id
      from public.study_roadmap_problems member
      left join public.user_problems problem
        on problem.user_id = v_user_id and problem.leetcode_slug = member.leetcode_slug
      where member.roadmap_id = v_source_roadmap
        and (problem.id is null or (problem.lifecycle_state = 'active' and problem.total_reviews = 0
          and not (problem.source = 'leetcode_import' and problem.external_practice_status = 'accepted')))
        and not exists (
          select 1 from public.daily_study_plan_tasks chosen
          where chosen.plan_id = v_plan.id and chosen.leetcode_slug = member.leetcode_slug
        )
      order by case when v_revision.new_selection_mode = 'sequential' then member.position end,
        case when v_revision.new_selection_mode = 'shuffled'
          then private.v1_stable_hash(v_seed || ':' || member.leetcode_slug) end,
        member.position, member.leetcode_slug
      limit 1;
      if not found or v_task->>'slug' is distinct from v_expected_slug
        or (v_expected_problem_id is null and v_task->>'origin' <> 'roadmap')
        or (v_expected_problem_id is not null and (
          v_task->>'origin' <> 'tracked' or (v_task->>'user_problem_id')::uuid <> v_expected_problem_id
        ))
        or coalesce(v_task->>'frontend_id', '') !~ '^[0-9]+$'
        or coalesce(pg_catalog.btrim(v_task->>'title'), '') = ''
        or v_task->>'difficulty' not in ('easy', 'medium', 'hard')
        or v_task->>'leetcode_url' <> 'https://leetcode.com/problems/' || v_expected_slug || '/' then
        raise exception 'stale_recommendations' using errcode = 'P0001';
      end if;
      if v_expected_problem_id is not null then
        select * into v_problem from public.user_problems
        where id = v_expected_problem_id and user_id = v_user_id for update;
        insert into public.daily_study_plan_tasks(
          plan_id, user_id, position, kind, origin, user_problem_id, original_user_problem_id,
          leetcode_frontend_id, leetcode_slug, title, difficulty, leetcode_url,
          mastery_score_snapshot, next_review_at_snapshot, schedule_version_snapshot
        ) values (
          v_plan.id, v_user_id, v_position, 'new_problem', 'tracked', v_problem.id, v_problem.id,
          v_problem.leetcode_frontend_id, v_problem.leetcode_slug, v_problem.title,
          v_problem.difficulty, v_problem.leetcode_url, v_problem.mastery_score,
          v_problem.next_review_at, v_problem.schedule_version
        );
        update public.user_problems set scheduling_policy_version = 'v1'
        where id = v_problem.id and user_id = v_user_id;
      else
        insert into public.daily_study_plan_tasks(
          plan_id, user_id, position, kind, origin, leetcode_frontend_id,
          leetcode_slug, title, difficulty, leetcode_url, roadmap_order
        ) values (
          v_plan.id, v_user_id, v_position, 'new_problem', 'roadmap',
          v_task->>'frontend_id', v_expected_slug, v_task->>'title',
          v_task->>'difficulty', v_task->>'leetcode_url', (v_task->>'roadmap_order')::integer
        );
      end if;
    else
      raise exception 'invalid_submission' using errcode = 'P0001';
    end if;
    v_position := v_position + 1;
  end loop;

  update public.daily_study_plans
  set review_shortage_count = greatest(0, v_remaining_reviews - v_review_count),
      new_problem_shortage_count = greatest(0, v_remaining_new - v_new_count)
  where id = v_plan.id
  returning * into v_plan;
  return v_plan;
exception
  when invalid_text_representation or numeric_value_out_of_range or check_violation then
    raise exception 'invalid_submission' using errcode = 'P0001';
  when unique_violation then
    raise exception 'stale_recommendations' using errcode = 'P0001';
end;
$$;

revoke execute on function public.create_v1_daily_study_plan(text, timestamptz, uuid, jsonb)
  from public, anon;
grant execute on function public.create_v1_daily_study_plan(text, timestamptz, uuid, jsonb)
  to authenticated;

commit;
