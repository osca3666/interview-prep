begin;

-- Static roadmap identity and membership. Application code remains the source
-- for display metadata; these rows support durable settings and review filters.
create table public.study_roadmaps (
  id text primary key check (pg_catalog.btrim(id) <> ''),
  name text not null check (pg_catalog.btrim(name) <> ''),
  content_version text not null check (pg_catalog.btrim(content_version) <> ''),
  created_at timestamptz not null default now()
);

create table public.study_roadmap_problems (
  roadmap_id text not null references public.study_roadmaps(id) on delete restrict,
  leetcode_slug text not null check (pg_catalog.btrim(leetcode_slug) <> ''),
  position integer not null check (position > 0),
  primary key (roadmap_id, leetcode_slug),
  unique (roadmap_id, position)
);

insert into public.study_roadmaps(id, name, content_version)
values ('neetcode-150', 'NeetCode 150', '2026-11-10');

insert into public.study_roadmap_problems(roadmap_id, leetcode_slug, position)
values
  ('neetcode-150', 'contains-duplicate', 1),
  ('neetcode-150', 'valid-anagram', 2),
  ('neetcode-150', 'two-sum', 3),
  ('neetcode-150', 'group-anagrams', 4),
  ('neetcode-150', 'top-k-frequent-elements', 5),
  ('neetcode-150', 'product-of-array-except-self', 6),
  ('neetcode-150', 'valid-sudoku', 7),
  ('neetcode-150', 'encode-and-decode-strings', 8),
  ('neetcode-150', 'longest-consecutive-sequence', 9),
  ('neetcode-150', 'valid-palindrome', 10),
  ('neetcode-150', 'two-sum-ii-input-array-is-sorted', 11),
  ('neetcode-150', '3sum', 12),
  ('neetcode-150', 'container-with-most-water', 13),
  ('neetcode-150', 'trapping-rain-water', 14),
  ('neetcode-150', 'best-time-to-buy-and-sell-stock', 15),
  ('neetcode-150', 'longest-substring-without-repeating-characters', 16),
  ('neetcode-150', 'longest-repeating-character-replacement', 17),
  ('neetcode-150', 'permutation-in-string', 18),
  ('neetcode-150', 'minimum-window-substring', 19),
  ('neetcode-150', 'sliding-window-maximum', 20),
  ('neetcode-150', 'valid-parentheses', 21),
  ('neetcode-150', 'min-stack', 22),
  ('neetcode-150', 'evaluate-reverse-polish-notation', 23),
  ('neetcode-150', 'generate-parentheses', 24),
  ('neetcode-150', 'daily-temperatures', 25),
  ('neetcode-150', 'car-fleet', 26),
  ('neetcode-150', 'largest-rectangle-in-histogram', 27),
  ('neetcode-150', 'binary-search', 28),
  ('neetcode-150', 'search-a-2d-matrix', 29),
  ('neetcode-150', 'koko-eating-bananas', 30),
  ('neetcode-150', 'find-minimum-in-rotated-sorted-array', 31),
  ('neetcode-150', 'search-in-rotated-sorted-array', 32),
  ('neetcode-150', 'time-based-key-value-store', 33),
  ('neetcode-150', 'median-of-two-sorted-arrays', 34),
  ('neetcode-150', 'reverse-linked-list', 35),
  ('neetcode-150', 'merge-two-sorted-lists', 36),
  ('neetcode-150', 'reorder-list', 37),
  ('neetcode-150', 'remove-nth-node-from-end-of-list', 38),
  ('neetcode-150', 'copy-list-with-random-pointer', 39),
  ('neetcode-150', 'add-two-numbers', 40),
  ('neetcode-150', 'linked-list-cycle', 41),
  ('neetcode-150', 'find-the-duplicate-number', 42),
  ('neetcode-150', 'lru-cache', 43),
  ('neetcode-150', 'merge-k-sorted-lists', 44),
  ('neetcode-150', 'reverse-nodes-in-k-group', 45),
  ('neetcode-150', 'invert-binary-tree', 46),
  ('neetcode-150', 'maximum-depth-of-binary-tree', 47),
  ('neetcode-150', 'diameter-of-binary-tree', 48),
  ('neetcode-150', 'balanced-binary-tree', 49),
  ('neetcode-150', 'same-tree', 50),
  ('neetcode-150', 'subtree-of-another-tree', 51),
  ('neetcode-150', 'lowest-common-ancestor-of-a-binary-search-tree', 52),
  ('neetcode-150', 'binary-tree-level-order-traversal', 53),
  ('neetcode-150', 'binary-tree-right-side-view', 54),
  ('neetcode-150', 'count-good-nodes-in-binary-tree', 55),
  ('neetcode-150', 'validate-binary-search-tree', 56),
  ('neetcode-150', 'kth-smallest-element-in-a-bst', 57),
  ('neetcode-150', 'construct-binary-tree-from-preorder-and-inorder-traversal', 58),
  ('neetcode-150', 'binary-tree-maximum-path-sum', 59),
  ('neetcode-150', 'serialize-and-deserialize-binary-tree', 60),
  ('neetcode-150', 'implement-trie-prefix-tree', 61),
  ('neetcode-150', 'design-add-and-search-words-data-structure', 62),
  ('neetcode-150', 'word-search-ii', 63),
  ('neetcode-150', 'kth-largest-element-in-a-stream', 64),
  ('neetcode-150', 'last-stone-weight', 65),
  ('neetcode-150', 'k-closest-points-to-origin', 66),
  ('neetcode-150', 'kth-largest-element-in-an-array', 67),
  ('neetcode-150', 'task-scheduler', 68),
  ('neetcode-150', 'design-twitter', 69),
  ('neetcode-150', 'find-median-from-data-stream', 70),
  ('neetcode-150', 'subsets', 71),
  ('neetcode-150', 'combination-sum', 72),
  ('neetcode-150', 'permutations', 73),
  ('neetcode-150', 'subsets-ii', 74),
  ('neetcode-150', 'combination-sum-ii', 75),
  ('neetcode-150', 'word-search', 76),
  ('neetcode-150', 'palindrome-partitioning', 77),
  ('neetcode-150', 'letter-combinations-of-a-phone-number', 78),
  ('neetcode-150', 'n-queens', 79),
  ('neetcode-150', 'number-of-islands', 80),
  ('neetcode-150', 'clone-graph', 81),
  ('neetcode-150', 'max-area-of-island', 82),
  ('neetcode-150', 'pacific-atlantic-water-flow', 83),
  ('neetcode-150', 'surrounded-regions', 84),
  ('neetcode-150', 'rotting-oranges', 85),
  ('neetcode-150', 'walls-and-gates', 86),
  ('neetcode-150', 'course-schedule', 87),
  ('neetcode-150', 'course-schedule-ii', 88),
  ('neetcode-150', 'redundant-connection', 89),
  ('neetcode-150', 'number-of-connected-components-in-an-undirected-graph', 90),
  ('neetcode-150', 'graph-valid-tree', 91),
  ('neetcode-150', 'word-ladder', 92),
  ('neetcode-150', 'reconstruct-itinerary', 93),
  ('neetcode-150', 'min-cost-to-connect-all-points', 94),
  ('neetcode-150', 'network-delay-time', 95),
  ('neetcode-150', 'swim-in-rising-water', 96),
  ('neetcode-150', 'alien-dictionary', 97),
  ('neetcode-150', 'cheapest-flights-within-k-stops', 98),
  ('neetcode-150', 'climbing-stairs', 99),
  ('neetcode-150', 'min-cost-climbing-stairs', 100),
  ('neetcode-150', 'house-robber', 101),
  ('neetcode-150', 'house-robber-ii', 102),
  ('neetcode-150', 'longest-palindromic-substring', 103),
  ('neetcode-150', 'palindromic-substrings', 104),
  ('neetcode-150', 'decode-ways', 105),
  ('neetcode-150', 'coin-change', 106),
  ('neetcode-150', 'maximum-product-subarray', 107),
  ('neetcode-150', 'word-break', 108),
  ('neetcode-150', 'longest-increasing-subsequence', 109),
  ('neetcode-150', 'partition-equal-subset-sum', 110),
  ('neetcode-150', 'unique-paths', 111),
  ('neetcode-150', 'longest-common-subsequence', 112),
  ('neetcode-150', 'best-time-to-buy-and-sell-stock-with-cooldown', 113),
  ('neetcode-150', 'coin-change-ii', 114),
  ('neetcode-150', 'target-sum', 115),
  ('neetcode-150', 'interleaving-string', 116),
  ('neetcode-150', 'longest-increasing-path-in-a-matrix', 117),
  ('neetcode-150', 'distinct-subsequences', 118),
  ('neetcode-150', 'edit-distance', 119),
  ('neetcode-150', 'burst-balloons', 120),
  ('neetcode-150', 'regular-expression-matching', 121),
  ('neetcode-150', 'maximum-subarray', 122),
  ('neetcode-150', 'jump-game', 123),
  ('neetcode-150', 'jump-game-ii', 124),
  ('neetcode-150', 'gas-station', 125),
  ('neetcode-150', 'hand-of-straights', 126),
  ('neetcode-150', 'merge-triplets-to-form-target-triplet', 127),
  ('neetcode-150', 'partition-labels', 128),
  ('neetcode-150', 'valid-parenthesis-string', 129),
  ('neetcode-150', 'insert-interval', 130),
  ('neetcode-150', 'merge-intervals', 131),
  ('neetcode-150', 'non-overlapping-intervals', 132),
  ('neetcode-150', 'meeting-rooms', 133),
  ('neetcode-150', 'meeting-rooms-ii', 134),
  ('neetcode-150', 'minimum-interval-to-include-each-query', 135),
  ('neetcode-150', 'rotate-image', 136),
  ('neetcode-150', 'spiral-matrix', 137),
  ('neetcode-150', 'set-matrix-zeroes', 138),
  ('neetcode-150', 'happy-number', 139),
  ('neetcode-150', 'plus-one', 140),
  ('neetcode-150', 'powx-n', 141),
  ('neetcode-150', 'multiply-strings', 142),
  ('neetcode-150', 'detect-squares', 143),
  ('neetcode-150', 'single-number', 144),
  ('neetcode-150', 'number-of-1-bits', 145),
  ('neetcode-150', 'counting-bits', 146),
  ('neetcode-150', 'reverse-bits', 147),
  ('neetcode-150', 'missing-number', 148),
  ('neetcode-150', 'sum-of-two-integers', 149),
  ('neetcode-150', 'reverse-integer', 150);

