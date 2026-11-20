# Visual Testing

The repository uses Playwright with headless Chromium for local browser and visual checks. The configuration is route-agnostic; current coverage is limited to `/analytics?demo=1`.

## First-Time Setup

Install project dependencies and Playwright's matching Chromium build:

```bash
npm install
npx playwright install chromium
```

The browser binary is stored in Playwright's user-level cache, not in this repository.

## Run The Suite

```bash
npm run test:visual
```

Run the production-like authenticated V1 journey against the local Supabase stack:

```bash
npx supabase start
npm run test:e2e
```

`test:e2e` reads credentials from `supabase status` in memory, rejects any
non-loopback API or database URL, and creates disposable users. It never reads
`.env.local`, uses the linked project, or enables the Analytics demo bypass.

Playwright starts an isolated Next.js development server on `127.0.0.1:3100`. Its `.next-playwright` build directory is separate from normal development, so an existing `next dev` process can remain running.

To use another port in Git Bash:

```bash
PLAYWRIGHT_PORT=3200 npm run test:visual
```

In PowerShell:

```powershell
$env:PLAYWRIGHT_PORT = "3200"
npm run test:visual
```

Open the HTML report with:

```bash
npm run test:visual:report
```

## Artifacts And Review

Screenshots, traces, videos, and the HTML report are disposable local artifacts under:

- `test-results/`
- `playwright-report/`

The Analytics spec attaches named full-page images for desktop and mobile in light and dark themes. A passing test is not visual approval: open every generated PNG and inspect chart visibility, heatmap shape, cards, typography, spacing, responsive overflow, and theme contrast.

## Authentication Isolation

The Analytics fixture contains deterministic development-only data and performs no Supabase reads or writes. The unauthenticated visual path is enabled only when all of these conditions hold:

- Next.js is running in development.
- `PLAYWRIGHT_TEST=1` is set by the Playwright web server.
- The path is exactly `/analytics`.
- The only query parameter is `demo=1`.

`proxy.ts` removes any browser-supplied visual-test header and creates the trusted upstream marker only after those checks. The root layout and Analytics page branch before creating a Supabase client. Normal development requests still use real authentication, and production cannot enable the exception.

## Adding Future Routes

Add route specs under `tests/e2e/` and reuse `tests/e2e/helpers/visual.ts` for:

- light/dark theme setup
- console and page-error capture
- font and hydration readiness
- page-overflow checks
- named screenshot capture and report attachment

Dashboard, Problems, and Import can add their own narrowly scoped fixture or authenticated setup without changing the shared Playwright configuration.

The authenticated suite uses `playwright.authenticated.config.ts` and can add
more real-user route specs without changing the Analytics demo configuration.
Its screenshots are written under `test-results/authenticated/`.
