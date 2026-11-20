# InterviewPrep.com Project State

## Product Summary

InterviewPrep.com is a roadmap-based LeetCode study planner and spaced-repetition review tracker.

Core intended experience:

1. Import or add existing LeetCode progress.
2. Choose a built-in roadmap and study goal.
3. Open the dashboard and know what to study today.
4. Review previously solved problems through spaced repetition.
5. See roadmap-specific progress, mastery, and topic/category coverage.

## Current Route Responsibilities

- `/dashboard` is the main workspace. It shows a compact welcome banner, Today's Study Plan with a today-only Add Problem popover, real practice consistency, NeetCode 150 progress, a study-plan placeholder, and genuine recent practice activity. It no longer shows a separate overdue backlog/review queue.
- `/problems` is the user's Library. It shows tracked problems with the shared Progress table, the all-category LeetCode catalog, a Track Problem modal, and an import entry point.
- `/problems/import` is the LeetCode Practice History preview and import flow.
- `/roadmaps` is the database-backed roadmap browser and followed-roadmap workspace.
- `/roadmaps/neetcode-150` is the NeetCode 150 checklist/planning detail page.
- `/analytics` is the authenticated practice analytics dashboard.
- `/review` was intentionally removed as a page. Do not restore it. `app/review/actions.ts` still exists for Server Actions used by the dashboard review queue.
- `/practice-history` was intentionally removed. Do not restore it.

## Current Architecture

- Next.js App Router with Server Components by default.
- Authenticated application routes use one grid-backed, viewport-height left sidebar. The sidebar and main content share one width contract, so expanded/collapsed navigation cannot overlap the default content region. On narrow screens, the compact rail remains in the grid while explicit expansion overlays the content. Public and authentication routes retain a compact top header.
- The shared navigation includes Dashboard, Problems, the Roadmaps browser, Study Plan settings, and Practice History Import. Analytics remains available as a direct authenticated route but is intentionally hidden from navigation. Active state is derived from the current App Router pathname.
- Client Components are used for browser interaction, such as local search, theme toggles, timezone capture, and import preview parsing.
- Supabase Auth and Postgres back the user data.
- Simple reads use Supabase `.select()` queries.
- Important state transitions use a Next.js Server Action plus a protected Supabase RPC.
- Generated Supabase TypeScript types are used for RPC args and table shapes.
- RLS and user ownership checks are enforced by authenticated access patterns and protected RPCs.

Main transition flow:

React form/UI -> Next.js Server Action -> typed data wrapper -> Supabase RPC -> protected database transition -> revalidation/redirect.

## Completed Core Review Features

- Track Problem is implemented through `app/problems/actions.ts`, `data/problems.ts`, and the `create_user_problem_with_timezone` RPC.
- Track Problem supports practiced and scheduled start modes:
  - practiced mode counts as the first practice/review event.
  - scheduled mode creates a problem scheduled for review without counting practice.
- Timezone-aware start-date validation is shared through `lib/time-zone.ts` and date-only validation through `lib/date-only.ts`.
- Daily-plan cards replace the dashboard due queue. `listDueProblems` and `ReviewQueueSection` remain available but are not used by the dashboard.
- Rating and snooze forms are shared through `components/review-task-actions.tsx` and continue calling the existing review Server Actions.
- User-facing review ratings are `Bad`, `OK`, and `Good`; the only canonical stored values are `bad`, `ok`, and `good`.
- Legacy rating aliases are intentionally unsupported. Prelaunch local study history was disposable when the canonical model was introduced.
- Review submission uses `submitReviewAction`, `submitProblemReview`, and the `submit_problem_review` RPC.
- Review transitions update review history, review counts, mastery, next review timing, and `schedule_version`.
- Stale-submit protection is based on `expected_schedule_version` / `schedule_version`.
- Skip today / Snooze is implemented through `snoozeReviewAction`, `snoozeProblemReview`, and the `snooze_problem_review` RPC.
- Skip today is separate from review ratings. It moves the problem to the next local day and increments `schedule_version`.
- Skip today must not create a `review_events` row or change mastery, `total_reviews`, `last_reviewed_at`, or `review_stage`.
- The dashboard Recent Activity feed reads only genuine `review_events`, newest first, and displays up to ten bounded results. It joins owned problem metadata in one additional query and uses the saved study timezone for Today/Yesterday labels. Correcting a rating updates the same source event rather than creating duplicate activity, while ratings remain intentionally omitted from the compact feed UI.
- Recent Activity initially shows three compact title/metadata rows with Show more/Show fewer up to ten. Rows reuse the shared difficulty chip and contain no checklist or rating-status treatment. Initial practice and later review events retain their stored New/Review classification; To-do additions, imports without practice events, plan generation, and Skip today cannot appear in the feed.
- Migration `20261106000000_unify_review_ratings.sql` establishes the clean prelaunch rating model locally. It resets disposable local study history, restricts new events to `bad`/`ok`/`good`, stores immutable transition baselines, and adds protected `correct_review_rating(uuid, text)` for five-minute same-event corrections. Corrections recompute mastery and scheduling from the saved pre-attempt state, update the original event, and reject expired, foreign, or superseded attempts. This migration has not been applied to cloud beta.

