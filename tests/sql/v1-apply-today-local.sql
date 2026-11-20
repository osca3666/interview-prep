\set ON_ERROR_STOP on
begin;

insert into auth.users(id) values
  ('20000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000003');

-- Apply today before generation only saves the effective revision.
set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000003';
select public.save_and_reconcile_study_plan_settings(
  1, 2, null, 'sequential', 'all', '{}'::text[], 'today', 'UTC',
  clock_timestamp(), '[]'::jsonb
);
reset role;

do $$
begin
  if (select count(*) from public.study_plan_setting_revisions
      where user_id = '20000000-0000-0000-0000-000000000003') <> 1 then
    raise exception 'Apply today before generation did not save one revision';
  end if;
  if exists (select 1 from public.daily_study_plans
      where user_id = '20000000-0000-0000-0000-000000000003') then
    raise exception 'settings save unexpectedly generated a plan';
  end if;
end;
$$;

-- Build a two-review plan, complete the first task, and add an explicit manual
-- assignment. Decreasing targets must preserve both pieces of user evidence.
set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
select public.save_study_plan_settings(
  0, 2, null, 'sequential', 'all', '{}'::text[], 'today', 'UTC'
);
reset role;

insert into public.user_problems(
  id, user_id, leetcode_frontend_id, leetcode_slug, leetcode_url, title,
  difficulty, total_reviews, mastery_score, last_reviewed_at, next_review_at,
  scheduling_policy_version
) values
  ('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   '1', 'contains-duplicate', 'https://leetcode.com/problems/contains-duplicate/',
   'Contains Duplicate', 'easy', 1, 4, clock_timestamp() - interval '10 days',
   clock_timestamp() - interval '5 days', 'v1'),
  ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
   '2', 'valid-anagram', 'https://leetcode.com/problems/valid-anagram/',
   'Valid Anagram', 'easy', 1, 5, clock_timestamp() - interval '8 days',
   clock_timestamp() - interval '3 days', 'v1');

set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
select public.create_v1_daily_study_plan(
  'UTC', clock_timestamp(),
  (select id from public.study_plan_setting_revisions
   where user_id = auth.uid() order by version desc limit 1),
  jsonb_build_array(
    jsonb_build_object(
      'kind', 'review', 'origin', 'tracked',
      'user_problem_id', '21000000-0000-0000-0000-000000000001',
      'schedule_version', 0, 'review_pool', 'established',
      'allocation_key', 'v1:' || (clock_timestamp() at time zone 'UTC')::date::text || ':review:0',
      'imported_weight', 0, 'established_weight', 1
    ),
    jsonb_build_object(
      'kind', 'review', 'origin', 'tracked',
      'user_problem_id', '21000000-0000-0000-0000-000000000002',
      'schedule_version', 0, 'review_pool', 'established',
      'allocation_key', 'v1:' || (clock_timestamp() at time zone 'UTC')::date::text || ':review:1',
      'imported_weight', 0, 'established_weight', 1
    )
  )
);
select public.submit_problem_review(
  '21000000-0000-0000-0000-000000000001', 'ok', 0
);
select public.create_user_problem_with_timezone(
  '3', 'two-sum', 'https://leetcode.com/problems/two-sum/', 'Two Sum',
  'easy', array['Array'], '', 'scheduled', null,
  (clock_timestamp() at time zone 'UTC')::date, 'UTC'
);
select public.save_and_reconcile_study_plan_settings(
  0, 0, null, 'sequential', 'all', '{}'::text[], 'today', 'UTC',
  clock_timestamp(), '[]'::jsonb
);
reset role;

set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
select public.save_and_reconcile_study_plan_settings(
  0, 0, null, 'sequential', 'all', '{}'::text[], 'today', 'UTC',
  clock_timestamp(), '[]'::jsonb
);
reset role;

do $$
declare
  v_revision_count integer;
begin
  if (select count(*) from public.daily_study_plan_tasks
      where user_id = '20000000-0000-0000-0000-000000000001'
        and status = 'completed') <> 1 then
    raise exception 'completed work was not preserved';
  end if;
  if (select count(*) from public.daily_study_plan_tasks
      where user_id = '20000000-0000-0000-0000-000000000001'
        and status = 'pending' and assignment_source = 'manual_scheduled') <> 1 then
    raise exception 'manual pending work was not preserved';
  end if;
  if (select count(*) from public.daily_study_plan_tasks
      where user_id = '20000000-0000-0000-0000-000000000001'
        and status = 'unassigned' and unassignment_reason = 'settings_target_reduced') <> 1 then
    raise exception 'generated surplus was not unassigned';
  end if;
  if (select planned_task_count from public.daily_study_plans
      where user_id = '20000000-0000-0000-0000-000000000001') <> 2 then
    raise exception 'reconciled denominator is incorrect';
  end if;
  if (select count(*) from public.review_allocation_entries allocation
      where allocation.user_id = '20000000-0000-0000-0000-000000000001'
        and not allocation.active
        and allocation.reversal_reason = 'settings_reconciliation') <> 1 then
    raise exception 'generated allocation was not reversed exactly once';
  end if;
  select count(*) into v_revision_count from public.study_plan_setting_revisions
  where user_id = '20000000-0000-0000-0000-000000000001';
  if v_revision_count <> 2 then
    raise exception 'identical retry inserted another revision';
  end if;
  if (select count(*) from public.review_allocation_entries allocation
      where allocation.user_id = '20000000-0000-0000-0000-000000000001'
        and not allocation.active) <> 1 then
    raise exception 'identical retry drifted allocation reversals';
  end if;