-- A context is reused across settings revisions when only targets or the New
-- selection mode change. A review-filter change creates a new context.
create table public.review_allocation_contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_source text not null check (review_source in ('all', 'selected_roadmaps')),
  filter_fingerprint text not null check (pg_catalog.btrim(filter_fingerprint) <> ''),
  scheduling_policy_version text not null default 'v1'
    check (scheduling_policy_version = 'v1'),
  created_at timestamptz not null default now(),
  unique (user_id, filter_fingerprint),
  unique (id, user_id)
);

create table public.review_allocation_context_roadmaps (
  context_id uuid not null,
  user_id uuid not null,
  roadmap_id text not null references public.study_roadmaps(id) on delete restrict,
  primary key (context_id, roadmap_id),
  foreign key (context_id, user_id)
    references public.review_allocation_contexts(id, user_id) on delete cascade
);

create table public.study_plan_setting_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  effective_study_date date not null,
  daily_new_target integer not null check (daily_new_target between 0 and 10),
  daily_review_target integer not null check (daily_review_target between 0 and 20),
  followed_roadmap_id text references public.study_roadmaps(id) on delete restrict,
  new_selection_mode text not null
    check (new_selection_mode in ('sequential', 'shuffled')),
  review_allocation_context_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, version),
  unique (id, user_id),
  foreign key (review_allocation_context_id, user_id)
    references public.review_allocation_contexts(id, user_id) on delete restrict
);

