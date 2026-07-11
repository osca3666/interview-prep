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

- `/dashboard` is the main workspace. It shows the current goal shell, roadmap progress, due review queue, Add Problem modal, and Progress table.
- `/problems` is the user's Library. It keeps the inline Add Problem form and tracked-problem Progress table.
- `/problems/import` is the LeetCode Practice History import preview flow.
- `/roadmaps/neetcode-150` is the NeetCode 150 checklist/planning page.
- `/review` was intentionally removed as a page. Do not restore it. `app/review/actions.ts` still exists for Server Actions used by the dashboard review queue.
- `/practice-history` was intentionally removed. Do not restore it.

## Current Architecture

- Next.js App Router with Server Components by default.
- Client Components are used for browser interaction, such as local search, theme toggles, timezone capture, and import preview parsing.
- Supabase Auth and Postgres back the user data.
- Simple reads use Supabase `.select()` queries.
- Important state transitions use a Next.js Server Action plus a protected Supabase RPC.
- Generated Supabase TypeScript types are used for RPC args and table shapes.
- RLS and user ownership checks are enforced by authenticated access patterns and protected RPCs.

Main transition flow:

React form/UI -> Next.js Server Action -> typed data wrapper -> Supabase RPC -> protected database transition -> revalidation/redirect.

## Completed Core Review Features

- Add Problem is implemented through `app/problems/actions.ts`, `data/problems.ts`, and the `create_user_problem_with_timezone` RPC.
- Add Problem supports practiced and scheduled start modes:
  - practiced mode counts as the first practice/review event.
  - scheduled mode creates a problem scheduled for review without counting practice.
- Timezone-aware start-date validation is shared through `lib/time-zone.ts` and date-only validation through `lib/date-only.ts`.
- Dashboard due reviews are loaded by `listDueProblems` in `data/reviews.ts`.
- The review queue is rendered by `components/review-queue-section.tsx`.
- User-facing review ratings are `Redo`, `OK`, and `Great`; backend values are `again`, `good`, and `easy`.
- The backend still accepts `hard` for compatibility in shared rating validation, but the current UI does not show it.
- Review submission uses `submitReviewAction`, `submitProblemReview`, and the `submit_problem_review` RPC.
- Review transitions update review history, review counts, mastery, next review timing, and `schedule_version`.
- Stale-submit protection is based on `expected_schedule_version` / `schedule_version`.
- Skip today / Snooze is implemented through `snoozeReviewAction`, `snoozeProblemReview`, and the `snooze_problem_review` RPC.
- Skip today is separate from review ratings. It moves the problem to the next local day and increments `schedule_version`.
- Skip today must not create a `review_events` row or change mastery, `total_reviews`, `last_reviewed_at`, or `review_stage`.

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

## Completed LeetCode Import Preview Features

Current read-only import pipeline:

1. User opens LeetCode Practice History.
2. User copies the full page text.
3. User pastes it into `/problems/import`.
4. `parseLeetCodePracticeHistory` in `lib/leetcode-history-import.ts` extracts valid rows.
5. `components/leetcode-history-import-preview.tsx` separates Ready to import, Already in Library, duplicate accepted rows, and skipped non-accepted attempts.
6. Nothing is persisted yet.

Implemented parser behavior:

- Detects problem lines using frontend problem number and title.
- Imports only rows with exact `Accepted` result.
- Skips non-accepted attempts.
- Deduplicates accepted rows by `frontendId`.
- Keeps the most recent valid accepted row when duplicate accepted rows have normalized dates.
- Normalizes difficulty to `easy`, `medium`, or `hard`.
- Derives a best-effort LeetCode slug and LeetCode URL from the title.
- Preserves raw `dateText`.
- Adds normalized `acceptedDate`.
- Supports these date formats:
  - `Today`
  - `Yesterday`
  - weekday abbreviations
  - month/day
  - `YYYY.MM.DD`
- Invalid dates are clearly labeled in the preview and do not block preview.
- Existing Library matching currently compares the derived slug against `user_problems.leetcode_slug`.

The import flow is preview-only. There is no Confirm import behavior, import Server Action, import RPC, or database write yet.

## Important Product Decisions

- `/dashboard` is the central daily workspace.
- Built-in roadmaps are V1.
- Custom/shared roadmaps are later.
- Imported LeetCode history is external solved history, not an in-app review.
- Bulk import should not create fake `review_events`.
- Accepted date is the primary signal for initial imported calibration priority.
- Submission count is informational and should not be treated as a reliable failure/mastery signal.
- A giant fixed future queue should not be pre-generated.
- Store durable problem/review state and compute today's plan dynamically.
- Review limits determine how many eligible problems surface today; they should not require rewriting every existing review date.
- The V1 canonical LeetCode catalog should be static application data.
- No paid API, cookie sharing, user script, or LeetCode password flow for V1.
- Users should eventually select canonical LeetCode problems rather than create arbitrary free-text problem identities.

## Current Unfinished Feature

The active unfinished feature is LeetCode bulk import.

Completed:

- parser
- accepted-date normalization
- preview UI
- Library matching
- duplicate/skipped categorization
- invalid-date labeling

Not completed:

- canonical static LeetCode catalog
- frontendId-based canonical matching
- unmatched-catalog classification
- dedicated bulk-import RPC/write path
- imported calibration scheduling
- Confirm import button
- Add Problem autocomplete from the catalog

## Recommended Next Slice

The next recommended slice is canonical static LeetCode problem catalog design and foundation.

Why:

- Current import matching relies on best-effort title-derived slugs.
- Before inserting hundreds of problems, imports should resolve `frontendId` to canonical title, slug, difficulty, and URL.
- The same catalog can later power Add Problem autocomplete.

Recommended incremental sequence:

1. Define catalog type and static data format.
2. Add lookup helpers by `frontendId` and slug.
3. Add or generate the full static catalog.
4. Update import preview to use `frontendId`-based catalog matching.
5. Add an Unmatched catalog section.
6. Design the dedicated bulk-import RPC.
7. Enable Confirm import.
8. Add Add Problem autocomplete later.

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

The latest import parser and preview slices passed:

- `npm run lint`
- `npm run build`

Do not claim validation for future slices unless the relevant commands were run after those changes.

## Updating This Document

Update this file after meaningful product slices or architecture decisions.

Keep these sections current:

- Completed
- Current Unfinished Feature
- Important Product Decisions
- Recommended Next Slice

Do not store temporary debugging notes or copy entire implementation files here.