## Completed Daily Recommendation Foundation

- `lib/study-plan.ts` deterministically selects up to three due reviews and one new problem using an explicit reference timestamp.
- Reviews require `total_reviews > 0`. One slot is reserved for the oldest due review; the others balance overdue age with a bounded low-mastery bonus.
- Due, never-practiced tracked problems (`total_reviews = 0`) take priority for the new-problem slot, followed by the earliest untracked NeetCode 150 problem.
- `data/study-plan.ts` reads the full user-scoped due pool in keyset pages and excludes all tracked roadmap slugs, regardless of lifecycle or future scheduling.
- Imported Accepted problems with zero in-app reviews use the calibration task kind. The oldest known external activity date is prioritized in the existing one-problem new/calibration slot; missing dates sort after known dates.
- Calibration remains an internal planning/scheduling kind. User-facing task labels expose only New and Review, so imported Accepted problems display as Review before their first in-app rating.
- Recommendations remain read-only. The dashboard initializes persisted daily plans through the creation helper, rather than displaying recalculated recommendations directly.
- `npm test` runs focused selection and read-helper tests with Node's built-in runner and the existing TypeScript compiler; no test dependency is required.

## V1 Scheduling Policy Foundation (Phase 1)

- `lib/scheduling-engine.ts` is the pure replacement-policy foundation. It is intentionally not connected to the live daily-plan or review RPC flows yet.
- Canonical policy ratings are Bad, OK, and Good. Mastery changes are `-2`, `+1`, and `+3`; Bad and OK reset the consecutive-Good count, while Good intervals progress through 7, 14, 30, and 60 days.
- Review classification is explicit: imported Accepted problems without an InterviewPrep rating use provisional mastery 3 in the Imported pool, genuinely rated problems use the Established pool, and unpracticed To-do rows are excluded from review pools.
- Automatic eligibility supports due work, a 48-hour early-review cooldown, the conservative three-calendar-date imported cooldown, unknown import dates, manual cooldown bypass, and independent roadmap-source filtering.
- Imported and Established candidates are ranked independently. Review allocation uses a deterministic weighted-deficit ledger, supports changing 60/40 majorities, pool fallback, idempotent manual/generated credits, and reversal of unassigned generated credit.
- New-problem selection supports one followed roadmap or the explicit NeetCode 150 suggested default, sequential or seeded-shuffled ordering, canonical deduplication, and honest shortages without source switching.
- Phase 2 must persist the consecutive-Good count, immutable pool classification on assignment, allocation ledger/reversal records, followed roadmap and review-source settings, selection mode/seed, and the policy version before this engine can replace live scheduling.

## V1 Scheduling Database Foundation (Phase 2A)

- Migration `20261110000000_add_v1_scheduling_foundation.sql` is additive and applied only to local Supabase. Cloud beta was not modified.
- Immutable `study_plan_setting_revisions` persist effective study dates, separate New/Review targets, nullable followed roadmap, New selection mode, and a reusable review-allocation context. No settings row means onboarding is incomplete.
- Review allocation contexts isolate fairness by review-source filter. Target-only revisions can reuse a context, while a changed source/filter gets a new context. The append-only allocation ledger stores assignment-time pool, weights, generated/manual evidence, idempotency keys, and reversible generated credit.
- `user_problems` now has a consecutive-Good count and scheduling-policy version. Imported Accepted rows with zero genuine ratings expose generated provisional mastery 3 while their stored mastery remains untouched and no review event is fabricated.
- `review_events` can snapshot previous/resulting Good counts, policy version, pre-practice New/Review and Imported/Established classifications, and local study date/timezone. Existing correction baselines and the actual `reviewed_at` timestamp remain authoritative.
- Daily plans can snapshot the settings revision, targets, followed roadmap, review filters, selection mode, shuffle seed, and shortages. Tasks can snapshot their assigned review pool or become explicitly unassigned with a reason without deleting completed history.
- `study_roadmaps` and `study_roadmap_problems` persist stable roadmap identity and exact NeetCode 150 membership for future database-side filtering. Static application data remains the display/content source.
- Existing RPCs and live plan generation remain on `legacy-v1`; the Phase 1 policy is not active yet. New tables are RLS-protected, client-readable only where needed, and deny direct mutation.
- Historical migration `20261106000000_unify_review_ratings.sql` still contains the documented prelaunch `TRUNCATE` and was not edited. The linked beta project has already applied that migration and `20261107000000_add_today_problem_workflow.sql`, so the remaining V1 rollout does not need to replay the destructive cutover.

## V1 Scheduling Backend Integration (Phase 2B)

