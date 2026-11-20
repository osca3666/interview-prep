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
        and (
          origin = 'tracked'
          or (origin = 'roadmap' and kind = 'new_problem')
        )
      )
    );

-- Keep the already-tested manual behavior intact behind the unified public RPC.
alter function public.add_problem_to_today(text, text, text, text, text, text, text[])
  set schema private;
alter function private.add_problem_to_today(text, text, text, text, text, text, text[])
  rename to add_manual_problem_to_today;
revoke all on function private.add_manual_problem_to_today(text, text, text, text, text, text, text[])
  from public, anon, authenticated;

create function public.add_problem_to_today(
  p_intent text,
  p_leetcode_frontend_id text,
  p_leetcode_slug text,
  p_leetcode_url text,
  p_title text,
  p_difficulty text,
  p_leetcode_topics text[],
  p_selection_source text default 'manual',
  p_expected_schedule_version bigint default null,
  p_roadmap_order integer default null
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
  v_position integer;
begin
  if p_selection_source = 'manual' then
    return query
      select manual.task_id, manual.task_status, manual.outcome,
        manual.review_event_id, manual.correctable_until
      from private.add_manual_problem_to_today(
        p_intent, p_leetcode_frontend_id, p_leetcode_slug,
        p_leetcode_url, p_title, p_difficulty, p_leetcode_topics
      ) manual;
    return;
  end if;

  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_selection_source not in ('review', 'roadmap')
    or p_intent <> 'todo'
    or p_leetcode_frontend_id is null or pg_catalog.btrim(p_leetcode_frontend_id) = ''
    or p_leetcode_slug is null or pg_catalog.btrim(p_leetcode_slug) = ''
    or p_title is null or pg_catalog.btrim(p_title) = ''
    or p_difficulty not in ('easy', 'medium', 'hard')
    or p_leetcode_url <> 'https://leetcode.com/problems/' || p_leetcode_slug || '/'
    or (p_selection_source = 'review' and (
      p_expected_schedule_version is null or p_expected_schedule_version < 0
      or p_roadmap_order is not null
    ))
    or (p_selection_source = 'roadmap' and (
      p_expected_schedule_version is not null
      or p_roadmap_order is null or p_roadmap_order <= 0
    )) then
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

  if exists (
    select 1 from public.daily_study_plan_tasks task
    where task.plan_id = v_plan.id and task.user_id = v_user_id
      and task.status = 'pending'
  ) then
    raise exception 'plan_not_resolved' using errcode = 'P0001';
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
    end if;
    raise exception 'already_in_today' using errcode = 'P0001';
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

  if p_selection_source = 'review' then
    if not found
      or v_problem.lifecycle_state <> 'active'
      or v_problem.total_reviews <= 0
      or v_problem.next_review_at > v_now
      or v_problem.schedule_version <> p_expected_schedule_version then
      raise exception 'candidate_changed' using errcode = 'P0001';
    end if;
  elsif found then
    raise exception 'candidate_changed' using errcode = 'P0001';
  end if;

  select coalesce(pg_catalog.max(task.position), -1) + 1 into v_position
  from public.daily_study_plan_tasks task
  where task.plan_id = v_plan.id and task.user_id = v_user_id;

  if p_selection_source = 'review' then
    insert into public.daily_study_plan_tasks(
      plan_id, user_id, position, kind, origin, status,
      user_problem_id, original_user_problem_id,
      leetcode_frontend_id, leetcode_slug, title, difficulty, leetcode_url,
      mastery_score_snapshot, next_review_at_snapshot, schedule_version_snapshot,
      assignment_source
    ) values (
      v_plan.id, v_user_id, v_position, 'review', 'tracked', 'pending',
      v_problem.id, v_problem.id,
      v_problem.leetcode_frontend_id, v_problem.leetcode_slug, v_problem.title,
      v_problem.difficulty, v_problem.leetcode_url, v_problem.mastery_score,
      v_problem.next_review_at, v_problem.schedule_version, 'manual_today'
    ) returning * into v_task;
  else
    insert into public.daily_study_plan_tasks(
      plan_id, user_id, position, kind, origin, status,
      leetcode_frontend_id, leetcode_slug, title, difficulty, leetcode_url,
      roadmap_order, assignment_source
    ) values (
      v_plan.id, v_user_id, v_position, 'new_problem', 'roadmap', 'pending',
      pg_catalog.btrim(p_leetcode_frontend_id), p_leetcode_slug, p_title,
      p_difficulty, p_leetcode_url, p_roadmap_order, 'manual_today'
    ) returning * into v_task;
  end if;

  update public.daily_study_plans
  set planned_task_count = planned_task_count + 1
  where id = v_plan.id and user_id = v_user_id;

  task_id := v_task.id;
  task_status := v_task.status;
  outcome := 'added_todo';
  review_event_id := null;
  correctable_until := null;
  return next;
end;
$$;

revoke execute on function public.add_problem_to_today(
  text, text, text, text, text, text, text[], text, bigint, integer
) from public, anon;
grant execute on function public.add_problem_to_today(
  text, text, text, text, text, text, text[], text, bigint, integer
) to authenticated;

commit;
