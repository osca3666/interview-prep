<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# InterviewPrep.com Project Instructions

## Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- Supabase Auth and Postgres
- Supabase Server Actions and RPCs
- Git Bash on Windows

## Product Direction

This app is a roadmap-based LeetCode study planner and spaced-repetition review tracker.

The core user experience is:

1. Import or add existing LeetCode progress.
2. Choose a built-in roadmap and study goal.
3. Open the dashboard and know what to study today.
4. Review previously solved problems with spaced repetition.
5. See roadmap-specific progress, mastery, and topic/category coverage.

## Current Route Responsibilities

- `/dashboard` is the main workspace.
- `/problems` is the user's Library.
- `/problems/import` is the LeetCode Practice History import flow.
- `/roadmaps/neetcode-150` is the NeetCode 150 checklist/planning page.
- `/review` was intentionally removed. Do not restore it.
- `/practice-history` was intentionally removed. Do not restore it.

## Architecture

- Simple reads may use Supabase `.select()`.
- Important state transitions should use a Next.js Server Action plus a protected Supabase RPC.
- Server Actions handle form parsing, web validation, authentication checks, redirects, and path revalidation.
- RPCs handle protected and atomic database transitions.
- Use generated Supabase TypeScript types.
- Keep Server Components as the default.
- Add `"use client"` only when browser state, effects, or event handling require it.
- Keep Client Component boundaries as small as practical.
- Never import `server-only` modules into Client Components.

## Current Product Rules

- Review ratings shown to users are `Redo`, `OK`, and `Great`.
- Their backend values are `again`, `good`, and `easy`.
- `Skip today` is not a review rating.
- Skip today must not change mastery, review count, review stage, or review history.
- Imported LeetCode history is external solved history, not an in-app review.
- Bulk import should not pretend imported rows are review events.
- Use normalized history date, not submission count, as the primary signal for initial import review priority.
- Built-in roadmaps are the V1 direction.
- Custom and shared roadmaps are later features.
- The V1 LeetCode catalog should be static application data rather than a database table or paid API dependency.

## Development Workflow

- Inspect relevant files before proposing changes.
- For meaningful or risky changes, provide a short plan and wait for approval before editing.
- Keep implementation slices small and practical.
- Prefer product progress over broad architecture rewrites.
- Do not refactor unrelated files.
- Do not casually change database schema, migrations, RLS policies, or RPCs.
- Do not read `.env.local`.
- Do not run git commands unless explicitly requested.
- Never use `git add .`.
- When asked for staging commands, stage specific files only.

## Validation

After application-code changes, run:

- `npm run lint`
- `npm run build`

Report:

- exact files changed
- important assumptions
- validation results
- any remaining risks or follow-up work

## Next.js Documentation

Follow the existing Next.js-managed instructions above.

Before using a Next.js API or convention that may have changed, read the relevant documentation under:

`node_modules/next/dist/docs/`

Do not rely only on remembered behavior from older Next.js versions.
