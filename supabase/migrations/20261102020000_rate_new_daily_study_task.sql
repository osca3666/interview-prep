begin;

-- Canonical metadata is resolved by the Server Action. SQL enforces task identity
-- and delegates all practice/scheduling calculations to the existing transition.
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
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_task_id is null or p_rating is null or p_rating not in ('again', 'good', 'easy')
    or p_leetcode_frontend_id is null or pg_catalog.btrim(p_leetcode_frontend_id) = ''
    or p_leetcode_slug is null or pg_catalog.btrim(p_leetcode_slug) = ''
    or p_title is null or pg_catalog.btrim(p_title) = ''
    or p_difficulty is null or p_difficulty not in ('easy', 'medium', 'hard')
    or p_leetcode_url is null
    or p_leetcode_url <> 'https://leetcode.com/problems/' || p_leetcode_slug || '/' then
    raise exception 'invalid_submission' using errcode = 'P0001';
  end if;

  -- Same advisory-before-problem-before-task ordering as creation, review and deferral.
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
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
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

  select created.user_problem_id into v_user_problem_id
  from public.create_user_problem_with_timezone(
    p_leetcode_frontend_id, p_leetcode_slug, p_leetcode_url, p_title, p_difficulty,
    p_leetcode_topics, '', 'practiced', p_rating, v_plan.study_date, v_plan.time_zone
  ) created;

  -- Verify the exact task/event, not aggregate review counts. Any failure rolls
  -- back the nested problem creation, event and task update together.
  select task.* into v_task
  from public.daily_study_plan_tasks task
  join public.review_events event on event.id = task.completed_review_event_id
  where task.id = p_task_id and task.plan_id = v_plan.id and task.user_id = v_user_id
    and task.status = 'completed' and task.user_problem_id = v_user_problem_id
    and task.completion_event_id_snapshot = event.id
    and task.completed_at >= v_plan.day_starts_at and task.completed_at < v_plan.day_ends_at
    and event.user_id = v_user_id and event.user_problem_id = v_user_problem_id
    and event.rating = p_rating
    and event.reviewed_at = v_plan.study_date::timestamp at time zone v_plan.time_zone;
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

commit;
