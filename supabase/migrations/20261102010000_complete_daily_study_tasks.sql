begin;

alter table public.daily_study_plan_tasks
  add column completed_review_event_id uuid references public.review_events(id) on delete set null,
  add column completion_event_id_snapshot uuid,
  add column completed_at timestamptz,
  add column deferred_at timestamptz,
  add constraint daily_study_task_completion_event_key unique (completed_review_event_id),
  add constraint daily_study_task_completion_snapshot_key unique (completion_event_id_snapshot),
  add constraint daily_study_task_activity_check check (
    (status = 'pending' and completed_review_event_id is null and completion_event_id_snapshot is null
      and completed_at is null and deferred_at is null)
    or (status = 'completed' and completion_event_id_snapshot is not null
      and completed_at is not null and deferred_at is null
      and (completed_review_event_id is null or completed_review_event_id = completion_event_id_snapshot))
    or (status = 'deferred' and completed_review_event_id is null and completion_event_id_snapshot is null
      and completed_at is null and deferred_at is not null)
  );

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Called only by protected RPCs, after taking the daily-plan advisory lock before any problem lock.
create function private.record_daily_study_activity(
  p_user_problem_id uuid,
  p_activity text,
  p_review_event_id uuid,
  p_practice_date date,
  p_practice_time_zone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_plan public.daily_study_plans%rowtype;
  v_task public.daily_study_plan_tasks%rowtype;
  v_problem public.user_problems%rowtype;
  v_event public.review_events%rowtype;
  v_status text := 'pending';
  v_updated integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_activity is null or p_activity not in ('review', 'practiced', 'scheduled', 'snooze') then
    raise exception 'invalid_submission' using errcode = 'P0001';
  end if;

  select plan.* into v_plan
  from public.daily_study_plans plan
  join public.user_study_preferences preferences on preferences.user_id = plan.user_id
  where plan.user_id = v_user_id
    and plan.study_date = (v_now at time zone preferences.time_zone)::date
    and v_now >= plan.day_starts_at and v_now < plan.day_ends_at;
  if not found then return; end if;

  select * into v_problem from public.user_problems
    where id = p_user_problem_id and user_id = v_user_id;
  if not found then
    raise exception 'study_task_update_failed' using errcode = 'P0001';
  end if;

  select * into v_task from public.daily_study_plan_tasks task
  where task.plan_id = v_plan.id and task.user_id = v_user_id and task.status = 'pending'
    and task.leetcode_slug = v_problem.leetcode_slug
    and (task.leetcode_frontend_id is null
      or task.leetcode_frontend_id = v_problem.leetcode_frontend_id)
    and (
      task.user_problem_id = v_problem.id
      or (task.user_problem_id is null and task.origin = 'roadmap' and task.kind = 'new_problem'
        and task.leetcode_frontend_id = v_problem.leetcode_frontend_id)
    )
  order by task.position limit 1 for update;
  if not found then return; end if;

  if p_activity in ('review', 'practiced') then
    select * into v_event from public.review_events
      where id = p_review_event_id and user_id = v_user_id and user_problem_id = v_problem.id;
    if not found then
      raise exception 'study_task_update_failed' using errcode = 'P0001';
    end if;
    if p_activity = 'review' then
      if v_event.reviewed_at >= v_plan.day_starts_at and v_event.reviewed_at < v_plan.day_ends_at then
        v_status := 'completed';
      end if;
    else
      -- Track Problem backdates event timestamps to local midnight. Only a current-day
      -- practice declaration earns credit; the actual transaction belongs to the saved study day.
      if p_practice_date = (v_now at time zone p_practice_time_zone)::date then
        v_status := 'completed';
      end if;
    end if;
  elsif p_activity = 'snooze' then
    v_status := 'deferred';
  end if;

  update public.daily_study_plan_tasks
  set user_problem_id = v_problem.id,
      status = v_status,
      completed_review_event_id = case when v_status = 'completed' then v_event.id else null end,
      completion_event_id_snapshot = case when v_status = 'completed' then v_event.id else null end,
      completed_at = case when v_status = 'completed' then v_now else null end,
      deferred_at = case when v_status = 'deferred' then v_now else null end
  where id = v_task.id and plan_id = v_plan.id and user_id = v_user_id and status = 'pending';
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'study_task_update_failed' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function private.record_daily_study_activity(uuid, text, uuid, date, text)
  from public, anon, authenticated;

create function public.defer_daily_study_plan_task(p_task_id uuid)
returns public.daily_study_plan_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz;
  v_task public.daily_study_plan_tasks%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_task_id is null then
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
    and v_now >= plan.day_starts_at and v_now < plan.day_ends_at
    and task.kind = 'new_problem' and task.origin = 'roadmap' and task.user_problem_id is null
  for update of task;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_task.status = 'deferred' then return v_task; end if;
  if v_task.status <> 'pending' then
    raise exception 'task_not_pending' using errcode = 'P0001';
  end if;

  update public.daily_study_plan_tasks
    set status = 'deferred', deferred_at = v_now
    where id = v_task.id and user_id = v_user_id and status = 'pending'
    returning * into v_task;
  if not found then
    raise exception 'study_task_update_failed' using errcode = 'P0001';
  end if;
  return v_task;
end;
$$;

revoke execute on function public.defer_daily_study_plan_task(uuid) from public, anon;
grant execute on function public.defer_daily_study_plan_task(uuid) to authenticated;

create or replace function public.submit_problem_review(
  p_user_problem_id uuid,
  p_rating text,
  p_expected_schedule_version bigint
)
returns table (
  new_review_stage integer,
  new_next_review_at timestamptz,
  new_schedule_version bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_problem public.user_problems%rowtype;
  v_reviewed_at timestamptz := pg_catalog.now();
  v_review_event_id uuid;
  v_new_review_stage integer;
  v_new_next_review_at timestamptz;
  v_new_schedule_version bigint;
  v_new_mastery_score integer;
  v_new_total_reviews integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'not_authenticated'
      using errcode = 'P0001';
  end if;

  if p_user_problem_id is null then
    raise exception 'problem_not_due'
      using errcode = 'P0001';
  end if;

  if p_rating is null
     or p_rating not in ('again', 'hard', 'good', 'easy') then
    raise exception 'invalid_rating'
      using errcode = 'P0001';
  end if;

  if p_expected_schedule_version is null
     or p_expected_schedule_version < 0 then
    raise exception 'stale_review'
      using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-study-plan:' || v_user_id::text, 0)
  );

  select *
    into v_problem
  from public.user_problems
  where id = p_user_problem_id
    and user_id = v_user_id
    and lifecycle_state = 'active'
  for update;

  if not found then
    raise exception 'problem_not_due'
      using errcode = 'P0001';
  end if;

  if v_problem.schedule_version <> p_expected_schedule_version then
    raise exception 'stale_review'
      using errcode = 'P0001';
  end if;

  if v_problem.next_review_at > v_reviewed_at then
    raise exception 'problem_not_due'
      using errcode = 'P0001';
  end if;

  v_new_review_stage := case p_rating
    when 'again' then 0
    when 'hard' then v_problem.review_stage
    when 'good' then v_problem.review_stage + 1
    when 'easy' then v_problem.review_stage + 2
  end;

  v_new_next_review_at := v_reviewed_at + case
    when p_rating = 'again' then interval '1 day'
    when v_new_review_stage = 0 then interval '2 days'
    when v_new_review_stage = 1 then interval '3 days'
    when v_new_review_stage = 2 then interval '7 days'
    when v_new_review_stage = 3 then interval '14 days'
    when v_new_review_stage = 4 then interval '30 days'
    else interval '60 days'
  end;

  v_new_schedule_version := v_problem.schedule_version + 1;

  v_new_mastery_score := case p_rating
    when 'again' then greatest(0, v_problem.mastery_score - 2)
    when 'hard' then least(10, v_problem.mastery_score + 1)
    when 'good' then least(10, v_problem.mastery_score + 2)
    when 'easy' then least(10, v_problem.mastery_score + 3)
  end;

  v_new_total_reviews := v_problem.total_reviews + 1;

  insert into public.review_events (
    user_id,
    user_problem_id,
    rating,
    previous_review_stage,
    new_review_stage,
    previous_next_review_at,
    next_review_at,
    reviewed_at
  )
  values (
    v_user_id,
    v_problem.id,
    p_rating,
    v_problem.review_stage,
    v_new_review_stage,
    v_problem.next_review_at,
    v_new_next_review_at,
    v_reviewed_at
  ) returning id into v_review_event_id;

  update public.user_problems
  set
    review_stage = v_new_review_stage,
    last_reviewed_at = v_reviewed_at,
    next_review_at = v_new_next_review_at,
    updated_at = v_reviewed_at,
    schedule_version = v_new_schedule_version,
    mastery_score = v_new_mastery_score,
    total_reviews = v_new_total_reviews
  where id = v_problem.id
    and user_id = v_user_id;

  perform private.record_daily_study_activity(v_problem.id, 'review', v_review_event_id, null, null);

  return query select
    v_new_review_stage,
    v_new_next_review_at,
    v_new_schedule_version;
end;
$$;

revoke execute on function public.submit_problem_review(uuid, text, bigint) from public;
revoke execute on function public.submit_problem_review(uuid, text, bigint) from anon;
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
  review_stage integer,
  next_review_at timestamptz,
  mastery_score integer,
  total_reviews integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
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
  v_review_interval_days integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'not_authenticated'
      using errcode = 'P0001';
  end if;

  if p_leetcode_frontend_id is null
     or pg_catalog.btrim(p_leetcode_frontend_id) = '' then
    raise exception 'invalid_submission'
      using errcode = 'P0001';
  end if;

  v_time_zone := pg_catalog.btrim(p_time_zone);

  if p_time_zone is null
     or v_time_zone = ''
     or not exists (
       select 1
       from pg_catalog.pg_timezone_names
       where name = v_time_zone
     ) then
    raise exception 'invalid_time_zone'
      using errcode = 'P0001';
  end if;

  if p_start_mode is null
     or p_start_mode not in ('practiced', 'scheduled') then
    raise exception 'invalid_start_mode'
      using errcode = 'P0001';
  end if;

  if p_start_date is null then
    raise exception 'invalid_date'
      using errcode = 'P0001';
  end if;

  v_user_today := (pg_catalog.now() at time zone v_time_zone)::date;

  if p_start_mode = 'practiced'
     and p_start_date > v_user_today then
    raise exception 'invalid_date'
      using errcode = 'P0001';
  end if;

  if p_start_mode = 'scheduled'
     and p_start_date < v_user_today then
    raise exception 'invalid_date'
      using errcode = 'P0001';
  end if;

  if p_start_mode = 'practiced'
     and (p_rating is null
          or p_rating not in ('again', 'hard', 'good', 'easy')) then
    raise exception 'invalid_rating'
      using errcode = 'P0001';
  end if;

  if p_start_mode = 'practiced' then
    v_reviewed_at := p_start_date::timestamp at time zone v_time_zone;

    v_review_stage := case p_rating
      when 'again' then 0
      when 'hard' then 0
      when 'good' then 1
      when 'easy' then 2
    end;

    v_review_interval_days := case p_rating
      when 'again' then 1
      when 'hard' then 2
      when 'good' then 3
      when 'easy' then 7
    end;

    v_next_review_at := (p_start_date + v_review_interval_days)::timestamp at time zone v_time_zone;

    v_mastery_score := case p_rating
      when 'again' then 0
      when 'hard' then 1
      when 'good' then 2
      when 'easy' then 3
    end;

    v_total_reviews := 1;
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
      user_id,
      leetcode_frontend_id,
      leetcode_slug,
      leetcode_url,
      title,
      difficulty,
      leetcode_topics,
      notes,
      review_stage,
      last_reviewed_at,
      next_review_at,
      mastery_score,
      total_reviews
    )
    values (
      v_user_id,
      pg_catalog.btrim(p_leetcode_frontend_id),
      p_leetcode_slug,
      p_leetcode_url,
      p_title,
      p_difficulty,
      coalesce(p_leetcode_topics, '{}'::text[]),
      p_notes,
      v_review_stage,
      v_reviewed_at,
      v_next_review_at,
      v_mastery_score,
      v_total_reviews
    )
    returning id into v_user_problem_id;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;

      if v_constraint_name in (
        'user_problems_user_id_leetcode_slug_key',
        'user_problems_user_id_leetcode_frontend_id_key'
      ) then
        raise exception 'duplicate_problem'
          using errcode = 'P0001';
      end if;

      raise;
  end;

  if p_start_mode = 'practiced' then
    insert into public.review_events (
      user_id,
      user_problem_id,
      rating,
      previous_review_stage,
      new_review_stage,
      previous_next_review_at,
      next_review_at,
      reviewed_at
    )
    values (
      v_user_id,
      v_user_problem_id,
      p_rating,
      0,
      v_review_stage,
      null,
      v_next_review_at,
      v_reviewed_at
    ) returning id into v_review_event_id;
  end if;

  perform private.record_daily_study_activity(
    v_user_problem_id, p_start_mode, v_review_event_id, p_start_date, v_time_zone
  );

  return query select
    v_user_problem_id,
    v_review_stage,
    v_next_review_at,
    v_mastery_score,
    v_total_reviews;
