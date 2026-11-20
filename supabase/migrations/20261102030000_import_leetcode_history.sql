begin;

alter table public.user_problems
  add column source text not null default 'manual',
  add column external_practice_status text,
  add column external_activity_date date,
  add constraint user_problems_source_check
    check (source in ('manual', 'leetcode_import')),
  add constraint user_problems_external_practice_status_check
    check (external_practice_status is null or external_practice_status in ('accepted', 'attempted_only')),
  add constraint user_problems_import_metadata_check
    check (
      (source = 'manual' and external_practice_status is null and external_activity_date is null)
      or (source = 'leetcode_import' and external_practice_status is not null)
    );

create index user_problems_calibration_candidates_idx
  on public.user_problems (user_id, external_activity_date, created_at, id)
  where source = 'leetcode_import'
    and external_practice_status = 'accepted'
    and lifecycle_state = 'active'
    and total_reviews = 0;

alter table public.daily_study_plans
  drop constraint daily_study_plans_selection_version_check,
  alter column selection_version set default 'v2',
  add constraint daily_study_plans_selection_version_check
    check (selection_version in ('v1', 'v2'));

alter table public.daily_study_plan_tasks
  drop constraint daily_study_plan_tasks_kind_check,
  add constraint daily_study_plan_tasks_kind_check
    check (kind in ('review', 'new_problem', 'calibration'));

