begin;

create function private.has_effective_v1_settings(p_user_id uuid, p_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_study_preferences preferences
    join public.study_plan_setting_revisions revision on revision.user_id = preferences.user_id
    where preferences.user_id = p_user_id
      and revision.effective_study_date <= (p_at at time zone preferences.time_zone)::date
  );
$$;

revoke all on function private.has_effective_v1_settings(uuid, timestamptz)
  from public, anon, authenticated;

create function private.calculate_v1_review_transition(
  p_rating text,
  p_previous_mastery_score integer,
  p_previous_consecutive_good_count integer,
  p_reviewed_at timestamptz
)
returns table (
  new_review_stage integer,
  new_next_review_at timestamptz,
  new_mastery_score integer,
  new_consecutive_good_count integer
)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_interval_days integer;
begin
  if p_rating not in ('bad', 'ok', 'good')
    or p_previous_mastery_score not between 0 and 10
    or p_previous_consecutive_good_count is null or p_previous_consecutive_good_count < 0
    or p_reviewed_at is null then
    raise exception 'invalid_rating' using errcode = 'P0001';
  end if;
  new_mastery_score := greatest(0, least(10, p_previous_mastery_score + case p_rating
    when 'bad' then -2 when 'ok' then 1 else 3 end));
  new_consecutive_good_count := case
    when p_rating = 'good' then p_previous_consecutive_good_count + 1 else 0 end;
  v_interval_days := case
    when p_rating = 'bad' then 1
    when p_rating = 'ok' then 3
    when new_consecutive_good_count <= 1 then 7
    when new_consecutive_good_count = 2 then 14
    when new_consecutive_good_count = 3 then 30
    else 60
  end;
  new_review_stage := new_consecutive_good_count;
  new_next_review_at := p_reviewed_at + v_interval_days * interval '1 day';
  return next;
end;
$$;

revoke all on function private.calculate_v1_review_transition(text, integer, integer, timestamptz)
  from public, anon, authenticated;