create index study_plan_setting_revisions_active_idx
  on public.study_plan_setting_revisions(user_id, effective_study_date desc, version desc);

alter table public.user_problems
  add column consecutive_good_count integer not null default 0,
  add column scheduling_policy_version text not null default 'legacy-v1',
  add column provisional_mastery_score integer generated always as (
    case
      when source = 'leetcode_import'
        and external_practice_status = 'accepted'
        and total_reviews = 0 then 3
      else null
    end
  ) stored,
  add constraint user_problems_consecutive_good_count_check
    check (consecutive_good_count >= 0),
  add constraint user_problems_scheduling_policy_version_check
    check (scheduling_policy_version in ('legacy-v1', 'v1'));

alter table public.review_events
  add column previous_consecutive_good_count integer not null default 0,
  add column resulting_consecutive_good_count integer not null default 0,
  add column scheduling_policy_version text not null default 'legacy-v1',
  add column pre_practice_problem_type text,
  add column pre_practice_review_pool text,
  add column practice_local_date date,
  add column practice_time_zone text,
  add constraint review_events_previous_good_count_check
    check (previous_consecutive_good_count >= 0),
  add constraint review_events_resulting_good_count_check
    check (resulting_consecutive_good_count >= 0),
  add constraint review_events_scheduling_policy_version_check
    check (scheduling_policy_version in ('legacy-v1', 'v1')),
  add constraint review_events_pre_practice_classification_check
    check (
      (pre_practice_problem_type is null and pre_practice_review_pool is null)
      or (pre_practice_problem_type = 'new' and pre_practice_review_pool is null)
      or (pre_practice_problem_type = 'review'
        and pre_practice_review_pool in ('imported', 'established'))
    ),
  add constraint review_events_local_study_context_check
    check (
      (practice_local_date is null and practice_time_zone is null)
      or (practice_local_date is not null
        and practice_time_zone is not null
        and pg_catalog.btrim(practice_time_zone) <> '')
    );

