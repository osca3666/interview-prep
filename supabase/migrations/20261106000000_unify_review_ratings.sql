begin;

-- Prelaunch cutover: study history is disposable, but auth accounts and saved
-- preferences remain intact. Listing every related table avoids CASCADE.
truncate table
  public.daily_study_plan_tasks,
  public.daily_study_plans,
  public.review_events,
  public.user_problems;

alter table public.review_events
  drop constraint review_events_rating_check,
  add column previous_mastery_score integer not null,
  add column previous_total_reviews integer not null,
  add column transition_kind text not null,
  add column transition_time_zone text,
  add column resulting_schedule_version bigint not null,
  add column correctable_until timestamptz not null,
  add column corrected_at timestamptz,
  add constraint review_events_rating_check
    check (rating in ('bad', 'ok', 'good')),
  add constraint review_events_previous_mastery_score_check
    check (previous_mastery_score between 0 and 10),
  add constraint review_events_previous_total_reviews_check
    check (previous_total_reviews >= 0),
  add constraint review_events_transition_kind_check
    check (transition_kind in ('initial_practice', 'review')),
  add constraint review_events_transition_time_zone_check
    check (
      (transition_kind = 'initial_practice' and transition_time_zone is not null)
      or (transition_kind = 'review' and transition_time_zone is null)
    ),
  add constraint review_events_resulting_schedule_version_check
    check (resulting_schedule_version >= 0),
  add constraint review_events_correction_window_check
    check (correctable_until >= reviewed_at);

create or replace function private.calculate_review_transition(
  p_transition_kind text,
  p_rating text,
  p_previous_review_stage integer,
  p_previous_mastery_score integer,
  p_reviewed_at timestamptz,
  p_time_zone text
)
returns table (
  new_review_stage integer,
  new_next_review_at timestamptz,
  new_mastery_score integer
)
language plpgsql
set search_path = ''
as $$
declare
  v_interval_days integer;
begin
  if p_transition_kind not in ('initial_practice', 'review')
    or p_rating not in ('bad', 'ok', 'good')
    or p_previous_review_stage is null or p_previous_review_stage < 0
    or p_previous_mastery_score is null or p_previous_mastery_score not between 0 and 10
    or p_reviewed_at is null then
    raise exception 'invalid_rating' using errcode = 'P0001';
  end if;

  if p_transition_kind = 'initial_practice' then
    if p_time_zone is null or not exists (
      select 1 from pg_catalog.pg_timezone_names where name = p_time_zone
    ) then
      raise exception 'invalid_time_zone' using errcode = 'P0001';
    end if;

    new_review_stage := case p_rating
      when 'bad' then 0
      when 'ok' then 1
      when 'good' then 2
    end;
    new_mastery_score := case p_rating
      when 'bad' then 0
      when 'ok' then 2
      when 'good' then 3
    end;
    v_interval_days := case p_rating
      when 'bad' then 1
      when 'ok' then 3
      when 'good' then 7
    end;
    new_next_review_at := (
      ((p_reviewed_at at time zone p_time_zone)::date + v_interval_days)::timestamp
      at time zone p_time_zone
    );
  else
    new_review_stage := case p_rating
      when 'bad' then 0
      when 'ok' then p_previous_review_stage + 1
      when 'good' then p_previous_review_stage + 2
    end;
    new_mastery_score := case p_rating
      when 'bad' then greatest(0, p_previous_mastery_score - 2)
      when 'ok' then least(10, p_previous_mastery_score + 2)
      when 'good' then least(10, p_previous_mastery_score + 3)
    end;
    v_interval_days := case
      when p_rating = 'bad' then 1
      when new_review_stage = 0 then 2
      when new_review_stage = 1 then 3
      when new_review_stage = 2 then 7
      when new_review_stage = 3 then 14
      when new_review_stage = 4 then 30
      else 60
    end;
    new_next_review_at := p_reviewed_at + (v_interval_days * interval '1 day');
  end if;

  return next;
end;
$$;

revoke all on function private.calculate_review_transition(text, text, integer, integer, timestamptz, text)
  from public, anon, authenticated;

drop function public.rate_new_daily_study_task(uuid, text, text, text, text, text, text, text[]);
drop function public.submit_problem_review(uuid, text, bigint);
drop function public.create_user_problem_with_timezone(text, text, text, text, text, text[], text, text, text, date, text);