- The V1 policy is opt-in through immutable `study_plan_setting_revisions`. Accounts without an effective revision continue using the existing legacy plan-creation and rating behavior.
- Protected settings RPCs validate target bounds, roadmap identities, review-source filters, saved timezones, and immutable Today/Tomorrow effective dates.
- `data/v1-study-plan.ts` reads owner-scoped scheduling inputs and invokes the pure Phase 1 engine. `create_v1_daily_study_plan` then revalidates effective settings, candidate ownership/state, pool classification, ranking, source filters, fairness weights, deterministic roadmap selection, and task snapshots under the existing per-user advisory lock.
- Genuine practice already recorded on the local study date reduces the remaining generated New/Review targets. Persisted plans retain target, settings, source, shuffle-seed, shortage, pool, and allocation snapshots.
- V1 ratings use mastery deltas `-2/+1/+3`, Bad/OK intervals of 1/3 days, and consecutive-Good intervals of 7/14/30/60 days. Imported Accepted problems start their first genuine rating from provisional mastery 3 without a fake event.
- Same-event corrections recompute from immutable event baselines, update the original event, preserve the five-minute window, and do not duplicate task completion or fairness credit.
- Manual V1 practice records event-linked allocation credit. Practice outside the generated plan can replace only a pending generated task of the same category; the historical task is marked unassigned, its generated credit is reversed, and genuine practice evidence is retained.
- These migrations are applied only to local Supabase. Cloud beta has not been modified.

## V1 Atomic Apply-Today Reconciliation (Phase 2C)

- Migration `20261111004000_reconcile_v1_apply_today.sql` is applied only to local Supabase. The protected `save_and_reconcile_study_plan_settings` RPC saves the immutable revision and reconciles an existing V1 plan in one transaction under the shared per-user advisory lock.
- Start tomorrow creates an effective-next-day revision without changing today's plan. Apply today before plan generation only saves the effective revision. Identical retries reuse the matching revision and do not drift allocation counters.
- Reconciliation preserves completed, deferred, and explicit manual assignments. It unassigns only pending generated tasks that are no longer eligible or exceed revised targets; unassigned snapshots remain historical and completed review events/mastery are never deleted or rewritten.
- Generated review credits are reversed exactly once when their task is unassigned. Completed and manual credits remain active, and review-source changes use their isolated allocation context.
- Target increases keep valid generated assignments and request only missing replacements from the pure TypeScript scheduler. PostgreSQL independently revalidates ownership, eligibility, source filters, pool choice, weights, ranking, canonical identity, and shortages before committing.
- Active plan/problem uniqueness now uses a partial index so a historically unassigned problem can be selected again by a later same-day revision without deleting the old task snapshot.
- Migration `20261111005000_preserve_manual_allocation_after_reconciliation.sql` fixes the Apply-today-first race: a later genuine review keeps its event and records one idempotent manual allocation credit even when a same-problem task was already unassigned. The original plan denominator, task status, and completion evidence remain unchanged.

## V1 Study Plan Onboarding and Settings (Phase 3A)

- `/study-plan/setup` is the dedicated first-time setup flow. New signups enter it directly; existing users without a V1 revision keep the legacy planner and receive a clear Dashboard setup path.
- `/study-plan` displays and edits the latest saved revision. Daily New/Review targets, followed New roadmap, sequential/shuffled selection, and independent all/selected-roadmap review sources use the existing Phase 2C Server Action and atomic reconciliation RPC.
- Roadmap choices and counts come from the database-backed `study_roadmaps` registry. The UI does not invent roadmap options; NeetCode 150 is labeled as the suggested New-problem default when no roadmap is explicitly followed.
- Apply today preserves completed and manual work while reconciling pending generated assignments. Start tomorrow leaves the current plan unchanged. Duplicate clicks are disabled in the client and identical RPC retries remain idempotent.
- LeetCode history import remains optional and links to the existing `/problems/import` workflow. Zero New and Review targets are allowed with an explicit empty-plan explanation.
- The Dashboard My Study Plan card now separates configured targets from today's actual automatic/manual assignments and displays persisted shortage counts only when they belong to the effective V1 revision.
- Cloud beta was not modified. Phase 3A uses the local V1 schema and existing protected RPC contracts without a migration.
- The linked beta database currently predates the V1 settings migrations and therefore does not expose `get_effective_study_plan_settings`. The server settings helper probes that capability first: a missing V1 RPC/schema is represented explicitly as unavailable so legacy Dashboard data can still render, while ordinary users with no saved revision remain a valid setup state. Permission, authentication, network, and unexpected query errors still propagate. Development-only diagnostics include the operation, sanitized Supabase host/local-vs-remote target, auth presence, null-vs-error status, and structured Supabase error fields without credentials or user data.

## V1 Roadmaps Experience (Phase 3B)

- `/roadmaps` separates the currently followed roadmap from other available database-registered roadmaps. With no followed roadmap, NeetCode 150 is presented as a suggested starting point and is never mislabeled as Following.
- Progress is independent from following. It counts genuine in-app practice and imported Accepted history, excludes To-do-only tracking and unfinished assignments, deduplicates canonical slugs, and can advance every roadmap that contains the same practiced problem.
- Follow and Stop following preserve targets, sequential/shuffled mode, and independent review-source settings. Apply today and Start tomorrow reuse the existing versioned settings Server Action and atomic Phase 2C reconciliation RPC.
- Current and scheduled-tomorrow roadmap choices are shown separately. Settings resolution prefers the nearest future revision for editing while retaining the currently effective revision for today's plan.
- The NeetCode 150 detail page retains its ordered, searchable problem table and Start today behavior, and now shows real completion progress, followed/suggested state, selection mode, and Follow controls.
- The database registry and repository contain only one complete curated dataset: NeetCode 150. The UI supports additional registry rows, but no placeholder LeetCode 75, NeetCode 250, or company-roadmap membership was invented.
- Phase 3B required no migration or generated-type change. Cloud beta was not modified.