alter table public.daily_study_plans
  drop constraint daily_study_plans_roadmap_id_check,
  drop constraint daily_study_plans_selection_version_check,
  drop constraint daily_study_plans_review_target_check,
  drop constraint daily_study_plans_new_problem_target_check,
  add column settings_revision_id uuid,
  add column settings_version_snapshot integer,
  add column followed_roadmap_id_snapshot text,
  add column new_selection_mode_snapshot text not null default 'sequential',
  add column review_source_snapshot text not null default 'all',
  add column review_roadmap_ids_snapshot text[] not null default '{}'::text[],
  add column shuffle_seed text,
  add column review_shortage_count integer not null default 0,
  add column new_problem_shortage_count integer not null default 0,
  add constraint daily_study_plans_roadmap_id_fkey
    foreign key (roadmap_id) references public.study_roadmaps(id) on delete restrict,
  add constraint daily_study_plans_settings_revision_fkey
    foreign key (settings_revision_id, user_id)
    references public.study_plan_setting_revisions(id, user_id) on delete restrict,
  add constraint daily_study_plans_followed_roadmap_snapshot_fkey
    foreign key (followed_roadmap_id_snapshot)
    references public.study_roadmaps(id) on delete restrict,
  add constraint daily_study_plans_selection_version_check
    check (selection_version in ('v1', 'v2', 'v1-policy')),
  add constraint daily_study_plans_review_target_check
    check (review_target between 0 and 20),
  add constraint daily_study_plans_new_problem_target_check
    check (new_problem_target between 0 and 10),
  add constraint daily_study_plans_settings_version_snapshot_check
    check (settings_version_snapshot is null or settings_version_snapshot > 0),
  add constraint daily_study_plans_new_selection_mode_snapshot_check
    check (new_selection_mode_snapshot in ('sequential', 'shuffled')),
  add constraint daily_study_plans_review_source_snapshot_check
    check (review_source_snapshot in ('all', 'selected_roadmaps')),
  add constraint daily_study_plans_review_roadmaps_snapshot_check
    check (
      pg_catalog.array_position(review_roadmap_ids_snapshot, null) is null
      and (
        (review_source_snapshot = 'all' and pg_catalog.cardinality(review_roadmap_ids_snapshot) = 0)
        or (review_source_snapshot = 'selected_roadmaps'
          and pg_catalog.cardinality(review_roadmap_ids_snapshot) > 0)
      )
    ),
  add constraint daily_study_plans_shortage_counts_check
    check (review_shortage_count >= 0 and new_problem_shortage_count >= 0),
  add constraint daily_study_plans_policy_snapshot_check
    check (
      selection_version <> 'v1-policy'
      or (
        settings_revision_id is not null
        and settings_version_snapshot is not null
        and pg_catalog.btrim(coalesce(shuffle_seed, '')) <> ''
      )
    );

