begin;

create or replace function private.record_daily_study_activity(
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
  v_replaced_task public.daily_study_plan_tasks%rowtype;
  v_problem public.user_problems%rowtype;
  v_event public.review_events%rowtype;
  v_status text := 'pending';
  v_updated integer;
  v_next_position integer;
  v_category text;
  v_kind text;
  v_has_plan boolean := false;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if p_activity is null or p_activity not in ('review', 'practiced', 'scheduled', 'snooze') then
    raise exception 'invalid_submission' using errcode = 'P0001';
  end if;
  select * into v_problem from public.user_problems
  where id = p_user_problem_id and user_id = v_user_id;
  if not found then raise exception 'study_task_update_failed' using errcode = 'P0001'; end if;
  if p_activity in ('review', 'practiced') then
    select * into v_event from public.review_events
    where id = p_review_event_id and user_id = v_user_id and user_problem_id = v_problem.id;
    if not found then raise exception 'study_task_update_failed' using errcode = 'P0001'; end if;
  end if;

  select plan.* into v_plan
  from public.daily_study_plans plan
  join public.user_study_preferences preferences on preferences.user_id = plan.user_id
  where plan.user_id = v_user_id
    and plan.study_date = (v_now at time zone preferences.time_zone)::date
    and v_now >= plan.day_starts_at and v_now < plan.day_ends_at
  for update of plan;
  v_has_plan := found;
  if not v_has_plan then
    if p_activity in ('review', 'practiced') then
      perform private.record_v1_manual_review_allocation(v_event, v_problem);
    end if;
    return;
  end if;

  select * into v_task from public.daily_study_plan_tasks task
  where task.plan_id = v_plan.id and task.user_id = v_user_id and task.status = 'pending'
    and task.leetcode_slug = v_problem.leetcode_slug
    and (task.leetcode_frontend_id is null or task.leetcode_frontend_id = v_problem.leetcode_frontend_id)
    and (task.user_problem_id = v_problem.id or (
      task.user_problem_id is null and task.origin = 'roadmap' and task.kind = 'new_problem'
      and task.leetcode_frontend_id = v_problem.leetcode_frontend_id
    ))
  order by task.position limit 1 for update;

  if found then
    if p_activity in ('review', 'practiced') then
      if (p_activity = 'review' and v_event.reviewed_at >= v_plan.day_starts_at
          and v_event.reviewed_at < v_plan.day_ends_at)
        or (p_activity = 'practiced'
          and p_practice_date = (v_now at time zone p_practice_time_zone)::date) then
        v_status := 'completed';
      end if;
    elsif p_activity = 'snooze' then
      v_status := 'deferred';
    end if;
    update public.daily_study_plan_tasks set
      user_problem_id = v_problem.id, status = v_status,
      completed_review_event_id = case when v_status = 'completed' then v_event.id else null end,
      completion_event_id_snapshot = case when v_status = 'completed' then v_event.id else null end,
      completed_at = case when v_status = 'completed' then v_now else null end,
      deferred_at = case when v_status = 'deferred' then v_now else null end
    where id = v_task.id and plan_id = v_plan.id and user_id = v_user_id and status = 'pending';
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then raise exception 'study_task_update_failed' using errcode = 'P0001'; end if;
    if v_status = 'completed' and v_task.assignment_source <> 'generated' then
      perform private.record_v1_manual_review_allocation(v_event, v_problem);
    end if;
    return;
  end if;

  if exists (
    select 1 from public.daily_study_plan_tasks task
    where task.plan_id = v_plan.id and task.user_id = v_user_id
      and task.leetcode_slug = v_problem.leetcode_slug
      and (task.leetcode_frontend_id is null or task.leetcode_frontend_id = v_problem.leetcode_frontend_id)
  ) then
    if p_activity in ('review', 'practiced') then
      perform private.record_v1_manual_review_allocation(v_event, v_problem);
    end if;
    return;
  end if;

  if p_activity = 'scheduled' then
    if p_practice_date is distinct from v_plan.study_date
      or v_problem.lifecycle_state <> 'active' or v_problem.total_reviews <> 0 then return; end if;
    select coalesce(pg_catalog.max(position), -1) + 1 into v_next_position
    from public.daily_study_plan_tasks where plan_id = v_plan.id and user_id = v_user_id;
    insert into public.daily_study_plan_tasks(
      plan_id, user_id, position, kind, origin, status, user_problem_id,
      original_user_problem_id, leetcode_frontend_id, leetcode_slug, title,
      difficulty, leetcode_url, mastery_score_snapshot, next_review_at_snapshot,
      schedule_version_snapshot, assignment_source
    ) values (
      v_plan.id, v_user_id, v_next_position, 'new_problem', 'tracked', 'pending',
      v_problem.id, v_problem.id, v_problem.leetcode_frontend_id, v_problem.leetcode_slug,
      v_problem.title, v_problem.difficulty, v_problem.leetcode_url,
      v_problem.mastery_score, v_problem.next_review_at, v_problem.schedule_version,
      'manual_scheduled'
    );
    update public.daily_study_plans set planned_task_count = planned_task_count + 1
    where id = v_plan.id and user_id = v_user_id;
    return;
  end if;

  if p_activity not in ('review', 'practiced') or v_plan.selection_version <> 'v1-policy'
    or v_event.reviewed_at < v_plan.day_starts_at or v_event.reviewed_at >= v_plan.day_ends_at then
    return;
  end if;
  v_category := v_event.pre_practice_problem_type;
  if v_category not in ('new', 'review') then return; end if;
  v_kind := case
    when v_category = 'new' then 'new_problem'
    when v_event.pre_practice_review_pool = 'imported' then 'calibration'
    else 'review'
  end;
  select coalesce(pg_catalog.max(position), -1) + 1 into v_next_position
  from public.daily_study_plan_tasks where plan_id = v_plan.id and user_id = v_user_id;

  select * into v_replaced_task from public.daily_study_plan_tasks task
  where task.plan_id = v_plan.id and task.user_id = v_user_id
    and task.status = 'pending' and task.assignment_source = 'generated'
    and ((v_category = 'new' and task.kind = 'new_problem')
      or (v_category = 'review' and task.kind in ('review', 'calibration')))
  order by task.position desc limit 1 for update;
  if found then
    update public.daily_study_plan_tasks set status = 'unassigned', unassigned_at = v_now,
      unassignment_reason = 'replaced_by_manual_practice'
    where id = v_replaced_task.id and status = 'pending';
    update public.review_allocation_entries set active = false, reversed_at = v_now,
      reversal_reason = 'task_unassigned'
    where daily_study_plan_task_id_snapshot = v_replaced_task.id and active;
  else
    update public.daily_study_plans set planned_task_count = planned_task_count + 1
    where id = v_plan.id and user_id = v_user_id;
  end if;

  insert into public.daily_study_plan_tasks(
    plan_id, user_id, position, kind, origin, status, user_problem_id,
    original_user_problem_id, leetcode_frontend_id, leetcode_slug, title,
    difficulty, leetcode_url, mastery_score_snapshot, next_review_at_snapshot,
    schedule_version_snapshot, assignment_source, review_pool_snapshot,
    completed_review_event_id, completion_event_id_snapshot, completed_at
  ) values (
    v_plan.id, v_user_id, v_next_position, v_kind, 'tracked', 'completed',
    v_problem.id, v_problem.id, v_problem.leetcode_frontend_id, v_problem.leetcode_slug,
    v_problem.title, v_problem.difficulty, v_problem.leetcode_url,
    v_event.previous_mastery_score,
    coalesce(v_event.previous_next_review_at, v_event.next_review_at),
    greatest(0, v_event.resulting_schedule_version - 1),
    'manual_today', v_event.pre_practice_review_pool,
    v_event.id, v_event.id, v_now
  );
  perform private.record_v1_manual_review_allocation(v_event, v_problem);
end;
$$;

revoke all on function private.record_daily_study_activity(uuid, text, uuid, date, text)
  from public, anon, authenticated;

commit;