## Completed Daily Plan Persistence Foundation (Slice 2A)

- `user_study_preferences` saves the first validated study timezone. Later devices reuse it; there is no timezone-change UI yet.
- `daily_study_plans` stores one plan per user/local date, timezone and UTC day-boundary snapshots, NeetCode 150 identity, selector version, configured 3-review/1-new targets, and the persisted task denominator. Explicit same-day additions can increase that initial denominator.
- `daily_study_plan_tasks` stores stable task IDs, positions, pending status, problem metadata, and original due/version/mastery snapshots. Calibration tasks use the same persisted denominator and completion evidence as other tasks.
- The protected `create_daily_study_plan(text, timestamptz, jsonb)` RPC serializes creation per user with an advisory lock, returns an existing plan first, and validates owned/due/active candidates and schedule versions before atomic creation. Empty plans are persisted too.
- Local midnight boundaries are calculated independently in PostgreSQL, supporting 23-hour and 25-hour DST days. Old plans are retained without shifting review dates.
- Deleting a problem nulls the live task reference, preserving its original ID, snapshot, position, and denominator. Deleting the account removes that account's plans.
- `data/daily-study-plans.ts` exposes typed `ensureTodaysDailyStudyPlan` and read-only `getTodaysDailyStudyPlan` helpers. Creation uses the existing Slice 1 selector and retries stale recommendations once. Canonical roadmap metadata is resolved by the server-only catalog; PostgreSQL does not validate repository JSON independently.
- Migration `20261102000000_create_daily_study_plans.sql` is applied to the linked Supabase database and generated types include all three tables and the RPC.
- Daily-plan creation is connected to the dashboard through Slice 3.

## Completed Atomic Daily Task Activity (Slice 2B)

- `submit_problem_review`, `create_user_problem_with_timezone`, and `snooze_problem_review` retain their public signatures and scheduling behavior. Review/practice results now also expose the exact review-event identity and five-minute correction deadline. Their transactions call the protected `private.record_daily_study_activity` helper.
- Successful reviews complete only the matching owned, pending task in the current saved study day and link the exact inserted review event. No plan is created implicitly; unrelated reviews behave normally.
- Matching new roadmap tasks bind to the newly tracked problem. Scheduled tracking and roadmap Start today do not complete tasks. Practiced tracking completes only for a current-day practice declaration; backdated practice binds without plan credit.
- Track Problem still stores its initial event at the submitted date's local midnight. Current-day declarations are checked in the submitted browser timezone, while the actual completion transaction is assigned using the saved study timezone and persisted UTC boundaries. This supports different device timezones without crediting backdated declarations.
- Skip today atomically defers a matching pending task without a review event, completion credit, replacement, or denominator change. Completed/deferred tasks never reopen automatically.
- `defer_daily_study_plan_task(uuid)` and the typed `deferDailyStudyPlanTask` wrapper support owned, current-day, still-untracked roadmap tasks; repeated deferral is idempotent. The dashboard now exposes this through `deferStudyTaskAction`.
- Completion stores a live `completed_review_event_id`, retained `completion_event_id_snapshot`, and `completed_at`; deferral stores `deferred_at`. Constraints enforce consistent state and unique event evidence. Deleting a problem/event nulls the live reference but retains completion evidence and historical task snapshots.
- Plan creation and all affected transitions share the same per-user advisory lock before problem/task locks. Unexpected task-update failures roll back the associated practice/review/snooze transaction.
- Migration `20261102010000_complete_daily_study_tasks.sql` is applied to linked Supabase; generated types include the activity fields and public deferral RPC. The private helper cannot be executed by authenticated/anonymous clients.

## Completed Today's Study Plan Dashboard (Slice 3)

