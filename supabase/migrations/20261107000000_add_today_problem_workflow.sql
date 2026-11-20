begin;

alter table public.daily_study_plan_tasks
  drop constraint daily_study_plan_tasks_assignment_source_check,
  add constraint daily_study_plan_tasks_assignment_source_check
    check (
      assignment_source = 'generated'
      or (
        assignment_source = 'manual_scheduled'
        and kind = 'new_problem'
        and origin = 'tracked'
      )
      or (
        assignment_source = 'manual_today'
        and origin = 'tracked'
      )
    );

-- Preserve the public signature and scheduler. A future-due problem may be
-- reviewed only when the user explicitly assigned its pending task today.
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
  v_correctable_until timestamptz := v_reviewed_at + interval '5 minutes';
  v_manual_today boolean := false;
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

  select exists (
    select 1
    from public.daily_study_plan_tasks task
    join public.daily_study_plans plan
      on plan.id = task.plan_id and plan.user_id = task.user_id
    where task.user_id = v_user_id
      and task.user_problem_id = v_problem.id
      and task.status = 'pending'
      and task.assignment_source = 'manual_today'
      and v_reviewed_at >= plan.day_starts_at
      and v_reviewed_at < plan.day_ends_at
  ) into v_manual_today;

  if v_problem.next_review_at > v_reviewed_at and not v_manual_today then
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

-- Preserve Skip today's public contract. The same explicit manual assignment
-- is the only exception to the ordinary due-date check.
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
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_manual_today boolean := false;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_user_problem_id is null or p_expected_schedule_version is null or p_time_zone is null then
    raise exception 'invalid_submission' using errcode = 'P0001';
  end if;
  if v_time_zone = '' or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = v_time_zone
  ) then
    raise exception 'invalid_time_zone' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-study-plan:' || v_user_id::text, 0)
  );

  select * into v_problem
  from public.user_problems
  where id = p_user_problem_id and user_id = v_user_id
  for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v_problem.lifecycle_state <> 'active' then
    raise exception 'problem_not_active' using errcode = 'P0001';
  end if;
  if v_problem.schedule_version <> p_expected_schedule_version then
    raise exception 'stale_review' using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.daily_study_plan_tasks task
    join public.daily_study_plans plan
      on plan.id = task.plan_id and plan.user_id = task.user_id
    where task.user_id = v_user_id
      and task.user_problem_id = v_problem.id
      and task.status = 'pending'
      and task.assignment_source = 'manual_today'
      and v_now >= plan.day_starts_at
      and v_now < plan.day_ends_at
  ) into v_manual_today;

  if v_problem.next_review_at > v_now and not v_manual_today then
    raise exception 'problem_not_due' using errcode = 'P0001';
  end if;

  update public.user_problems
  set next_review_at = (
        ((v_now at time zone v_time_zone)::date + 1)::timestamp
        at time zone v_time_zone
      ),
      schedule_version = schedule_version + 1,
      updated_at = v_now
  where id = p_user_problem_id
    and user_id = v_user_id
    and lifecycle_state = 'active'
    and schedule_version = p_expected_schedule_version
    and (next_review_at <= v_now or v_manual_today);
  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception 'stale_review' using errcode = 'P0001';
  end if;

  perform private.record_daily_study_activity(v_problem.id, 'snooze', null, null, null);
end;
$$;

revoke execute on function public.snooze_problem_review(uuid, bigint, text) from public, anon;
grant execute on function public.snooze_problem_review(uuid, bigint, text) to authenticated;