create or replace function public.submit_problem_review(
  p_user_problem_id uuid,
  p_rating text,
  p_expected_schedule_version bigint
)
returns table (
  review_event_id uuid,
  new_review_stage integer,
  new_next_review_at timestamptz,
  new_schedule_version bigint,
  correctable_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_problem public.user_problems%rowtype;
  v_reviewed_at timestamptz := pg_catalog.clock_timestamp();
  v_review_event_id uuid;
  v_new_review_stage integer;
  v_new_next_review_at timestamptz;
  v_new_schedule_version bigint;
  v_new_mastery_score integer;
  v_new_good_count integer;
  v_previous_mastery integer;
  v_correctable_until timestamptz := v_reviewed_at + interval '5 minutes';
  v_manual_today boolean := false;
  v_use_v1 boolean;
  v_problem_type text;
  v_review_pool text;
  v_time_zone text;
  v_study_date date;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if p_user_problem_id is null then raise exception 'problem_not_due' using errcode = 'P0001'; end if;
  if p_rating is null or p_rating not in ('bad', 'ok', 'good') then
    raise exception 'invalid_rating' using errcode = 'P0001';
  end if;
  if p_expected_schedule_version is null or p_expected_schedule_version < 0 then
    raise exception 'stale_review' using errcode = 'P0001';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-study-plan:' || v_user_id::text, 0)
  );
  select * into v_problem from public.user_problems
  where id = p_user_problem_id and user_id = v_user_id and lifecycle_state = 'active'
  for update;
  if not found then raise exception 'problem_not_due' using errcode = 'P0001'; end if;
  if v_problem.schedule_version <> p_expected_schedule_version then
    raise exception 'stale_review' using errcode = 'P0001';
  end if;
  select exists (
    select 1 from public.daily_study_plan_tasks task
    join public.daily_study_plans plan on plan.id = task.plan_id and plan.user_id = task.user_id
    where task.user_id = v_user_id and task.user_problem_id = v_problem.id
      and task.status = 'pending' and task.assignment_source in ('manual_today', 'generated')
      and v_reviewed_at >= plan.day_starts_at and v_reviewed_at < plan.day_ends_at
  ) into v_manual_today;
  if v_problem.next_review_at > v_reviewed_at and not v_manual_today then
    raise exception 'problem_not_due' using errcode = 'P0001';
  end if;

  v_use_v1 := v_problem.scheduling_policy_version = 'v1'
    or private.has_effective_v1_settings(v_user_id, v_reviewed_at);
  select preferences.time_zone into v_time_zone from public.user_study_preferences preferences
  where preferences.user_id = v_user_id;
  v_time_zone := coalesce(v_time_zone, 'UTC');
  v_study_date := (v_reviewed_at at time zone v_time_zone)::date;
  v_problem_type := case
    when v_problem.total_reviews > 0 then 'review'
    when v_problem.source = 'leetcode_import' and v_problem.external_practice_status = 'accepted' then 'review'
    else 'new'
  end;
  v_review_pool := case
    when v_problem.total_reviews > 0 then 'established'
    when v_problem.source = 'leetcode_import' and v_problem.external_practice_status = 'accepted' then 'imported'
    else null
  end;
  v_previous_mastery := case when v_review_pool = 'imported' then 3 else v_problem.mastery_score end;

  if v_use_v1 then
    select transition.new_review_stage, transition.new_next_review_at,
      transition.new_mastery_score, transition.new_consecutive_good_count
    into v_new_review_stage, v_new_next_review_at, v_new_mastery_score, v_new_good_count
    from private.calculate_v1_review_transition(
      p_rating, v_previous_mastery, v_problem.consecutive_good_count, v_reviewed_at
    ) transition;
  else
    select transition.new_review_stage, transition.new_next_review_at, transition.new_mastery_score
    into v_new_review_stage, v_new_next_review_at, v_new_mastery_score
    from private.calculate_review_transition(
      'review', p_rating, v_problem.review_stage, v_problem.mastery_score, v_reviewed_at, null
    ) transition;
    v_new_good_count := v_problem.consecutive_good_count;
  end if;
  v_new_schedule_version := v_problem.schedule_version + 1;

  insert into public.review_events(
    user_id, user_problem_id, rating, previous_review_stage, new_review_stage,
    previous_next_review_at, next_review_at, reviewed_at, previous_mastery_score,
    previous_total_reviews, transition_kind, transition_time_zone,
    resulting_schedule_version, correctable_until,
    previous_consecutive_good_count, resulting_consecutive_good_count,
    scheduling_policy_version, pre_practice_problem_type, pre_practice_review_pool,
    practice_local_date, practice_time_zone
  ) values (
    v_user_id, v_problem.id, p_rating, v_problem.review_stage, v_new_review_stage,
    v_problem.next_review_at, v_new_next_review_at, v_reviewed_at, v_previous_mastery,
    v_problem.total_reviews, 'review', null, v_new_schedule_version, v_correctable_until,
    v_problem.consecutive_good_count, v_new_good_count,
    case when v_use_v1 then 'v1' else 'legacy-v1' end,
    v_problem_type, v_review_pool, v_study_date, v_time_zone
  ) returning id into v_review_event_id;

  update public.user_problems set
    review_stage = v_new_review_stage, last_reviewed_at = v_reviewed_at,
    next_review_at = v_new_next_review_at, updated_at = v_reviewed_at,
    schedule_version = v_new_schedule_version, mastery_score = v_new_mastery_score,
    total_reviews = v_problem.total_reviews + 1,
    consecutive_good_count = v_new_good_count,
    scheduling_policy_version = case when v_use_v1 then 'v1' else scheduling_policy_version end
  where id = v_problem.id and user_id = v_user_id;
  perform private.record_daily_study_activity(v_problem.id, 'review', v_review_event_id, null, null);
  return query select v_review_event_id, v_new_review_stage, v_new_next_review_at,
    v_new_schedule_version, v_correctable_until;
end;
$$;

revoke execute on function public.submit_problem_review(uuid, text, bigint) from public, anon;
grant execute on function public.submit_problem_review(uuid, text, bigint) to authenticated;