- `components/todays-study-plan.tsx` replaces the Ready to review queue with a persisted progress summary, one ordered compact checklist, and accurate completion/deferred/empty states. The actual persisted denominator is used, never a hardcoded four.
- `app/study-plan/actions.ts` authenticates initialization and untracked-task deferral. Browser IANA timezone detection initializes the existing persistence contract; later devices reuse the saved study timezone.
- Existing plans render server-side. Missing plans show a loading state while the client ensures today's plan. Failures show safe retry/sign-in states without exposing database details.
- `data/daily-study-plans.ts` loads only assigned live problem IDs/versions alongside immutable snapshots. Client-safe display types and summary/action-state helpers live in `lib/daily-study-plan-view.ts`; review-event IDs and ownership fields are not serialized to the workspace.
- Pending bound/due tasks use the canonical Bad/OK/Good and Skip today actions with current schedule versions, including a first review of an eligible never-practiced tracked problem. Snooze uses the saved study timezone.
- Pending untracked roadmap tasks expose the same rating controls through `rateNewStudyTaskAction` and `rate_new_daily_study_task(uuid, text, text, text, text, text, text, text[])`. The server resolves canonical metadata; the RPC validates the owned current-day pending task, derives its saved date/timezone, and delegates practiced creation to the existing RPC. Exact task/event completion is required or the whole transaction rolls back. Catalog JSON is enforced by the Server Action, not independently by PostgreSQL.
- The new wrapper shares the existing advisory lock ordering with review, tracking and deferral. Duplicate submissions and rating/deferral races cannot both succeed. Controlled conflicts refresh persisted state without retrying a first rating as another review. Untracked Skip today still uses the protected task-only deferral action.
- Tracking as scheduled binds without completion. Due bound tasks then expose rating actions; future-scheduled tasks remain pending and display their scheduled date. Opening LeetCode never changes progress.
- Migration `20261105000000_append_manually_scheduled_study_tasks.sql` makes scheduling a new tracked problem for the current saved study date append one `manual_scheduled` task to an existing daily plan. Generated assignments remain stable, the explicit task increases the persisted denominator, and only a later real rating completes it. Future scheduling and ordinary reviews do not append tasks. This migration was verified locally and applied to beta in its separately approved rollout.
- Redirects load fresh persisted state. Tab focus, visibility changes, visible-minute polling, and a server-derived day-end timer keep the workspace current across tabs/days without replacing completed or deferred tasks.
- Active, completed, and mixed completed/deferred plans always render the same full-width checklist rows. Resolution adds only a compact in-card message and accurate completed/deferred count above the existing progress bar; it never replaces or collapses the task list. Appending a pending manual task naturally returns the summary to its active state. Empty plans show Library navigation and no celebration.
- Shared review controls prevent simultaneous checklist submissions; the Library Track Problem form remains unchanged and disables its submit button while pending.
- The Dashboard groups Today's plan into one cohesive checklist: completed/total and remaining counts, a 12px purple progress bar, compact divided rows, and responsive wrapping at narrow widths. Problem titles remain independent LeetCode links. Clicking a task circle immediately applies an optimistic completion and starts one canonical OK attempt; a compact anchored Bad/OK/Good popover queues early choices, remains mounted through the initial save, and can correct that same review event for five minutes. Clicking away keeps OK. Skip today remains visible and secondary. Completed/deferred tasks have no rating controls.
- Today's Plan owns a compact command-palette Add Problem popover. Its stable shell supports keyboard-searchable canonical catalog results, To-do/Done intent, and Review another/Continue roadmap choices without changing size between states. Manual To-do, recommended review, and recommended roadmap selections all use the same persisted `manual_today` To-do insertion through `add_problem_to_today`, increase the denominator, and render in the same checklist. Selecting a recommendation creates no review event or mastery/schedule transition. A previously untracked recommendation receives the ordinary scheduled Library row required by the shared insertion path, then genuine practice completes its task. Manual Done still records one genuine OK attempt with correction evidence. Duplicate assignments are controlled.
- Checklist ordering is derived from persisted task metadata: newly added pending work first, generated pending work in original order, deferred work next, and completions last with the newest completion at the bottom. The same ordering survives refresh, and optimistic completion keeps its correction popover mounted while the row moves.
- The dashboard uses a wide main-content column for Today's Plan, a compact Practice Trend, and Recent Activity, with compact Consistency, Roadmap Progress, and My Study Plan widgets stacked in a responsive right rail. Practice Trend reuses the Analytics combined recorded-activity buckets, defaults to Month, and can switch to Week without another query. The rail collapses into the intended single-column mobile order when the available app-content width is too narrow. Plans with more than four tasks show four rows by default and use a presentation-only Show all/Show fewer control; task identity and persisted counts are unchanged.
- Dashboard consistency is derived read-only from genuine `review_events` in the saved IANA timezone. It includes daily grace through yesterday, Monday-Sunday weekly streaks, and the current month calendar. Scheduling, deferral, imported history without an event, and rating correction do not create extra streak activity. No mutable streak counter or database migration was added.
- Migration `20261102020000_rate_new_daily_study_task.sql` is applied to linked Supabase and types are regenerated. Existing RPC signatures/calculations are unchanged; no gamification was introduced.

## Unified Today Task Insertion

- Review another selects the authenticated user's earliest `next_review_at` among active, genuinely practiced Library problems, including future-due reviews. Continue roadmap retains static NeetCode 150 order, treats tracked zero-review problems as unpracticed, and treats imported Accepted history as practiced. Both exclude every problem already assigned to the current plan.
- The server resolves the recommendation and canonical metadata, then uses the same seven-argument manual To-do insertion contract as catalog Add Problem. This keeps the shortcuts compatible with both the local extended RPC and the current beta signature while preserving protected duplicate, ownership, and plan-count behavior.
- Recommended reviews retain their existing Library row and due timestamp. Recommended roadmap problems use the ordinary scheduled Library/task insertion when necessary. Neither shortcut creates a review event; practice begins only when the checklist item is rated.
- The prior detached optional candidate, Dismiss control, and direct optional-practice action were removed. Completing a recommended task now uses the normal checklist rating/correction path and exact task evidence.
- Migration `20261108000000_unify_today_task_insertion.sql` and regenerated types remain applied locally only. The recommendation actions no longer depend on its optional selection arguments. Cloud beta was not modified.

## Completed Analytics Dashboard (V1)