create function public.submit_problem_review(
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
  v_correctable_until timestamptz := v_reviewed_at + interval '5 minutes';
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_user_problem_id is null then
    raise exception 'problem_not_due' using errcode = 'P0001';
  end if;
  if p_rating is null or p_rating not in ('bad', 'ok', 'good') then
    raise exception 'invalid_rating' using errcode = 'P0001';
  end if;
  if p_expected_schedule_version is null or p_expected_schedule_version < 0 then
    raise exception 'stale_review' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-study-plan:' || v_user_id::text, 0)
  );

  select * into v_problem
  from public.user_problems
  where id = p_user_problem_id and user_id = v_user_id and lifecycle_state = 'active'
  for update;
  if not found then
    raise exception 'problem_not_due' using errcode = 'P0001';
  end if;
  if v_problem.schedule_version <> p_expected_schedule_version then
    raise exception 'stale_review' using errcode = 'P0001';
  end if;
  if v_problem.next_review_at > v_reviewed_at then
    raise exception 'problem_not_due' using errcode = 'P0001';
  end if;

  select transition.new_review_stage, transition.new_next_review_at, transition.new_mastery_score
  into v_new_review_stage, v_new_next_review_at, v_new_mastery_score
  from private.calculate_review_transition(
    'review', p_rating, v_problem.review_stage, v_problem.mastery_score,
    v_reviewed_at, null
  ) transition;
  v_new_schedule_version := v_problem.schedule_version + 1;

  insert into public.review_events (
    user_id, user_problem_id, rating,
    previous_review_stage, new_review_stage,
    previous_next_review_at, next_review_at, reviewed_at,
    previous_mastery_score, previous_total_reviews,
    transition_kind, transition_time_zone,
    resulting_schedule_version, correctable_until
  ) values (
    v_user_id, v_problem.id, p_rating,
    v_problem.review_stage, v_new_review_stage,
    v_problem.next_review_at, v_new_next_review_at, v_reviewed_at,
    v_problem.mastery_score, v_problem.total_reviews,
    'review', null,
    v_new_schedule_version, v_correctable_until
  ) returning id into v_review_event_id;

  update public.user_problems
  set review_stage = v_new_review_stage,
      last_reviewed_at = v_reviewed_at,
      next_review_at = v_new_next_review_at,
      updated_at = v_reviewed_at,
      schedule_version = v_new_schedule_version,
      mastery_score = v_new_mastery_score,
      total_reviews = v_problem.total_reviews + 1
  where id = v_problem.id and user_id = v_user_id;

  perform private.record_daily_study_activity(
    v_problem.id, 'review', v_review_event_id, null, null
  );

  return query select
    v_review_event_id,
    v_new_review_stage,
    v_new_next_review_at,
    v_new_schedule_version,
    v_correctable_until;
end;
$$;

revoke execute on function public.submit_problem_review(uuid, text, bigint) from public, anon;
grant execute on function public.submit_problem_review(uuid, text, bigint) to authenticated;