create function public.add_problem_to_today(
  p_intent text,
  p_leetcode_frontend_id text,
  p_leetcode_slug text,
  p_leetcode_url text,
  p_title text,
  p_difficulty text,
  p_leetcode_topics text[]
)
returns table (
  task_id uuid,
  task_status text,
  outcome text,
  review_event_id uuid,
  correctable_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz;
  v_plan public.daily_study_plans%rowtype;
  v_task public.daily_study_plan_tasks%rowtype;
  v_problem public.user_problems%rowtype;
  v_created record;
  v_review record;
  v_kind text;
  v_position integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_intent not in ('todo', 'done')
    or p_leetcode_frontend_id is null or pg_catalog.btrim(p_leetcode_frontend_id) = ''
    or p_leetcode_slug is null or pg_catalog.btrim(p_leetcode_slug) = ''
    or p_title is null or pg_catalog.btrim(p_title) = ''
    or p_difficulty not in ('easy', 'medium', 'hard')
    or p_leetcode_url <> 'https://leetcode.com/problems/' || p_leetcode_slug || '/' then
    raise exception 'invalid_submission' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-study-plan:' || v_user_id::text, 0)
  );
  v_now := pg_catalog.clock_timestamp();

  select plan.* into v_plan
  from public.daily_study_plans plan
  join public.user_study_preferences preferences on preferences.user_id = plan.user_id
  where plan.user_id = v_user_id
    and plan.study_date = (v_now at time zone preferences.time_zone)::date
    and v_now >= plan.day_starts_at and v_now < plan.day_ends_at
  for update of plan;
  if not found then
    raise exception 'plan_not_found' using errcode = 'P0001';
  end if;

  select task.* into v_task
  from public.daily_study_plan_tasks task
  where task.plan_id = v_plan.id and task.user_id = v_user_id
    and (
      task.leetcode_frontend_id = pg_catalog.btrim(p_leetcode_frontend_id)
      or task.leetcode_slug = p_leetcode_slug
    )
  order by task.position
  limit 1
  for update;

  if found then
    if v_task.status = 'completed' then
      raise exception 'already_completed_today' using errcode = 'P0001';
    elsif v_task.status = 'deferred' then
      raise exception 'already_deferred_today' using errcode = 'P0001';
    elsif p_intent = 'todo' then
      raise exception 'already_in_today' using errcode = 'P0001';
    end if;

    if v_task.user_problem_id is null then
      select rated.* into v_task
      from public.rate_new_daily_study_task(
        v_task.id, 'ok', pg_catalog.btrim(p_leetcode_frontend_id), p_leetcode_slug,
        p_leetcode_url, p_title, p_difficulty, coalesce(p_leetcode_topics, '{}'::text[])
      ) rated;
      select event.correctable_until into correctable_until
      from public.review_events event
      where event.id = v_task.completed_review_event_id and event.user_id = v_user_id;
      task_id := v_task.id;
      task_status := v_task.status;
      outcome := 'marked_done';
      review_event_id := v_task.completed_review_event_id;
      return next;
      return;
    end if;
  end if;

  select problem.* into v_problem
  from public.user_problems problem
  where problem.user_id = v_user_id
    and (
      problem.leetcode_frontend_id = pg_catalog.btrim(p_leetcode_frontend_id)
      or problem.leetcode_slug = p_leetcode_slug
    )
  order by problem.id
  limit 1
  for update;

  if found and v_problem.lifecycle_state <> 'active' then
    raise exception 'problem_not_active' using errcode = 'P0001';
  end if;

  if not found and p_intent = 'done' then
    select created.* into v_created
    from public.create_user_problem_with_timezone(
      pg_catalog.btrim(p_leetcode_frontend_id), p_leetcode_slug, p_leetcode_url,
      p_title, p_difficulty, coalesce(p_leetcode_topics, '{}'::text[]), '',
      'practiced', 'ok', v_plan.study_date, v_plan.time_zone
    ) created;

    select * into v_problem from public.user_problems
    where id = v_created.user_problem_id and user_id = v_user_id;
    select coalesce(pg_catalog.max(task.position), -1) + 1 into v_position
    from public.daily_study_plan_tasks task
    where task.plan_id = v_plan.id and task.user_id = v_user_id;

    insert into public.daily_study_plan_tasks(
      plan_id, user_id, position, kind, origin, status,
      user_problem_id, original_user_problem_id,
      leetcode_frontend_id, leetcode_slug, title, difficulty, leetcode_url,
      mastery_score_snapshot, next_review_at_snapshot, schedule_version_snapshot,
      assignment_source, completed_review_event_id, completion_event_id_snapshot,
      completed_at
    ) values (
      v_plan.id, v_user_id, v_position, 'new_problem', 'tracked', 'completed',
      v_problem.id, v_problem.id,
      v_problem.leetcode_frontend_id, v_problem.leetcode_slug, v_problem.title,
      v_problem.difficulty, v_problem.leetcode_url, 0, v_plan.day_starts_at,
      0, 'manual_today', v_created.review_event_id, v_created.review_event_id, v_now
    ) returning * into v_task;

    update public.daily_study_plans
    set planned_task_count = planned_task_count + 1
    where id = v_plan.id and user_id = v_user_id;

    task_id := v_task.id;
    task_status := v_task.status;
    outcome := 'marked_done';
    review_event_id := v_created.review_event_id;
    correctable_until := v_created.correctable_until;
    return next;
    return;
  end if;

  if not found then
    select created.* into v_created
    from public.create_user_problem_with_timezone(
      pg_catalog.btrim(p_leetcode_frontend_id), p_leetcode_slug, p_leetcode_url,
      p_title, p_difficulty, coalesce(p_leetcode_topics, '{}'::text[]), '',
      'scheduled', null, v_plan.study_date, v_plan.time_zone
    ) created;
    select * into v_problem from public.user_problems
    where id = v_created.user_problem_id and user_id = v_user_id;
    select task.* into v_task from public.daily_study_plan_tasks task
    where task.plan_id = v_plan.id and task.user_id = v_user_id
      and task.user_problem_id = v_problem.id
    order by task.position limit 1 for update;
    if not found then
      raise exception 'study_task_update_failed' using errcode = 'P0001';
    end if;
    update public.daily_study_plan_tasks
    set assignment_source = 'manual_today'
    where id = v_task.id
    returning * into v_task;
  elsif v_task.id is null then
    v_kind := case
      when v_problem.total_reviews > 0 then 'review'
      when v_problem.source = 'leetcode_import'
        and v_problem.external_practice_status = 'accepted' then 'calibration'
      else 'new_problem'
    end;
    select coalesce(pg_catalog.max(task.position), -1) + 1 into v_position
    from public.daily_study_plan_tasks task
    where task.plan_id = v_plan.id and task.user_id = v_user_id;

    insert into public.daily_study_plan_tasks(
      plan_id, user_id, position, kind, origin, status,
      user_problem_id, original_user_problem_id,
      leetcode_frontend_id, leetcode_slug, title, difficulty, leetcode_url,
      mastery_score_snapshot, next_review_at_snapshot, schedule_version_snapshot,
      assignment_source
    ) values (
      v_plan.id, v_user_id, v_position, v_kind, 'tracked', 'pending',
      v_problem.id, v_problem.id,
      v_problem.leetcode_frontend_id, v_problem.leetcode_slug, v_problem.title,
      v_problem.difficulty, v_problem.leetcode_url, v_problem.mastery_score,
      v_problem.next_review_at, v_problem.schedule_version, 'manual_today'
    ) returning * into v_task;

    update public.daily_study_plans
    set planned_task_count = planned_task_count + 1
    where id = v_plan.id and user_id = v_user_id;
  end if;

  if p_intent = 'todo' then
    task_id := v_task.id;
    task_status := v_task.status;
    outcome := 'added_todo';
    review_event_id := null;
    correctable_until := null;
    return next;
    return;
  end if;

  select reviewed.* into v_review
  from public.submit_problem_review(v_problem.id, 'ok', v_problem.schedule_version) reviewed;

  select task.* into v_task
  from public.daily_study_plan_tasks task
  where task.id = v_task.id and task.plan_id = v_plan.id and task.user_id = v_user_id
    and task.status = 'completed'
    and task.completed_review_event_id = v_review.review_event_id;
  if not found then
    raise exception 'study_task_update_failed' using errcode = 'P0001';
  end if;

  task_id := v_task.id;
  task_status := v_task.status;
  outcome := 'marked_done';
  review_event_id := v_review.review_event_id;
  correctable_until := v_review.correctable_until;
  return next;
end;
$$;

revoke execute on function public.add_problem_to_today(text, text, text, text, text, text, text[])
  from public, anon;
grant execute on function public.add_problem_to_today(text, text, text, text, text, text, text[])
  to authenticated;

commit;