- `/analytics` is an authenticated, read-only dashboard built from real `review_events`, persisted import metadata, and the user's saved study timezone.
- The full-width Practice Over Time chart combines dated historical Accepted imports with genuine InterviewPrep practice. It defaults to Month and Difficulty, supports Week/Month grouping, and switches between Difficulty and Activity type stacked breakdowns.
- Practice Over Time uses narrow stacked bars with totals above nonzero buckets, headroom for labels, square internal joins, and rounded tops only on the complete stack. Its legend is intentionally understated, while difficulty series reuse the shared Easy/Medium/Hard colors.
- V1 events use the immutable `pre_practice_problem_type` and `practice_local_date` snapshots. Legacy events fall back to import identity and chronological history; daily-plan completion is never counted separately from its genuine practice event.
- Consistency and streak calculations remain available in the analytics snapshot, but the calendar/streak panel is intentionally not shown in the current UI.
- Difficulty stacks and legends reuse the shared Easy/Medium/Hard color tokens. Historical Accepted, New, and Review use a separate restrained palette, and bucket tooltips disclose when difficulty totals combine imported and in-app sources.
- Chart geometry measures its rendered container so the plot stays full-width and legible in responsive light and dark layouts. The Analytics UI intentionally omits the former More insights comparison/mastery disclosure.
- Rating performance reports Bad/OK/Good as self-reported outcomes. Topic counts use unique practiced problems per topic and explicitly overlap. Week/month comparisons use equal elapsed windows rather than percentages.
- Mastery includes only problems with at least one real in-app event, so uncalibrated imports are not presented as assessed zero mastery.
- Server reads are owner-scoped and keyset-paged. Raw history is aggregated on the server; the client receives compact chart-ready counts. V1 safety limits are 50,000 events and 10,000 tracked problems per account.
- `/analytics?demo=1` supplies deterministic imported and in-app fixture activity through the same pure aggregator in development only. It is labeled `Demo data`, links back to real data, performs no Supabase reads or writes, and is ignored outside `NODE_ENV=development`.
- No analytics schema, RPC, persistence, or chart dependency was added.
- Reusable Playwright coverage now renders `/analytics?demo=1` in headless Chromium at 1440px desktop and 390px mobile widths in genuine light and dark themes. It verifies chart geometry, activity controls, responsive overflow, and the development-only authentication boundary, and attaches all four screenshots for direct visual review.
- The visual-test exception skips Supabase only for the exact development Playwright Analytics demo request. Spoofed headers, ordinary Analytics requests, and production mode remain on the normal authentication path.

## Completed Roadmap Features

- The full static NeetCode 150 list lives in `data/problem-sets/neetcode-150.ts`.
- Roadmap progress and row data are computed read-only in `data/roadmap-progress.ts`.
- The dashboard roadmap progress card is `components/roadmap-progress-card.tsx`.
- `/roadmaps/neetcode-150` renders the roadmap checklist/planning page.
- `components/roadmap-table.tsx` renders a searchable planning table, not a duplicate Library/progress table.
- Roadmap row states are:
  - `strong`
  - `reviewed`
  - `planned`
  - `untracked`
- Untracked roadmap rows can be started with `Start today`.
- `Start today` is implemented by `addRoadmapProblemAction` in `app/roadmaps/actions.ts`.
- The roadmap action submits only the roadmap slug, return path, and browser timezone from the client.
- Trusted title, slug, difficulty, topics, and LeetCode URL are looked up server-side from canonical metadata.
- Starting a roadmap problem creates a scheduled `user_problems` row through the existing `create_user_problem_with_timezone` RPC and does not create a review event.
- Roadmap content remains controlled by static roadmap lists and is not expanded by non-Algorithms catalog categories.

## Completed LeetCode Practice History Import

Current import pipeline:

1. User opens LeetCode Practice History.
2. User copies the full page text.
3. User pastes it into `/problems/import`.
4. `parseLeetCodePracticeHistory` in `lib/leetcode-history-import.ts` extracts valid rows.
5. `lib/leetcode-history-import-matching.ts` matches parsed rows to the all-category canonical LeetCode catalog by frontend ID.
6. `components/leetcode-history-import-preview.tsx` separates previously Accepted, attempted-only, Already in Library, Unmatched, and duplicate rows.
7. The user clicks `Import problems`; the Server Action re-resolves every frontend ID from the server-only catalog and sends one bounded canonical batch to the protected RPC.
8. The result summary reports imported, already tracked, attempted-only skipped, unmatched-not-sent, and failed counts.

Implemented parser behavior:

- Detects problem lines using frontend problem number and title.
- Classifies rows with any `Accepted` result as practiced.
- Classifies rows with only non-accepted attempts as scheduled.
- Deduplicates valid history rows by `frontendId`.
- Lets Accepted rows win when the same problem has accepted and non-accepted rows.
- Keeps the most recent valid accepted row when duplicate accepted rows have normalized dates.
- Normalizes difficulty to `easy`, `medium`, or `hard`.
- Derives a best-effort LeetCode slug and LeetCode URL from the title.
- Preserves raw `dateText`.
- Adds normalized `historyDate` for both practiced and scheduled candidates.
- Supports these date formats:
  - `Today`
  - `Yesterday`
  - weekday abbreviations
  - month/day
  - `YYYY.MM.DD`