create function public.create_user_problem_with_timezone(
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
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_leetcode_frontend_id is null or pg_catalog.btrim(p_leetcode_frontend_id) = '' then
    raise exception 'invalid_submission' using errcode = 'P0001';
  end if;

  v_time_zone := pg_catalog.btrim(p_time_zone);
  if p_time_zone is null or v_time_zone = '' or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = v_time_zone
  ) then
    raise exception 'invalid_time_zone' using errcode = 'P0001';
  end if;
  if p_start_mode is null or p_start_mode not in ('practiced', 'scheduled') then
    raise exception 'invalid_start_mode' using errcode = 'P0001';
  end if;
  if p_start_date is null then
    raise exception 'invalid_date' using errcode = 'P0001';
  end if;

  v_user_today := (pg_catalog.now() at time zone v_time_zone)::date;
  if p_start_mode = 'practiced' and p_start_date > v_user_today then
    raise exception 'invalid_date' using errcode = 'P0001';
  end if;
  if p_start_mode = 'scheduled' and p_start_date < v_user_today then
    raise exception 'invalid_date' using errcode = 'P0001';
  end if;
  if p_start_mode = 'practiced' and (
    p_rating is null or p_rating not in ('bad', 'ok', 'good')
  ) then
    raise exception 'invalid_rating' using errcode = 'P0001';
  end if;

  if p_start_mode = 'practiced' then
    v_reviewed_at := p_start_date::timestamp at time zone v_time_zone;
    select transition.new_review_stage, transition.new_next_review_at, transition.new_mastery_score
    into v_review_stage, v_next_review_at, v_mastery_score
    from private.calculate_review_transition(
      'initial_practice', p_rating, 0, 0, v_reviewed_at, v_time_zone
    ) transition;
    v_total_reviews := 1;
    v_correctable_until := pg_catalog.clock_timestamp() + interval '5 minutes';
  else
    v_review_stage := 0;
    v_next_review_at := p_start_date::timestamp at time zone v_time_zone;
    v_mastery_score := 0;
    v_total_reviews := 0;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-study-plan:' || v_user_id::text, 0)
  );

  begin
    insert into public.user_problems (
      user_id, leetcode_frontend_id, leetcode_slug, leetcode_url, title,
      difficulty, leetcode_topics, notes, review_stage, last_reviewed_at,
      next_review_at, mastery_score, total_reviews
    ) values (
      v_user_id, pg_catalog.btrim(p_leetcode_frontend_id), p_leetcode_slug,
      p_leetcode_url, p_title, p_difficulty,
      coalesce(p_leetcode_topics, '{}'::text[]), p_notes,
      v_review_stage, v_reviewed_at, v_next_review_at, v_mastery_score, v_total_reviews
    ) returning id, schedule_version into v_user_problem_id, v_schedule_version;
  exception when unique_violation then
    get stacked diagnostics v_constraint_name = constraint_name;
    if v_constraint_name in (
      'user_problems_user_id_leetcode_slug_key',
      'user_problems_user_id_leetcode_frontend_id_key'
    ) then
      raise exception 'duplicate_problem' using errcode = 'P0001';
    end if;
    raise;
  end;

  if p_start_mode = 'practiced' then
    insert into public.review_events (
      user_id, user_problem_id, rating,
      previous_review_stage, new_review_stage,
      previous_next_review_at, next_review_at, reviewed_at,
      previous_mastery_score, previous_total_reviews,
      transition_kind, transition_time_zone,
      resulting_schedule_version, correctable_until
    ) values (
      v_user_id, v_user_problem_id, p_rating,
      0, v_review_stage,
      null, v_next_review_at, v_reviewed_at,
      0, 0,
      'initial_practice', v_time_zone,
      v_schedule_version, v_correctable_until
    ) returning id into v_review_event_id;
  end if;

  perform private.record_daily_study_activity(
    v_user_problem_id, p_start_mode, v_review_event_id, p_start_date, v_time_zone
  );

  return query select
    v_user_problem_id,
    v_review_event_id,
    v_review_stage,
    v_next_review_at,
    v_mastery_score,
    v_total_reviews,
    v_correctable_until;
end;
$$;

revoke execute on function public.create_user_problem_with_timezone(text, text, text, text, text, text[], text, text, text, date, text)
  from public, anon;
grant execute on function public.create_user_problem_with_timezone(text, text, text, text, text, text[], text, text, text, date, text)
  to authenticated;

create function public.rate_new_daily_study_task(
  p_task_id uuid,
  p_rating text,
  p_leetcode_frontend_id text,
  p_leetcode_slug text,
  p_leetcode_url text,
  p_title text,
  p_difficulty text,
  p_leetcode_topics text[]
)
returns public.daily_study_plan_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz;
  v_task public.daily_study_plan_tasks%rowtype;
  v_plan public.daily_study_plans%rowtype;
  v_user_problem_id uuid;
  v_review_event_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_task_id is null or p_rating is null or p_rating not in ('bad', 'ok', 'good')
    or p_leetcode_frontend_id is null or pg_catalog.btrim(p_leetcode_frontend_id) = ''
    or p_leetcode_slug is null or pg_catalog.btrim(p_leetcode_slug) = ''
    or p_title is null or pg_catalog.btrim(p_title) = ''
    or p_difficulty is null or p_difficulty not in ('easy', 'medium', 'hard')
    or p_leetcode_url is null
    or p_leetcode_url <> 'https://leetcode.com/problems/' || p_leetcode_slug || '/' then
    raise exception 'invalid_submission' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-study-plan:' || v_user_id::text, 0)
  );
  v_now := pg_catalog.clock_timestamp();

  select task.* into v_task
  from public.daily_study_plan_tasks task
  join public.daily_study_plans plan on plan.id = task.plan_id and plan.user_id = task.user_id
  join public.user_study_preferences preferences on preferences.user_id = plan.user_id
  where task.id = p_task_id and task.user_id = v_user_id
    and plan.study_date = (v_now at time zone preferences.time_zone)::date
    and v_now >= plan.day_starts_at and v_now < plan.day_ends_at;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v_task.status <> 'pending' then
    raise exception 'task_not_pending' using errcode = 'P0001';
  end if;
  if v_task.kind <> 'new_problem' or v_task.origin <> 'roadmap'
    or v_task.user_problem_id is not null
    or v_task.leetcode_frontend_id is distinct from pg_catalog.btrim(p_leetcode_frontend_id)
    or v_task.leetcode_slug is distinct from p_leetcode_slug then
    raise exception 'stale_task' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.user_problems
    where user_id = v_user_id
      and (leetcode_frontend_id = v_task.leetcode_frontend_id or leetcode_slug = v_task.leetcode_slug)
  ) then
    raise exception 'stale_task' using errcode = 'P0001';
  end if;

  select * into v_plan from public.daily_study_plans
  where id = v_task.plan_id and user_id = v_user_id;

  select created.user_problem_id, created.review_event_id
  into v_user_problem_id, v_review_event_id
  from public.create_user_problem_with_timezone(
    p_leetcode_frontend_id, p_leetcode_slug, p_leetcode_url, p_title, p_difficulty,
    p_leetcode_topics, '', 'practiced', p_rating, v_plan.study_date, v_plan.time_zone
  ) created;

  select task.* into v_task
  from public.daily_study_plan_tasks task
  join public.review_events event on event.id = task.completed_review_event_id
  where task.id = p_task_id and task.plan_id = v_plan.id and task.user_id = v_user_id
    and task.status = 'completed' and task.user_problem_id = v_user_problem_id
    and task.completion_event_id_snapshot = v_review_event_id
    and task.completed_review_event_id = v_review_event_id
    and task.completed_at >= v_plan.day_starts_at and task.completed_at < v_plan.day_ends_at
    and event.user_id = v_user_id and event.user_problem_id = v_user_problem_id
    and event.rating = p_rating;
  if not found then
    raise exception 'study_task_update_failed' using errcode = 'P0001';
  end if;
  return v_task;
