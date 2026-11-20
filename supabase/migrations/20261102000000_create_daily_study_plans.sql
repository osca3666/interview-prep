begin;

create table public.user_study_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  time_zone text not null check (pg_catalog.btrim(time_zone) <> ''),
  created_at timestamptz not null default now()
);

create table public.daily_study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  study_date date not null,
  time_zone text not null,
  day_starts_at timestamptz not null,
  day_ends_at timestamptz not null,
  roadmap_id text not null check (roadmap_id = 'neetcode-150'),
  selection_version text not null default 'v1' check (selection_version = 'v1'),
  reference_time timestamptz not null,
  review_target integer not null default 3 check (review_target = 3),
  new_problem_target integer not null default 1 check (new_problem_target = 1),
  planned_task_count integer not null check (planned_task_count between 0 and 4),
  created_at timestamptz not null default now(),
  unique (user_id, study_date),
  unique (id, user_id),
  check (day_ends_at > day_starts_at),
  check (reference_time >= day_starts_at and reference_time < day_ends_at)
);

create table public.daily_study_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null check (position between 0 and 3),
  kind text not null check (kind in ('review', 'new_problem')),
  origin text not null check (origin in ('tracked', 'roadmap')),
  status text not null default 'pending' check (status in ('pending', 'completed', 'deferred')),
  user_problem_id uuid,
  original_user_problem_id uuid,
  leetcode_frontend_id text,
  leetcode_slug text not null check (pg_catalog.btrim(leetcode_slug) <> ''),
  title text not null check (pg_catalog.btrim(title) <> ''),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  leetcode_url text not null,
  mastery_score_snapshot integer check (mastery_score_snapshot between 0 and 10),
  next_review_at_snapshot timestamptz,
  schedule_version_snapshot bigint check (schedule_version_snapshot >= 0),
  roadmap_order integer check (roadmap_order > 0),
  created_at timestamptz not null default now(),
  foreign key (plan_id, user_id) references public.daily_study_plans(id, user_id) on delete cascade,
  -- Deleting a tracked problem detaches the live reference, not its historical snapshot.
  foreign key (user_problem_id, user_id) references public.user_problems(id, user_id)
    on delete set null (user_problem_id),
  unique (plan_id, position),
  unique (plan_id, leetcode_slug),
  check (leetcode_frontend_id is null or pg_catalog.btrim(leetcode_frontend_id) <> ''),
  check (
    (origin = 'tracked' and original_user_problem_id is not null
      and mastery_score_snapshot is not null and next_review_at_snapshot is not null
      and schedule_version_snapshot is not null and roadmap_order is null)
    or (origin = 'roadmap' and kind = 'new_problem' and original_user_problem_id is null
      and mastery_score_snapshot is null and next_review_at_snapshot is null
      and schedule_version_snapshot is null and roadmap_order is not null)
  )
);

create index daily_study_plan_tasks_problem_idx on public.daily_study_plan_tasks(user_problem_id)
  where user_problem_id is not null;

alter table public.user_study_preferences enable row level security;
alter table public.daily_study_plans enable row level security;
alter table public.daily_study_plan_tasks enable row level security;

create policy "Users can read their study preferences" on public.user_study_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users can read their daily plans" on public.daily_study_plans
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users can read their daily tasks" on public.daily_study_plan_tasks
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.user_study_preferences, public.daily_study_plans, public.daily_study_plan_tasks
  from public, anon, authenticated;
grant select on public.user_study_preferences, public.daily_study_plans, public.daily_study_plan_tasks
  to authenticated;

create function public.create_daily_study_plan(
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

  -- A read/selection that crossed local midnight must be retried, not saved to the wrong day.
  if p_reference_time is null or (p_reference_time at time zone v_time_zone)::date <> v_study_date
    or p_reference_time > v_now + interval '30 seconds' or p_tasks is null then
    raise exception 'stale_recommendations' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_tasks) <> 'array' or pg_catalog.jsonb_array_length(p_tasks) > 4 then
    raise exception 'invalid_submission' using errcode = 'P0001';
  end if;

  -- Lock tracked candidates in a consistent order, independently of their display positions.
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
      or v_kind is null or v_kind not in ('review', 'new_problem')
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
        or (v_kind = 'new_problem' and v_problem.total_reviews <> 0) then
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

revoke execute on function public.create_daily_study_plan(text, timestamptz, jsonb) from public, anon;
grant execute on function public.create_daily_study_plan(text, timestamptz, jsonb) to authenticated;

commit;