create or replace function public.create_user_problem_with_timezone(
  p_leetcode_frontend_id text,
  p_leetcode_slug text,
  p_leetcode_url text,
  p_title text,
  p_difficulty text,
  p_leetcode_topics text[],
  p_notes text,
  p_start_mode text,
  p_rating text,
  p_start_date date,
  p_time_zone text
)
returns table (
  user_problem_id uuid,
  review_event_id uuid,
  review_stage integer,
  next_review_at timestamptz,
  mastery_score integer,
  total_reviews integer,
  correctable_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_problem_id uuid;
  v_review_event_id uuid;
  v_review_stage integer;
  v_next_review_at timestamptz;
  v_mastery_score integer;
  v_total_reviews integer;
  v_reviewed_at timestamptz;
  v_constraint_name text;
  v_time_zone text;
  v_user_today date;
  v_schedule_version bigint;
  v_correctable_until timestamptz;
  v_use_v1 boolean;
  v_good_count integer := 0;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if p_leetcode_frontend_id is null or pg_catalog.btrim(p_leetcode_frontend_id) = '' then
    raise exception 'invalid_submission' using errcode = 'P0001';
  end if;
  v_time_zone := pg_catalog.btrim(p_time_zone);
  if p_time_zone is null or v_time_zone = '' or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = v_time_zone
  ) then raise exception 'invalid_time_zone' using errcode = 'P0001'; end if;
  if p_start_mode is null or p_start_mode not in ('practiced', 'scheduled') then
    raise exception 'invalid_start_mode' using errcode = 'P0001';
  end if;
  if p_start_date is null then raise exception 'invalid_date' using errcode = 'P0001'; end if;
  v_user_today := (pg_catalog.now() at time zone v_time_zone)::date;
  if (p_start_mode = 'practiced' and p_start_date > v_user_today)
    or (p_start_mode = 'scheduled' and p_start_date < v_user_today) then
    raise exception 'invalid_date' using errcode = 'P0001';
  end if;
  if p_start_mode = 'practiced' and p_rating not in ('bad', 'ok', 'good') then
    raise exception 'invalid_rating' using errcode = 'P0001';
  end if;

  v_use_v1 := private.has_effective_v1_settings(v_user_id, pg_catalog.clock_timestamp());
  if p_start_mode = 'practiced' then
    v_reviewed_at := p_start_date::timestamp at time zone v_time_zone;
    if v_use_v1 then
      select transition.new_review_stage, transition.new_next_review_at,
        transition.new_mastery_score, transition.new_consecutive_good_count
      into v_review_stage, v_next_review_at, v_mastery_score, v_good_count
      from private.calculate_v1_review_transition(p_rating, 0, 0, v_reviewed_at) transition;
    else
      select transition.new_review_stage, transition.new_next_review_at, transition.new_mastery_score
      into v_review_stage, v_next_review_at, v_mastery_score
      from private.calculate_review_transition('initial_practice', p_rating, 0, 0, v_reviewed_at, v_time_zone) transition;
    end if;
    v_total_reviews := 1;
    v_correctable_until := pg_catalog.clock_timestamp() + interval '5 minutes';
  else
    v_review_stage := 0; v_next_review_at := p_start_date::timestamp at time zone v_time_zone;
    v_mastery_score := 0; v_total_reviews := 0;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-study-plan:' || v_user_id::text, 0)
  );
  begin
    insert into public.user_problems(
      user_id, leetcode_frontend_id, leetcode_slug, leetcode_url, title,
      difficulty, leetcode_topics, notes, review_stage, last_reviewed_at,
      next_review_at, mastery_score, total_reviews, consecutive_good_count,
      scheduling_policy_version
    ) values (
      v_user_id, pg_catalog.btrim(p_leetcode_frontend_id), p_leetcode_slug,
      p_leetcode_url, p_title, p_difficulty, coalesce(p_leetcode_topics, '{}'::text[]),
      p_notes, v_review_stage, v_reviewed_at, v_next_review_at, v_mastery_score,
      v_total_reviews, v_good_count, case when v_use_v1 then 'v1' else 'legacy-v1' end
    ) returning id, schedule_version into v_user_problem_id, v_schedule_version;
  exception when unique_violation then
    get stacked diagnostics v_constraint_name = constraint_name;
    if v_constraint_name in ('user_problems_user_id_leetcode_slug_key', 'user_problems_user_id_leetcode_frontend_id_key') then
      raise exception 'duplicate_problem' using errcode = 'P0001';
    end if;
    raise;
  end;

  if p_start_mode = 'practiced' then
    insert into public.review_events(
      user_id, user_problem_id, rating, previous_review_stage, new_review_stage,
      previous_next_review_at, next_review_at, reviewed_at, previous_mastery_score,
      previous_total_reviews, transition_kind, transition_time_zone,
      resulting_schedule_version, correctable_until,
      previous_consecutive_good_count, resulting_consecutive_good_count,
      scheduling_policy_version, pre_practice_problem_type,
      practice_local_date, practice_time_zone
    ) values (
      v_user_id, v_user_problem_id, p_rating, 0, v_review_stage, null,
      v_next_review_at, v_reviewed_at, 0, 0, 'initial_practice', v_time_zone,
      v_schedule_version, v_correctable_until, 0, v_good_count,
      case when v_use_v1 then 'v1' else 'legacy-v1' end,
      'new', p_start_date, v_time_zone
    ) returning id into v_review_event_id;
  end if;
  perform private.record_daily_study_activity(
    v_user_problem_id, p_start_mode, v_review_event_id, p_start_date, v_time_zone
  );
  return query select v_user_problem_id, v_review_event_id, v_review_stage,
    v_next_review_at, v_mastery_score, v_total_reviews, v_correctable_until;
