import { expect, test } from "@playwright/test";
import {
  assertNoBrowserErrors,
  captureVisualArtifact,
  expectNoPageOverflow,
  prepareVisualScenario,
  waitForVisualReadiness,
  type VisualTheme,
} from "./helpers/visual";

const scenarios = [
  { name: "desktop", viewport: { width: 1440, height: 1000 } },
  { name: "mobile", viewport: { width: 390, height: 844 } },
] as const;

for (const scenario of scenarios) {
  test(`analytics visual coverage: ${scenario.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(scenario.viewport);
    const screenshots = new Map<VisualTheme, Buffer>();
    const themeStyles = new Map<
      VisualTheme,
      { background: string; colorScheme: string }
    >();

    for (const theme of ["light", "dark"] as const) {
      const browserErrors = await prepareVisualScenario(page, theme);
      await page.goto("/analytics?demo=1");
      await waitForVisualReadiness(page, theme);

      await expect(page.getByText("Demo data", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
      await expect(page.getByText("Consistency", { exact: true })).toHaveCount(0);
      await expect(
        page.locator(
          '[data-chart-bar="easy"], [data-chart-bar="medium"], [data-chart-bar="hard"]',
        ),
      ).not.toHaveCount(0);
      await expect(page.getByRole("button", { name: "Month", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(
        page.getByRole("button", { name: "Difficulty", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");

      const nonzeroBars = await page
        .locator(
          '[data-chart-bar="easy"], [data-chart-bar="medium"], [data-chart-bar="hard"]',
        )
        .evaluateAll(
          (bars) =>
            bars.filter((bar) => {
              const bounds = bar.getBoundingClientRect();
              return bounds.width > 0 && bounds.height > 0;
            }).length,
        );
      expect(nonzeroBars).toBeGreaterThan(0);
      await expect(page.locator('[data-chart-total-label="true"]')).not.toHaveCount(0);

      if (scenario.name === "mobile") {
        const chartBounds = await page
          .locator('svg[aria-label="Practice Over Time stacked bar chart"]')
          .evaluate((chart) => {
            const bounds = chart.getBoundingClientRect();
            return {
              left: bounds.left,
              right: bounds.right,
              viewportWidth: document.documentElement.clientWidth,
            };
          });
        expect(chartBounds.left).toBeGreaterThanOrEqual(0);
        expect(chartBounds.right).toBeLessThanOrEqual(chartBounds.viewportWidth);
      }

      const styles = await page.evaluate(() => {
        const bodyStyles = window.getComputedStyle(document.body);
        return {
          background: bodyStyles.backgroundColor,
          colorScheme: bodyStyles.colorScheme,
        };
      });
      themeStyles.set(theme, styles);

      await expectNoPageOverflow(page);
      const artifact = await captureVisualArtifact(
        page,
        testInfo,
        `analytics-${scenario.name}-${theme}`,
      );
      screenshots.set(theme, artifact.screenshot);
      assertNoBrowserErrors(browserErrors);
    }

    expect(themeStyles.get("light")?.colorScheme).toBe("light");
    expect(themeStyles.get("dark")?.colorScheme).toBe("dark");
    expect(themeStyles.get("light")?.background).not.toBe(
      themeStyles.get("dark")?.background,
    );
    expect(screenshots.get("light")?.equals(screenshots.get("dark")!)).toBe(
      false,
    );
  });
}

test("Practice Over Time controls switch grouping and stacked breakdowns", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const browserErrors = await prepareVisualScenario(page, "light");
  await page.goto("/analytics?demo=1");
  await waitForVisualReadiness(page, "light");

  const chartBuckets = page.locator(
    'svg[aria-label="Practice Over Time stacked bar chart"] > g[tabindex="0"]',
  );
  await expect(chartBuckets).toHaveCount(12);

  const weekButton = page.getByRole("button", { name: "Week", exact: true });
  await weekButton.click();
  await expect(weekButton).toHaveAttribute("aria-pressed", "true");
  await expect(chartBuckets).toHaveCount(12);

  const activityButton = page.getByRole("button", {
    name: "Activity type",
    exact: true,
  });
  await activityButton.click();
  await expect(activityButton).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator(
      '[data-chart-bar="historicalAccepted"], [data-chart-bar="new"], [data-chart-bar="review"]',
    ),
  ).not.toHaveCount(0);

  const importedBucket = chartBuckets
    .filter({ has: page.locator('[data-chart-bar="historicalAccepted"]') })
    .first();
  await importedBucket.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(page.getByRole("tooltip")).toContainText("Historical Accepted");

  assertNoBrowserErrors(browserErrors);
});

test("visual demo auth gate rejects ordinary and spoofed analytics requests", async ({
  browser,
  baseURL,
}) => {
  const ordinaryContext = await browser.newContext();
  const ordinaryPage = await ordinaryContext.newPage();
  await ordinaryPage.goto(`${baseURL}/analytics`);
  await expect(ordinaryPage).toHaveURL(/\/sign-in$/);
  await ordinaryContext.close();

  const spoofedContext = await browser.newContext({
    extraHTTPHeaders: { "x-interviewprep-visual-test": "analytics-demo" },
  });
  const spoofedPage = await spoofedContext.newPage();
  await spoofedPage.goto(`${baseURL}/analytics`);
  await expect(spoofedPage).toHaveURL(/\/sign-in$/);
  await spoofedContext.close();
});