end;
$$;

-- Increasing targets adds only the missing assignments. A later source change
-- removes the now-ineligible pending task and records the real shortage.
set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000002';
select public.save_study_plan_settings(
  0, 0, null, 'sequential', 'all', '{}'::text[], 'today', 'UTC'
);
select public.create_v1_daily_study_plan(
  'UTC', clock_timestamp(),
  (select id from public.study_plan_setting_revisions
   where user_id = auth.uid() order by version desc limit 1), '[]'::jsonb
);
reset role;

insert into public.user_problems(
  id, user_id, leetcode_frontend_id, leetcode_slug, leetcode_url, title,
  difficulty, total_reviews, mastery_score, last_reviewed_at, next_review_at,
  scheduling_policy_version
) values
  ('22000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
   '217', 'contains-duplicate', 'https://leetcode.com/problems/contains-duplicate/',
   'Contains Duplicate', 'easy', 1, 3, clock_timestamp() - interval '9 days',
   clock_timestamp() - interval '4 days', 'v1'),
  ('22000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002',
   '999001', 'outside-roadmap', 'https://leetcode.com/problems/outside-roadmap/',
   'Outside Roadmap', 'medium', 1, 4, clock_timestamp() - interval '7 days',
   clock_timestamp() - interval '2 days', 'v1');

set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000002';
select public.save_and_reconcile_study_plan_settings(
  1, 2, null, 'sequential', 'all', '{}'::text[], 'today', 'UTC',
  clock_timestamp(),
  jsonb_build_array(
    jsonb_build_object(
      'kind', 'review', 'origin', 'tracked',
      'user_problem_id', '22000000-0000-0000-0000-000000000001',
      'schedule_version', 0, 'review_pool', 'established',
      'allocation_key', 'v1:' || (clock_timestamp() at time zone 'UTC')::date::text || ':revision:2:review:0',
      'imported_weight', 0, 'established_weight', 1
    ),
    jsonb_build_object(
      'kind', 'review', 'origin', 'tracked',
      'user_problem_id', '22000000-0000-0000-0000-000000000002',
      'schedule_version', 0, 'review_pool', 'established',
      'allocation_key', 'v1:' || (clock_timestamp() at time zone 'UTC')::date::text || ':revision:2:review:1',
      'imported_weight', 0, 'established_weight', 1
    ),
    jsonb_build_object(
      'kind', 'new_problem', 'origin', 'roadmap', 'frontend_id', '242',
      'slug', 'valid-anagram', 'title', 'Valid Anagram', 'difficulty', 'easy',
      'leetcode_url', 'https://leetcode.com/problems/valid-anagram/',
      'roadmap_order', 2
    )
  )
);
select public.save_and_reconcile_study_plan_settings(
  1, 2, null, 'shuffled', 'selected_roadmaps', array['neetcode-150'],
  'today', 'UTC', clock_timestamp(), '[]'::jsonb
);
reset role;

set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000002';
select public.save_and_reconcile_study_plan_settings(
  4, 5, null, 'sequential', 'all', '{}'::text[], 'tomorrow', 'UTC',
  clock_timestamp(), '[]'::jsonb
);
reset role;

do $$
declare
  v_plan_before public.daily_study_plans%rowtype;
begin
  select * into v_plan_before from public.daily_study_plans
  where user_id = '20000000-0000-0000-0000-000000000002';
  if v_plan_before.planned_task_count <> 2
    or v_plan_before.review_shortage_count <> 1
    or v_plan_before.review_source_snapshot <> 'selected_roadmaps'
    or v_plan_before.new_selection_mode_snapshot <> 'shuffled' then
    raise exception 'source/mode reconciliation snapshot is incorrect';
  end if;
  if (select count(*) from public.daily_study_plan_tasks
      where user_id = '20000000-0000-0000-0000-000000000002'
        and status = 'unassigned'
        and unassignment_reason = 'settings_source_changed') <> 1 then
    raise exception 'source change did not unassign the ineligible task';
  end if;
  if (select count(*) from public.daily_study_plan_tasks
      where user_id = '20000000-0000-0000-0000-000000000002'
        and status = 'pending' and kind = 'new_problem') <> 1 then
    raise exception 'selection-mode change did not preserve the valid New assignment';
  end if;

  if (select effective_study_date from public.study_plan_setting_revisions
      where id = v_plan_before.settings_revision_id)
      is distinct from (clock_timestamp() at time zone 'UTC')::date then
    raise exception 'Start tomorrow changed today''s plan';
  end if;
end;
$$;

-- Accounts without V1 settings remain on the legacy policy.
insert into auth.users(id) values ('20000000-0000-0000-0000-000000000004');
set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000004';
select public.create_user_problem_with_timezone(
  '999004', 'legacy-phase-2c', 'https://leetcode.com/problems/legacy-phase-2c/',
  'Legacy Phase 2C', 'easy', '{}'::text[], '', 'practiced', 'ok',
  (clock_timestamp() at time zone 'UTC')::date, 'UTC'
);
reset role;

do $$
begin
  if (select scheduling_policy_version from public.user_problems
      where user_id = '20000000-0000-0000-0000-000000000004') <> 'legacy-v1' then
    raise exception 'legacy account was opted into V1';
  end if;
end;
$$;

rollback;