- Invalid dates are clearly labeled in the preview and do not block preview.
- Canonically matched rows display catalog title, slug, difficulty, LeetCode URL, topics, and category while preserving parsed history fields such as history date, result, import intent, and submission count.
- Import matching uses the expanded catalog across all LeetCode categories.
- Existing Library matching uses `user_problems.leetcode_frontend_id` first, with `user_problems.leetcode_slug` as a legacy fallback.
- Rows that are not found in the current canonical catalog are shown as Unmatched and keep their practiced/scheduled intent.
- `user_problems.source`, `external_practice_status`, and `external_activity_date` preserve external-history meaning without reusing `last_reviewed_at`.
- Previously Accepted imports start active with zero in-app reviews, mastery, and review stage. They create no `review_events` and become eligible for gradual calibration through the existing daily-plan workload.
- Attempted-only rows remain visible in preview but are skipped in V1. The current model has no useful unscheduled attempted state, and they must not be represented as solved.
- Already-tracked problems are counted without overwriting mastery, scheduling, notes, or review history. Per-user locking plus existing unique constraints make repeat and concurrent imports idempotent.
- A first real Bad/OK/Good calibration rating uses the existing review RPC, creates the first genuine review event, establishes mastery/scheduling normally, and atomically completes the calibration task.
- Migration `20261102030000_import_leetcode_history.sql` adds the metadata, calibration task support, and bulk RPC. Follow-up migration `20261103000000_refine_leetcode_history_import.sql` keeps external dates out of scheduler fields and raises the bounded batch limit to 4,000.

## Important Product Decisions

- `/dashboard` is the central daily workspace.
- Built-in roadmaps are V1.
- Custom/shared roadmaps are later.
- Imported LeetCode history is external solved history, not an in-app review.
- Bulk import should not create fake `review_events`.
- Normalized history date is the primary signal for initial imported calibration priority.
- Attempted-only history is reported but not persisted in V1.
- Submission count is informational and should not be treated as a reliable failure/mastery signal.
- A giant fixed future queue should not be pre-generated.
- Compute recommendations on demand, then snapshot today's selected tasks once; do not generate future queues.
- Review limits determine how many eligible problems surface today; they should not require rewriting every existing review date.
- The V1 canonical LeetCode catalog is static application data and includes all source categories.
- Generated catalog records include category, but category is not persisted in `user_problems`.
- Track Problem and the All LeetCode Library view use the expanded canonical catalog.
- No paid API, cookie sharing, user script, or LeetCode password flow for V1.
- Users should eventually select canonical LeetCode problems rather than create arbitrary free-text problem identities.

## Current Unfinished Feature

Local V1 implementation, Phase 4A QA, and the Phase 4B beta database rollout are complete. Roadmap catalog breadth remains intentionally limited to NeetCode 150. InterviewPrep still runs as a local Next.js application connected to cloud Supabase beta; there is no hosted Next.js beta deployment yet.

## Recommended Next Slice

Continue focused beta use through the local Next.js application, then decide whether to establish a hosted beta environment before payment work. Keep using disposable accounts for release smoke tests and verify the hosting environment targets the intended Supabase project before any future web deployment.

## Phase 4A Local End-to-End QA

- QA used only the loopback Supabase stack (`127.0.0.1:54321` API and `127.0.0.1:54322` PostgreSQL) through process-scoped environment injection. The authenticated Playwright runner rejects non-loopback URLs. No cloud database or environment file was modified.
- Two fresh disposable scratch databases ran the complete migration history and all 58 opt-in PostgreSQL tests. True two-connection races cover review-first and Apply-today-first lock ordering; both preserve genuine events, exact allocation evidence, stable denominators, and historical task snapshots.
- The authenticated Playwright suite covers real local signup/login/logout, onboarding, Sequential/Shuffled settings, roadmap follow/stop behavior, import without fake events, imported calibration, Bad/OK/Good, manual To-do, Skip today, recommendation insertion, persistence, analytics, Recent Activity, responsive themes, and shell geometry.
- Confirmed defects fixed during QA: Apply-today-first manual practice could lose allocation credit; persisted checklist disclosure state caused hydration/remount races; initial plan refresh could detach Add Problem; narrow task metadata could overflow; and several browser assertions encoded superseded UI copy/order assumptions.
- The pre-deployment beta audit was read-only. Project `beta` (`uynccgpzcogmhkiiltnq`) is marked production by Supabase and had no unexpected remote-only migrations before the separately authorized Phase 4B rollout.

## Phase 4B Cloud Beta Database Deployment

- The eight audited migrations from `20261108000000` through `20261111005000` were applied in timestamp order to project `beta` (`uynccgpzcogmhkiiltnq`) without reset, seed, role, or vault changes. Remote migration history now matches the repository through `20261111005000`.
- Post-deployment checks confirmed the V1 tables, protected RPC signatures, `security definer` and empty `search_path` posture, RLS, authenticated read-only table grants, denied anonymous access, and all 150 unique NeetCode 150 roadmap memberships.
- The unchanged local Next.js app was confirmed through beta Auth logs to target `uynccgpzcogmhkiiltnq`. A disposable confirmed account completed signup/login, onboarding, persisted plan generation, New-problem practice, Accepted-history import and first review, Apply today, Start tomorrow, NeetCode 150 follow/progress, and Dashboard/Study Plan navigation.
- Smoke-test verification found one persisted plan with two distinct completed tasks and two distinct review events, no duplicate active task slugs or completion evidence, and no PostgreSQL, permission, allocation, or missing-RPC errors. PostgREST reloaded its schema cache successfully during migration application.