create or replace function public.create_daily_study_plan(
  p_time_zone text,
  p_reference_time timestamptz,
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
  v_plan public.daily_study_plans%rowtype;
  v_problem public.user_problems%rowtype;
  v_task jsonb;
  v_position integer := 0;
  v_review_count integer := 0;
  v_new_count integer := 0;
  v_id uuid;
  v_version bigint;
  v_origin text;
  v_kind text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-study-plan:' || v_user_id::text, 0)
  );
  v_now := pg_catalog.clock_timestamp();

  select time_zone into v_time_zone from public.user_study_preferences where user_id = v_user_id;
  if not found then
    v_time_zone := pg_catalog.btrim(p_time_zone);
    if v_time_zone is null or v_time_zone = '' or not exists (
      select 1 from pg_catalog.pg_timezone_names where name = v_time_zone
    ) then
      raise exception 'invalid_time_zone' using errcode = 'P0001';
    end if;
    insert into public.user_study_preferences(user_id, time_zone) values (v_user_id, v_time_zone);
  end if;

  v_study_date := (v_now at time zone v_time_zone)::date;
  select * into v_plan from public.daily_study_plans
    where user_id = v_user_id and study_date = v_study_date;
  if found then
    return v_plan;
  end if;

  if p_reference_time is null or (p_reference_time at time zone v_time_zone)::date <> v_study_date
    or p_reference_time > v_now + interval '30 seconds' or p_tasks is null then
    raise exception 'stale_recommendations' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_tasks) <> 'array' or pg_catalog.jsonb_array_length(p_tasks) > 4 then
    raise exception 'invalid_submission' using errcode = 'P0001';
  end if;

  perform id from public.user_problems
    where user_id = v_user_id and id in (
      select (value->>'user_problem_id')::uuid from pg_catalog.jsonb_array_elements(p_tasks)
      where value->>'origin' = 'tracked'
    ) order by id for update;

  insert into public.daily_study_plans(
    user_id, study_date, time_zone, day_starts_at, day_ends_at, roadmap_id,
    reference_time, planned_task_count
  ) values (
    v_user_id, v_study_date, v_time_zone,
    v_study_date::timestamp at time zone v_time_zone,
    (v_study_date + 1)::timestamp at time zone v_time_zone,
    'neetcode-150', p_reference_time, pg_catalog.jsonb_array_length(p_tasks)
  ) returning * into v_plan;

  for v_task in select value from pg_catalog.jsonb_array_elements(p_tasks) loop
    v_kind := v_task->>'kind';
    v_origin := v_task->>'origin';
    if pg_catalog.jsonb_typeof(v_task) <> 'object'
      or v_kind is null or v_kind not in ('review', 'new_problem', 'calibration')
      or v_origin is null or v_origin not in ('tracked', 'roadmap') then
      raise exception 'invalid_submission' using errcode = 'P0001';
    end if;
    if v_kind = 'review' then v_review_count := v_review_count + 1;
    else v_new_count := v_new_count + 1; end if;
    if v_review_count > 3 or v_new_count > 1 then
      raise exception 'invalid_submission' using errcode = 'P0001';
    end if;

    if v_origin = 'tracked' then
      v_id := (v_task->>'user_problem_id')::uuid;
      v_version := (v_task->>'schedule_version')::bigint;
      select * into v_problem from public.user_problems where id = v_id and user_id = v_user_id;
      if not found or v_version is null or v_problem.lifecycle_state <> 'active'
        or v_problem.schedule_version <> v_version
        or v_problem.next_review_at > least(p_reference_time, v_now)
        or (v_kind = 'review' and v_problem.total_reviews = 0)
        or (v_kind = 'new_problem' and (
          v_problem.total_reviews <> 0
          or (v_problem.source = 'leetcode_import' and v_problem.external_practice_status = 'accepted')
        ))
        or (v_kind = 'calibration' and not (
          v_problem.total_reviews = 0
          and v_problem.source = 'leetcode_import'
          and v_problem.external_practice_status = 'accepted'
        )) then
        raise exception 'stale_recommendations' using errcode = 'P0001';
      end if;
      insert into public.daily_study_plan_tasks(
        plan_id, user_id, position, kind, origin, user_problem_id, original_user_problem_id,
        leetcode_frontend_id, leetcode_slug, title, difficulty, leetcode_url,
        mastery_score_snapshot, next_review_at_snapshot, schedule_version_snapshot
      ) values (
        v_plan.id, v_user_id, v_position, v_kind, v_origin, v_problem.id, v_problem.id,
        v_problem.leetcode_frontend_id, v_problem.leetcode_slug, v_problem.title,
        v_problem.difficulty, v_problem.leetcode_url, v_problem.mastery_score,
        v_problem.next_review_at, v_problem.schedule_version
      );
    else
      if v_kind <> 'new_problem' or coalesce(v_task->>'frontend_id', '') !~ '^[0-9]+$'
        or coalesce(v_task->>'slug', '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        or coalesce(pg_catalog.btrim(v_task->>'title'), '') = ''
        or coalesce(v_task->>'difficulty', '') not in ('easy', 'medium', 'hard')
        or coalesce(v_task->>'leetcode_url', '') <> 'https://leetcode.com/problems/' || (v_task->>'slug') || '/'
        or coalesce((v_task->>'roadmap_order')::integer, 0) < 1 then
        raise exception 'invalid_submission' using errcode = 'P0001';
      end if;
      if exists (select 1 from public.user_problems where user_id = v_user_id and (
        leetcode_slug = v_task->>'slug' or leetcode_frontend_id = v_task->>'frontend_id'
      )) then
        raise exception 'stale_recommendations' using errcode = 'P0001';
      end if;
      insert into public.daily_study_plan_tasks(
        plan_id, user_id, position, kind, origin, leetcode_frontend_id,
        leetcode_slug, title, difficulty, leetcode_url, roadmap_order
      ) values (
        v_plan.id, v_user_id, v_position, v_kind, v_origin, v_task->>'frontend_id',
        v_task->>'slug', v_task->>'title', v_task->>'difficulty', v_task->>'leetcode_url',
        (v_task->>'roadmap_order')::integer
      );
    end if;
    v_position := v_position + 1;
  end loop;

  return v_plan;
exception
  when invalid_text_representation or numeric_value_out_of_range or check_violation then
    raise exception 'invalid_submission' using errcode = 'P0001';
  when unique_violation then
    raise exception 'invalid_submission' using errcode = 'P0001';
end;
$$;

create function public.import_leetcode_history(p_problems jsonb)
returns table (
  imported_count integer,
  already_tracked_count integer,
  skipped_count integer,
  failed_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_problem jsonb;
  v_frontend_id text;
  v_slug text;
  v_status text;
  v_date_text text;
  v_activity_date date;
  v_topics text[];
  v_imported integer := 0;
  v_already integer := 0;
  v_skipped integer := 0;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_problems is null or pg_catalog.jsonb_typeof(p_problems) <> 'array'
    or pg_catalog.jsonb_array_length(p_problems) > 2000 then
    raise exception 'invalid_submission' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_problems) item
    where pg_catalog.jsonb_typeof(item) <> 'object'
      or coalesce(item->>'frontend_id', '') !~ '^[0-9]+$'
      or coalesce(item->>'slug', '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      or coalesce(pg_catalog.btrim(item->>'title'), '') = ''
      or coalesce(item->>'difficulty', '') not in ('easy', 'medium', 'hard')
      or coalesce(item->>'leetcode_url', '') <> 'https://leetcode.com/problems/' || (item->>'slug') || '/'
      or coalesce(item->>'external_practice_status', '') not in ('accepted', 'attempted_only')
      or pg_catalog.jsonb_typeof(coalesce(item->'topics', '[]'::jsonb)) <> 'array'
      or (item->>'external_activity_date' is not null
        and item->>'external_activity_date' !~ '^\d{4}-\d{2}-\d{2}$')
      or exists (
        select 1 from pg_catalog.jsonb_array_elements(coalesce(item->'topics', '[]'::jsonb)) topic
        where pg_catalog.jsonb_typeof(topic) <> 'string'
          or pg_catalog.btrim(topic #>> '{}') = ''
      )
  ) then
    raise exception 'invalid_submission' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_problems) item
    group by item->>'frontend_id' having count(*) > 1
  ) or exists (
    select 1 from pg_catalog.jsonb_array_elements(p_problems) item
    group by item->>'slug' having count(*) > 1
  ) then
    raise exception 'invalid_submission' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('leetcode-history-import:' || v_user_id::text, 0)
  );

  for v_problem in select value from pg_catalog.jsonb_array_elements(p_problems) loop
    v_frontend_id := pg_catalog.btrim(v_problem->>'frontend_id');
    v_slug := v_problem->>'slug';
    v_status := v_problem->>'external_practice_status';
    v_date_text := v_problem->>'external_activity_date';
    v_activity_date := case when v_date_text is null then null else v_date_text::date end;
    if v_activity_date > (v_now at time zone 'Pacific/Kiritimati')::date then
      raise exception 'invalid_submission' using errcode = 'P0001';
    end if;
    select coalesce(pg_catalog.array_agg(topic #>> '{}'), '{}'::text[])
      into v_topics
      from pg_catalog.jsonb_array_elements(coalesce(v_problem->'topics', '[]'::jsonb)) topic;

    if exists (
      select 1 from public.user_problems
      where user_id = v_user_id
        and (leetcode_frontend_id = v_frontend_id or leetcode_slug = v_slug)
    ) then
      v_already := v_already + 1;
      continue;
    end if;

    if v_status = 'attempted_only' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    begin
      insert into public.user_problems(
        user_id, leetcode_frontend_id, leetcode_slug, leetcode_url, title,
        difficulty, leetcode_topics, notes, lifecycle_state, review_stage,
        last_reviewed_at, next_review_at, mastery_score, total_reviews,
        source, external_practice_status, external_activity_date
      ) values (
        v_user_id, v_frontend_id, v_slug, v_problem->>'leetcode_url',
        v_problem->>'title', v_problem->>'difficulty', v_topics, '', 'active', 0,
        null, coalesce(v_activity_date::timestamp at time zone 'UTC', v_now), 0, 0,
        'leetcode_import', 'accepted', v_activity_date
      );
      v_imported := v_imported + 1;
    exception when unique_violation then
      v_already := v_already + 1;
    end;
  end loop;

  return query select v_imported, v_already, v_skipped, 0;
exception
  when invalid_datetime_format or datetime_field_overflow or check_violation then
    raise exception 'invalid_submission' using errcode = 'P0001';
end;
$$;

revoke execute on function public.import_leetcode_history(jsonb) from public, anon;
grant execute on function public.import_leetcode_history(jsonb) to authenticated;

commit;
