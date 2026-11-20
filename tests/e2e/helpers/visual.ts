import { expect, type Page, type TestInfo } from "@playwright/test";

export type VisualTheme = "light" | "dark";

export async function prepareVisualScenario(
  page: Page,
  theme: VisualTheme,
) {
  const browserErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.addInitScript((selectedTheme) => {
    window.localStorage.setItem("theme", selectedTheme);
  }, theme);
  await page.emulateMedia({ colorScheme: theme });

  return browserErrors;
}

export async function waitForVisualReadiness(page: Page, theme: VisualTheme) {
  await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
  await page.evaluate(() => document.fonts.ready);
  await waitForAppHydration(page);
  await expect(page.getByRole("heading", { name: "Your progress" })).toBeVisible();
}

export async function waitForAppHydration(page: Page) {
  await expect(
    page.locator('button[aria-label="Toggle theme"] svg').first(),
  ).toBeAttached();
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
}

export async function expectNoPageOverflow(page: Page) {
  await expect.poll(
    () => page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
    { timeout: 2_000, intervals: [50, 100, 250] },
  ).toBeLessThanOrEqual(0);

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${element.className && typeof element.className === "string" ? `.${element.className.trim().split(/\s+/).slice(0, 3).join(".")}` : ""}`,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter(({ left, right }) => left < -1 || right > document.documentElement.clientWidth + 1)
      .slice(0, 10),
  }));
  expect(
    dimensions.scrollWidth,
    `Page overflowed by ${dimensions.scrollWidth - dimensions.clientWidth}px. Offenders: ${JSON.stringify(dimensions.offenders)}`,
  ).toBeLessThanOrEqual(dimensions.clientWidth);
}

export async function captureVisualArtifact(
  page: Page,
  testInfo: TestInfo,
  name: string,
  fullPage = true,
) {
  const path = testInfo.outputPath(`${name}.png`);
  const screenshot = await page.screenshot({
    path,
    fullPage,
    caret: "initial",
  });
  await testInfo.attach(name, { body: screenshot, contentType: "image/png" });
  return { path, screenshot };
}

export function assertNoBrowserErrors(errors: string[]) {
  expect(errors, errors.join("\n")).toEqual([]);
}