## Deferred Features

- custom roadmaps
- shared/public roadmaps
- AI study coach
- deep gamification
- advanced FSRS-style scheduling
- hours-per-week planning
- full future calendar generation
- public profiles/social features
- paid or unofficial LeetCode API dependency

## Validation Status

The current planner, unified same-day additions, Practice History import, Analytics V1, and the V1 scheduling backend passed:

- Phase 3A focused authenticated Playwright passed against local Supabase. It covers first-time setup, DB-backed roadmap selection, independent review sources, Apply today, Dashboard target/assignment/shortage presentation, and a Start tomorrow revision. Desktop onboarding/Dashboard and mobile settings screenshots were opened and inspected directly.
- Phase 3A settings validation is included in the standard Node suite, including zero targets, target bounds, independent New/Review sources, roadmap requirements, selection mode, and Today/Tomorrow activation.
- Phase 3B focused authenticated Playwright passed against local Supabase. It covers the truthful Suggested state, Apply-today Follow, preserved shuffled and selected-roadmap review settings, Start-tomorrow Stop, the scheduled-change message, detail-page state, and responsive light/dark rendering. Both roadmap screenshots were opened and inspected directly.
- Phase 3B unit coverage verifies followed/suggested partitioning, no featured-roadmap duplication, genuine/imported progress, To-do exclusion, overlapping membership, exhausted-roadmap state, and preservation of independent settings.

- Standard `npm test`: 184 passed, 0 failed, and 58 opt-in scratch-database tests skipped by the ordinary command (242 total). It includes the Phase 1 scheduling matrix plus always-on Phase 2A/2B/2C migration, type, policy-parity, deterministic-reconciliation, destructive-SQL guards, Phase 3A settings, Phase 3B roadmap coverage, and settings-capability/error-handling coverage.
- The same 58 opt-in PostgreSQL tests passed with 0 failures and 0 skips against a fresh isolated loopback scratch database. Both true concurrent lock-order tests passed.
- Local `supabase db lint`: no schema errors across `extensions`, `private`, and `public` after the Phase 4A regression migration.
- The rollback-only local PostgreSQL Phase 2B check passed against the Docker-backed Supabase database. It covers settings and empty-plan creation, V1 initial practice, same-event correction without duplication, imported provisional mastery, generated allocation evidence, exact task completion, and unchanged legacy initial-practice behavior.
- The rollback-only Phase 2C PostgreSQL check passed. It covers Apply today before generation, target decreases and increases, completed/manual preservation, source and selection-mode changes, shortages, exact allocation reversal, identical retries, Start tomorrow, and legacy compatibility.
- Both rollback-only local PostgreSQL scripts (`v1-backend-local.sql` and `v1-apply-today-local.sql`) passed without retaining fixture writes.
- Import-specific isolated PostgreSQL tests: 5 passed. They cover unknown mastery/no fake events, existing-progress preservation and atomic rollback, concurrent idempotency with unchanged daily plans, calibration-to-first-review behavior, and authentication/RLS/execute permissions.
- `npm run lint` passed.
- `npm run build` passed on Next.js 16.2.9.
- Authenticated Playwright: 14 passed, 0 failed, 0 skipped. Representative Dashboard, Library, Import, Roadmaps, Study Plan, Add Problem, Recent Activity, and Analytics screenshots were opened and inspected directly across desktop/mobile and light/dark scenarios.
- Focused authenticated Playwright passed against local Supabase for optimistic OK completion, click-away default OK, queued same-event Bad/Good correction, the final-task popover surviving persisted completion, and the permanently visible completed checklist. The focused desktop popover and mobile completion screenshots were opened and inspected directly.

Daily-plan PostgreSQL integration tests cover creation/repeat calls, concurrent requests, ownership/RLS, stale inputs, empty plans, snapshots/deletion retention, timezone/DST boundaries, exact completion evidence, practiced/scheduled binding, backdated practice, Skip today/untracked deferral, and injected failures proving transaction rollback. They run only when `STUDY_PLAN_TEST_DATABASE_URL` points to an empty loopback database named `study_plan_2a_test` or a suffixed disposable variant such as `study_plan_2a_test_phase4a`; set `PSQL_PATH` when psql is not on PATH. The harness applies the real migration history and refuses remote database URLs. Normal `npm test` skips these opt-in database tests.

The full migration history through `20261111005000`, including rating, unified task insertion, V1 scheduling, and atomic reconciliation, applies successfully to isolated local scratch databases and is now applied to cloud beta project `uynccgpzcogmhkiiltnq`.

Do not claim validation for future slices unless the relevant commands were run after those changes.

## Updating This Document

Update this file after meaningful product slices or architecture decisions.

Keep these sections current:

- Completed
- Current Unfinished Feature
- Important Product Decisions
- Recommended Next Slice

Do not store temporary debugging notes or copy entire implementation files here.
