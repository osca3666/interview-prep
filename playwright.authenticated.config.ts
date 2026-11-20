import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_AUTH_PORT ?? "3200");
const baseURL = `http://127.0.0.1:${port}`;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  throw new Error("Authenticated Playwright requires local Supabase credentials.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "v1-beta.e2e.spec.ts",
  outputDir: "test-results/authenticated",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 60_000,
  reporter: [
    ["line"],
    ["html", { outputFolder: "playwright-report/authenticated", open: "never" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    headless: true,
    locale: "en-US",
    timezoneId: "America/Denver",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [{ name: "authenticated-chromium" }],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/sign-in`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PLAYWRIGHT_E2E: "1",
      NEXT_PUBLIC_SITE_URL: baseURL,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    },
  },
});