end;
$$;

revoke execute on function public.create_user_problem_with_timezone(text, text, text, text, text, text[], text, text, text, date, text) from public;
revoke execute on function public.create_user_problem_with_timezone(text, text, text, text, text, text[], text, text, text, date, text) from anon;
grant execute on function public.create_user_problem_with_timezone(text, text, text, text, text, text[], text, text, text, date, text) to authenticated;


create or replace function public.snooze_problem_review(
  p_user_problem_id uuid,
  p_expected_schedule_version bigint,
  p_time_zone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_problem public.user_problems%rowtype;
  v_updated_count integer;
  v_time_zone text := pg_catalog.btrim(p_time_zone);
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if p_user_problem_id is null
    or p_expected_schedule_version is null
    or p_time_zone is null
  then
    raise exception 'invalid_submission' using errcode = 'P0001';
  end if;

  if v_time_zone = ''
    or not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = v_time_zone
  ) then
    raise exception 'invalid_time_zone' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-study-plan:' || v_user_id::text, 0)
  );

  select *
  into v_problem
  from public.user_problems
  where id = p_user_problem_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if v_problem.lifecycle_state <> 'active' then
    raise exception 'problem_not_active' using errcode = 'P0001';
  end if;

  if v_problem.schedule_version <> p_expected_schedule_version then
    raise exception 'stale_review' using errcode = 'P0001';
  end if;

  if v_problem.next_review_at > pg_catalog.now() then
    raise exception 'problem_not_due' using errcode = 'P0001';
  end if;

  update public.user_problems
  set
    next_review_at = (
      ((pg_catalog.now() at time zone v_time_zone)::date + 1)::timestamp
      at time zone v_time_zone
    ),
    schedule_version = schedule_version + 1,
    updated_at = pg_catalog.now()
  where id = p_user_problem_id
    and user_id = v_user_id
    and lifecycle_state = 'active'
    and next_review_at <= pg_catalog.now()
    and schedule_version = p_expected_schedule_version;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception 'stale_review' using errcode = 'P0001';
  end if;
  perform private.record_daily_study_activity(v_problem.id, 'snooze', null, null, null);
end;
$$;

revoke execute on function public.snooze_problem_review(uuid, bigint, text) from public;
revoke execute on function public.snooze_problem_review(uuid, bigint, text) from anon;
grant execute on function public.snooze_problem_review(uuid, bigint, text) to authenticated;


commit;