end;
$$;

revoke execute on function public.create_user_problem_with_timezone(
  text, text, text, text, text, text[], text, text, text, date, text
) from public, anon;
grant execute on function public.create_user_problem_with_timezone(
  text, text, text, text, text, text[], text, text, text, date, text
) to authenticated;

create or replace function public.correct_review_rating(p_review_event_id uuid, p_rating text)
returns table (
  review_event_id uuid,
  rating text,
  new_review_stage integer,
  new_next_review_at timestamptz,
  new_schedule_version bigint,
  correctable_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_event public.review_events%rowtype;
  v_problem public.user_problems%rowtype;
  v_new_review_stage integer;
  v_new_next_review_at timestamptz;
  v_new_mastery_score integer;
  v_new_good_count integer;
  v_new_schedule_version bigint;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if p_review_event_id is null or p_rating not in ('bad', 'ok', 'good') then
    raise exception 'invalid_rating' using errcode = 'P0001';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-study-plan:' || v_user_id::text, 0)
  );
  select * into v_event from public.review_events
  where id = p_review_event_id and user_id = v_user_id;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  select * into v_problem from public.user_problems
  where id = v_event.user_problem_id and user_id = v_user_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  select * into v_event from public.review_events
  where id = p_review_event_id and user_id = v_user_id for update;
  if v_now > v_event.correctable_until then raise exception 'correction_expired' using errcode = 'P0001'; end if;
  if v_problem.last_reviewed_at is distinct from v_event.reviewed_at
    or v_problem.total_reviews <> v_event.previous_total_reviews + 1
    or v_problem.schedule_version <> v_event.resulting_schedule_version
    or exists (select 1 from public.review_events later
      where later.user_id = v_user_id and later.user_problem_id = v_problem.id
        and (later.reviewed_at, later.id) > (v_event.reviewed_at, v_event.id)) then
    raise exception 'stale_review' using errcode = 'P0001';
  end if;
  if v_event.rating = p_rating then
    return query select v_event.id, v_event.rating, v_event.new_review_stage,
      v_event.next_review_at, v_event.resulting_schedule_version, v_event.correctable_until;
    return;
  end if;
  if v_event.scheduling_policy_version = 'v1' then
    select transition.new_review_stage, transition.new_next_review_at,
      transition.new_mastery_score, transition.new_consecutive_good_count
    into v_new_review_stage, v_new_next_review_at, v_new_mastery_score, v_new_good_count
    from private.calculate_v1_review_transition(
      p_rating, v_event.previous_mastery_score,
      v_event.previous_consecutive_good_count, v_event.reviewed_at
    ) transition;
  else
    select transition.new_review_stage, transition.new_next_review_at, transition.new_mastery_score
    into v_new_review_stage, v_new_next_review_at, v_new_mastery_score
    from private.calculate_review_transition(
      v_event.transition_kind, p_rating, v_event.previous_review_stage,
      v_event.previous_mastery_score, v_event.reviewed_at, v_event.transition_time_zone
    ) transition;
    v_new_good_count := v_event.resulting_consecutive_good_count;
  end if;
  v_new_schedule_version := v_problem.schedule_version + 1;
  update public.review_events set rating = p_rating, new_review_stage = v_new_review_stage,
    next_review_at = v_new_next_review_at, resulting_schedule_version = v_new_schedule_version,
    resulting_consecutive_good_count = v_new_good_count, corrected_at = v_now
  where id = v_event.id and user_id = v_user_id;
  update public.user_problems set review_stage = v_new_review_stage,
    next_review_at = v_new_next_review_at, mastery_score = v_new_mastery_score,
    consecutive_good_count = v_new_good_count, schedule_version = v_new_schedule_version,
    updated_at = v_now
  where id = v_problem.id and user_id = v_user_id;
  return query select v_event.id, p_rating, v_new_review_stage, v_new_next_review_at,
    v_new_schedule_version, v_event.correctable_until;
end;
$$;

revoke execute on function public.correct_review_rating(uuid, text) from public, anon;
grant execute on function public.correct_review_rating(uuid, text) to authenticated;

commit;