alter table public.daily_study_plan_tasks
  drop constraint daily_study_plan_tasks_status_check,
  drop constraint daily_study_task_activity_check,
  add column review_pool_snapshot text,
  add column unassigned_at timestamptz,
  add column unassignment_reason text,
  add constraint daily_study_plan_tasks_status_check
    check (status in ('pending', 'completed', 'deferred', 'unassigned')),
  add constraint daily_study_plan_tasks_review_pool_snapshot_check
    check (
      review_pool_snapshot is null
      or (
        review_pool_snapshot in ('imported', 'established')
        and kind in ('review', 'calibration')
      )
    ),
  add constraint daily_study_task_activity_check check (
    (status = 'pending' and completed_review_event_id is null
      and completion_event_id_snapshot is null and completed_at is null
      and deferred_at is null and unassigned_at is null and unassignment_reason is null)
    or (status = 'completed' and completion_event_id_snapshot is not null
      and completed_at is not null and deferred_at is null
      and unassigned_at is null and unassignment_reason is null
      and (completed_review_event_id is null
        or completed_review_event_id = completion_event_id_snapshot))
    or (status = 'deferred' and completed_review_event_id is null
      and completion_event_id_snapshot is null and completed_at is null
      and deferred_at is not null and unassigned_at is null and unassignment_reason is null)
    or (status = 'unassigned' and completed_review_event_id is null
      and completion_event_id_snapshot is null and completed_at is null
      and deferred_at is null and unassigned_at is not null
      and pg_catalog.btrim(coalesce(unassignment_reason, '')) <> '')
  ),
  add constraint daily_study_plan_tasks_id_user_id_key unique (id, user_id);

alter table public.review_events
  add constraint review_events_id_user_id_key unique (id, user_id);

create table public.review_allocation_entries (
  id uuid primary key default gen_random_uuid(),
  context_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  allocation_key text not null check (pg_catalog.btrim(allocation_key) <> ''),
  candidate_user_problem_id uuid,
  candidate_problem_id_snapshot uuid not null,
  pool text not null check (pool in ('imported', 'established')),
  source text not null check (source in ('generated', 'manual')),
  imported_weight integer not null check (imported_weight >= 0),
  established_weight integer not null check (established_weight >= 0),
  daily_study_plan_task_id uuid,
  daily_study_plan_task_id_snapshot uuid,
  review_event_id uuid,
  review_event_id_snapshot uuid,
  active boolean not null default true,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  foreign key (context_id, user_id)
    references public.review_allocation_contexts(id, user_id) on delete restrict,
  foreign key (candidate_user_problem_id, user_id)
    references public.user_problems(id, user_id)
    on delete set null (candidate_user_problem_id),
  foreign key (daily_study_plan_task_id, user_id)
    references public.daily_study_plan_tasks(id, user_id)
    on delete set null (daily_study_plan_task_id),
  foreign key (review_event_id, user_id)
    references public.review_events(id, user_id)
    on delete set null (review_event_id),
  unique (context_id, allocation_key),
  unique (daily_study_plan_task_id_snapshot),
  unique (review_event_id_snapshot),
  check (imported_weight + established_weight > 0),
  check (
    (source = 'generated' and daily_study_plan_task_id_snapshot is not null
      and review_event_id_snapshot is null)
    or (source = 'manual' and review_event_id_snapshot is not null
      and daily_study_plan_task_id_snapshot is null)
  ),
  check (
    (active and reversed_at is null and reversal_reason is null)
    or (not active and reversed_at is not null
      and pg_catalog.btrim(coalesce(reversal_reason, '')) <> '')
  )
);

create index review_allocation_entries_context_idx
  on public.review_allocation_entries(context_id, created_at, id)
  where active;
create index review_allocation_entries_candidate_idx
  on public.review_allocation_entries(candidate_user_problem_id)
  where candidate_user_problem_id is not null;

alter table public.study_roadmaps enable row level security;
alter table public.study_roadmap_problems enable row level security;
alter table public.review_allocation_contexts enable row level security;
alter table public.review_allocation_context_roadmaps enable row level security;
alter table public.study_plan_setting_revisions enable row level security;
alter table public.review_allocation_entries enable row level security;

create policy "Authenticated users can read study roadmaps"
  on public.study_roadmaps for select to authenticated using (true);
create policy "Authenticated users can read study roadmap membership"
  on public.study_roadmap_problems for select to authenticated using (true);
create policy "Users can read their review allocation contexts"
  on public.review_allocation_contexts for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users can read their review allocation roadmaps"
  on public.review_allocation_context_roadmaps for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users can read their Study Plan settings"
  on public.study_plan_setting_revisions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users can read their review allocation history"
  on public.review_allocation_entries for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on
  public.study_roadmaps,
  public.study_roadmap_problems,
  public.review_allocation_contexts,
  public.review_allocation_context_roadmaps,
  public.study_plan_setting_revisions,
  public.review_allocation_entries
from public, anon, authenticated;

grant select on
  public.study_roadmaps,
  public.study_roadmap_problems,
  public.review_allocation_contexts,
  public.review_allocation_context_roadmaps,
  public.study_plan_setting_revisions,
  public.review_allocation_entries
to authenticated;

commit;
