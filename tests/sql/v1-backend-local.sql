\set ON_ERROR_STOP on
begin;

insert into auth.users(id) values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003');

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
select public.save_study_plan_settings(0, 0, null, 'sequential', 'all', '{}'::text[], 'today', 'UTC');
select public.create_v1_daily_study_plan(
  'UTC', clock_timestamp(),
  (select id from public.study_plan_setting_revisions
   where user_id = auth.uid() order by version desc limit 1),
  '[]'::jsonb
);
select public.create_user_problem_with_timezone(
  '900001', 'v1-local-practice', 'https://leetcode.com/problems/v1-local-practice/',
  'V1 Local Practice', 'easy', '{}'::text[], '', 'practiced', 'ok',
  (clock_timestamp() at time zone 'UTC')::date, 'UTC'
);
reset role;

do $$
declare
  v_event_id uuid;
begin
  if (select mastery_score from public.user_problems where leetcode_slug = 'v1-local-practice') <> 1 then
    raise exception 'V1 OK did not add exactly one mastery point';
  end if;
  if (select scheduling_policy_version from public.user_problems where leetcode_slug = 'v1-local-practice') <> 'v1' then
    raise exception 'V1 policy was not persisted';
  end if;
  select id into v_event_id from public.review_events where user_problem_id = (
    select id from public.user_problems where leetcode_slug = 'v1-local-practice'
  );
  if (select count(*) from public.daily_study_plan_tasks
      where user_id = '10000000-0000-0000-0000-000000000001' and status = 'completed') <> 1 then
    raise exception 'manual V1 practice was not reconciled into the plan';
  end if;
end;
$$;

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
select public.correct_review_rating(
  (select id from public.review_events where user_id = auth.uid() limit 1), 'good'
);
reset role;

do $$
begin
  if (select count(*) from public.review_events
      where user_id = '10000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'rating correction inserted a duplicate event';
  end if;
  if (select mastery_score from public.user_problems where leetcode_slug = 'v1-local-practice') <> 3 then
    raise exception 'V1 correction did not recompute from the original baseline';
  end if;
  if (select consecutive_good_count from public.user_problems where leetcode_slug = 'v1-local-practice') <> 1 then
    raise exception 'V1 correction did not persist the Good count';
  end if;
end;
$$;

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000002';
select public.save_study_plan_settings(0, 1, null, 'sequential', 'all', '{}'::text[], 'today', 'UTC');
reset role;
insert into public.user_problems(
  user_id, leetcode_frontend_id, leetcode_slug, leetcode_url, title, difficulty,
  source, external_practice_status, total_reviews, mastery_score, next_review_at,
  scheduling_policy_version
) values (
  '10000000-0000-0000-0000-000000000002', '900002', 'v1-imported',
  'https://leetcode.com/problems/v1-imported/', 'V1 Imported', 'medium',
  'leetcode_import', 'accepted', 0, 0, clock_timestamp() - interval '1 day', 'v1'
);
set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000002';
select public.create_v1_daily_study_plan(
  'UTC', clock_timestamp(),
  (select id from public.study_plan_setting_revisions
   where user_id = auth.uid() order by version desc limit 1),
  jsonb_build_array(jsonb_build_object(
    'kind', 'calibration', 'origin', 'tracked',
    'user_problem_id', (select id from public.user_problems where user_id = auth.uid()),
    'schedule_version', 0, 'review_pool', 'imported',
    'allocation_key', 'v1:' || (clock_timestamp() at time zone 'UTC')::date::text || ':review:0',
    'imported_weight', 1, 'established_weight', 0
  ))
);
select public.submit_problem_review(
  (select id from public.user_problems where user_id = auth.uid()), 'bad', 0
);
reset role;

do $$
begin
  if (select previous_mastery_score from public.review_events
      where user_id = '10000000-0000-0000-0000-000000000002') <> 3 then
    raise exception 'imported first rating did not use provisional mastery three';
  end if;
  if (select mastery_score from public.user_problems
      where user_id = '10000000-0000-0000-0000-000000000002') <> 1 then
    raise exception 'imported Bad rating did not apply the V1 delta';
  end if;
  if (select count(*) from public.review_allocation_entries
      where user_id = '10000000-0000-0000-0000-000000000002'
        and source = 'generated' and pool = 'imported') <> 1 then
    raise exception 'generated imported allocation was not persisted exactly once';
  end if;
  if (select status from public.daily_study_plan_tasks
      where user_id = '10000000-0000-0000-0000-000000000002') <> 'completed' then
    raise exception 'assigned imported task did not complete with its real event';
  end if;
end;
$$;

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000003';
select public.create_user_problem_with_timezone(
  '900003', 'legacy-local-practice', 'https://leetcode.com/problems/legacy-local-practice/',
  'Legacy Local Practice', 'easy', '{}'::text[], '', 'practiced', 'ok',
  (clock_timestamp() at time zone 'UTC')::date, 'UTC'
);
reset role;

do $$
begin
  if (select mastery_score from public.user_problems where leetcode_slug = 'legacy-local-practice') <> 2 then
    raise exception 'legacy initial-practice behavior changed';
  end if;
  if (select scheduling_policy_version from public.user_problems where leetcode_slug = 'legacy-local-practice') <> 'legacy-v1' then
    raise exception 'legacy policy was unexpectedly activated';
  end if;
end;
$$;

rollback;
