# V1 Beta QA

## Purpose

This suite exercises production-like user journeys against local Supabase and a
disposable test account. It must never target a linked or production database.

## Run

```bash
npx supabase start
npm run test:e2e
```

The runner accepts ordinary Playwright arguments, for example:

```bash
npm run test:e2e -- --grep "Practice History"
```

## Safety Boundary

- Local API must be `127.0.0.1:54121` or `localhost:54121`.
- Local database status must point to `127.0.0.1:54122/postgres`.
- Supabase keys are passed to the child process in memory and are not written to files.
- Test users use `example.test` addresses and are deleted after the suite.
- Auth is real local GoTrue auth; the Analytics demo bypass is disabled.
- Fixtures and browser actions only write to local Postgres.

## Coverage

- signup, sign in, sign out, and protected-route redirects
- Practice History preview, confirmed import, and Library visibility
- imported Accepted metadata and absence of fake review events
- calibration, daily plan creation, stable persistence, and all three ratings
- Skip today and deferred-plan persistence
- Keep studying review and roadmap practice without plan mutation
- Analytics backed by the resulting real local review events
- Dashboard, Library, Import, Roadmap, and Analytics screenshots at desktop and mobile sizes in both themes

Screenshots remain disposable under `test-results/authenticated/`. Open every
required image before treating a successful run as visual approval.