end;
$$;

revoke execute on function public.rate_new_daily_study_task(uuid, text, text, text, text, text, text, text[])
  from public, anon;
grant execute on function public.rate_new_daily_study_task(uuid, text, text, text, text, text, text, text[])
  to authenticated;

create function public.correct_review_rating(
  p_review_event_id uuid,
  p_rating text
)
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
  v_new_schedule_version bigint;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
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
  where id = v_event.user_problem_id and user_id = v_user_id
  for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;

  select * into v_event from public.review_events
  where id = p_review_event_id and user_id = v_user_id
  for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;

  if v_now > v_event.correctable_until then
    raise exception 'correction_expired' using errcode = 'P0001';
  end if;
  if v_problem.last_reviewed_at is distinct from v_event.reviewed_at
    or v_problem.total_reviews <> v_event.previous_total_reviews + 1
    or v_problem.schedule_version <> v_event.resulting_schedule_version
    or exists (
      select 1 from public.review_events later
      where later.user_id = v_user_id
        and later.user_problem_id = v_problem.id
        and (later.reviewed_at, later.id) > (v_event.reviewed_at, v_event.id)
    ) then
    raise exception 'stale_review' using errcode = 'P0001';
  end if;

  if v_event.rating = p_rating then
    return query select
      v_event.id, v_event.rating, v_event.new_review_stage,
      v_event.next_review_at, v_event.resulting_schedule_version,
      v_event.correctable_until;
    return;
  end if;

  select transition.new_review_stage, transition.new_next_review_at, transition.new_mastery_score
  into v_new_review_stage, v_new_next_review_at, v_new_mastery_score
  from private.calculate_review_transition(
    v_event.transition_kind, p_rating,
    v_event.previous_review_stage, v_event.previous_mastery_score,
    v_event.reviewed_at, v_event.transition_time_zone
  ) transition;
  v_new_schedule_version := v_problem.schedule_version + 1;

  update public.review_events
  set rating = p_rating,
      new_review_stage = v_new_review_stage,
      next_review_at = v_new_next_review_at,
      resulting_schedule_version = v_new_schedule_version,
      corrected_at = v_now
  where id = v_event.id and user_id = v_user_id;

  update public.user_problems
  set review_stage = v_new_review_stage,
      next_review_at = v_new_next_review_at,
      mastery_score = v_new_mastery_score,
      schedule_version = v_new_schedule_version,
      updated_at = v_now
  where id = v_problem.id and user_id = v_user_id;

  return query select
    v_event.id, p_rating, v_new_review_stage, v_new_next_review_at,
    v_new_schedule_version, v_event.correctable_until;
end;
$$;

revoke execute on function public.correct_review_rating(uuid, text) from public, anon;
grant execute on function public.correct_review_rating(uuid, text) to authenticated;

commit;
