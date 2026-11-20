import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  createDisposableUser,
  createLocalAdminClient,
  deleteDisposableUser,
  findUserByEmail,
  getCurrentPlan,
  seedRecentActivity,
  seedDueReviewedProblems,
  seedFutureReviewedProblems,
  seedTrackedUnpracticedRoadmapProblem,
} from "./helpers/local-supabase";
import {
  assertNoBrowserErrors,
  captureVisualArtifact,
  expectNoPageOverflow,
  prepareVisualScenario,
  waitForAppHydration,
  type VisualTheme,
} from "./helpers/visual";

const admin = createLocalAdminClient();
const authEmail = `e2e-auth-${crypto.randomUUID()}@example.test`;
const authPassword = `E2e-${crypto.randomUUID()}!`;
let authUserId: string | undefined;
let workflowUser: Awaited<ReturnType<typeof createDisposableUser>>;
let skipUser: Awaited<ReturnType<typeof createDisposableUser>>;
let scheduledUser: Awaited<ReturnType<typeof createDisposableUser>>;
let recentActivityUser: Awaited<ReturnType<typeof createDisposableUser>>;
let emptyActivityUser: Awaited<ReturnType<typeof createDisposableUser>>;
let futureReviewUser: Awaited<ReturnType<typeof createDisposableUser>>;
let roadmapShortcutUser: Awaited<ReturnType<typeof createDisposableUser>>;
let studySettingsUser: Awaited<ReturnType<typeof createDisposableUser>>;
let roadmapBrowserUser: Awaited<ReturnType<typeof createDisposableUser>>;
let importedRefreshUser: Awaited<ReturnType<typeof createDisposableUser>>;
let futureReviewProblems: Awaited<ReturnType<typeof seedFutureReviewedProblems>>;
let trackedRoadmapProblem: Awaited<ReturnType<typeof seedTrackedUnpracticedRoadmapProblem>>;
const dashboardGreeting = /^(?:Good morning|Good afternoon|Good evening|Welcome back, .+)!$/;

async function signIn(page: Page, email: string, password: string, next = "/dashboard") {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replaceAll("/", "\\/")}(?:\\?.*)?$`), { timeout: 20_000 });
}

async function openAccountMenu(page: Page) {
  await page.getByRole("button", { name: "Open account menu" }).click();
  await expect(page.getByRole("menu", { name: "Account menu" })).toBeVisible();
}

async function waitForPlan(page: Page, total: number) {
  await expect(page.getByRole("heading", { name: "Today's plan" })).toBeVisible();
  await expect(page.getByText(`0/${total} completed`, { exact: false })).toBeVisible({
    timeout: 20_000,
  });
}

function taskCard(page: Page, title: string) {
  return page
    .locator('section[aria-labelledby="daily-study-heading"] li')
    .filter({ has: page.getByRole("link", { name: new RegExp(title, "i") }) })
    .first();
}

type AppShellGeometry = {
  viewport: { width: number; height: number };
  sidebarPosition: string;
  sidebar: { top: number; right: number; bottom: number; left: number; width: number; height: number };
  main: { top: number; right: number; bottom: number; left: number; width: number; height: number };
  account: { top: number; right: number; bottom: number; left: number; width: number; height: number };
  dashboardHeading: { top: number; right: number; bottom: number; left: number; width: number; height: number };
  planHeading: { top: number; right: number; bottom: number; left: number; width: number; height: number };
};

async function getAppShellGeometry(page: Page): Promise<AppShellGeometry> {
  return page.evaluate(() => {
    const sidebar = document.querySelector<HTMLElement>(
      '[aria-label="Application sidebar"]',
    );
    const main = document.querySelector<HTMLElement>("[data-app-main]");
    const account = document.querySelector<HTMLElement>("[data-sidebar-account]");
    const dashboardHeading = main?.querySelector<HTMLElement>("h1");
    const planHeading = Array.from(
      main?.querySelectorAll<HTMLElement>("h3") ?? [],
    ).find((element) => element.textContent?.trim() === "Today's plan");

    if (!sidebar || !main || !account || !dashboardHeading || !planHeading) {
      throw new Error("Authenticated dashboard shell geometry is incomplete.");
    }

    const toRect = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
    };

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      sidebarPosition: getComputedStyle(sidebar).position,
      sidebar: toRect(sidebar),
      main: toRect(main),
      account: toRect(account),
      dashboardHeading: toRect(dashboardHeading),
      planHeading: toRect(planHeading),
    };
  });
}

function expectDefaultShellGeometry(
  geometry: AppShellGeometry,
  expectedSidebarWidth: number,
) {
  const tolerance = 2;

  expect(geometry.sidebarPosition).toBe("sticky");
  expect(Math.abs(geometry.sidebar.width - expectedSidebarWidth)).toBeLessThanOrEqual(
    tolerance,
  );
  expect(Math.abs(geometry.sidebar.height - geometry.viewport.height)).toBeLessThanOrEqual(
    tolerance,
  );
  expect(Math.abs(geometry.sidebar.top)).toBeLessThanOrEqual(tolerance);
  expect(
    Math.abs(geometry.sidebar.bottom - geometry.viewport.height),
  ).toBeLessThanOrEqual(tolerance);
  expect(geometry.sidebar.right).toBeLessThanOrEqual(geometry.main.left + tolerance);
  expect(geometry.main.left).toBeGreaterThanOrEqual(expectedSidebarWidth - tolerance);
  expect(geometry.main.right).toBeLessThanOrEqual(geometry.viewport.width + tolerance);
  expect(geometry.account.bottom).toBeLessThanOrEqual(
    geometry.sidebar.bottom + tolerance,
  );
  expect(geometry.sidebar.bottom - geometry.account.bottom).toBeLessThanOrEqual(32);
  expect(geometry.dashboardHeading.left).toBeGreaterThanOrEqual(
    geometry.sidebar.right - tolerance,
  );
  expect(geometry.planHeading.left).toBeGreaterThanOrEqual(
    geometry.sidebar.right - tolerance,
  );
  expect(geometry.dashboardHeading.right).toBeLessThanOrEqual(
    geometry.viewport.width + tolerance,
  );
  expect(geometry.planHeading.right).toBeLessThanOrEqual(
    geometry.viewport.width + tolerance,
  );
  expect(geometry.dashboardHeading.width).toBeGreaterThan(0);
  expect(geometry.planHeading.width).toBeGreaterThan(0);
}

async function rateTask(page: Page, title: string, rating: "Bad" | "OK" | "Good") {
  const card = taskCard(page, title);
  await expect(card).toBeVisible();
  const trigger = card.getByRole("button", { name: /^Complete / });
  await trigger.click();
  const chooser = card.getByRole("dialog", { name: "How did it go?" });
  await expect(chooser).toBeVisible();
  await expect(chooser).toBeFocused();
  await chooser.getByRole("button", { name: rating, exact: true }).click();
  await expect
    .poll(
      async () =>
        (await taskCard(page, title).getByText("Completed", { exact: true }).count()) +
        (await page.getByText("All done for today!", { exact: true }).count()) +
        (await page.getByText("You're done for today", { exact: true }).count()),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
}

async function requestExtraStudy(page: Page, label: "Review another" | "Continue roadmap") {
  await page.getByRole("button", { name: "Add Problem", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a problem" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: new RegExp(`^${label}`) }).click();
  await expect(dialog).toBeHidden();
}

test.describe.serial("InterviewPrep V1 authenticated beta journey", () => {
  test.beforeAll(async () => {
    workflowUser = await createDisposableUser(admin, "workflow");
    skipUser = await createDisposableUser(admin, "skip");
    scheduledUser = await createDisposableUser(admin, "scheduled");
    recentActivityUser = await createDisposableUser(admin, "recent-activity");
    emptyActivityUser = await createDisposableUser(admin, "empty-activity");
    futureReviewUser = await createDisposableUser(admin, "future-review");
    roadmapShortcutUser = await createDisposableUser(admin, "roadmap-shortcut");
    studySettingsUser = await createDisposableUser(admin, "study-settings");
    roadmapBrowserUser = await createDisposableUser(admin, "roadmap-browser");
    importedRefreshUser = await createDisposableUser(admin, "imported-refresh");
    await seedRecentActivity(admin, recentActivityUser.id, 8);
    futureReviewProblems = await seedFutureReviewedProblems(admin, futureReviewUser.id);
    trackedRoadmapProblem = await seedTrackedUnpracticedRoadmapProblem(admin, roadmapShortcutUser.id);
  });

  test.afterAll(async () => {
    const signedUp = authUserId ? null : await findUserByEmail(admin, authEmail);
    await deleteDisposableUser(admin, authUserId ?? signedUp?.id);
    await deleteDisposableUser(admin, workflowUser?.id);
    await deleteDisposableUser(admin, skipUser?.id);
    await deleteDisposableUser(admin, scheduledUser?.id);
    await deleteDisposableUser(admin, recentActivityUser?.id);
    await deleteDisposableUser(admin, emptyActivityUser?.id);
    await deleteDisposableUser(admin, futureReviewUser?.id);
    await deleteDisposableUser(admin, roadmapShortcutUser?.id);
    await deleteDisposableUser(admin, studySettingsUser?.id);
    await deleteDisposableUser(admin, roadmapBrowserUser?.id);
    await deleteDisposableUser(admin, importedRefreshUser?.id);
  });

  test("signup, logout, login, and protected routes use real local auth", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto("/analytics");
    await expect(page).toHaveURL(/\/sign-in$/);

    await page.goto("/sign-up");
    await page.getByLabel("Email").fill(authEmail);
    await page.getByLabel("Password").fill(authPassword);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect
      .poll(async () => Boolean(await findUserByEmail(admin, authEmail)), {
        timeout: 20_000,
      })
      .toBe(true);
    const signedUp = await findUserByEmail(admin, authEmail);
    expect(signedUp).not.toBeNull();
    authUserId = signedUp?.id;
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: dashboardGreeting })).toBeVisible();

    await openAccountMenu(page);
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await signIn(page, authEmail, authPassword);
    await expect(page.getByRole("button", { name: "Open account menu" })).toBeVisible();
  });

  test("study plan onboarding saves real settings and supports a tomorrow revision", async ({ page }, testInfo) => {
    const browserErrors = await prepareVisualScenario(page, "dark");
    await signIn(page, studySettingsUser.email, studySettingsUser.password, "/study-plan/setup");
    await expect(page.getByRole("heading", { name: "Make each study day manageable" })).toBeVisible();
    await expect(page.getByLabel("New problems per day")).toHaveValue("1");
    await expect(page.getByLabel("Reviews per day")).toHaveValue("3");
    await expect(page.getByRole("link", { name: "Import LeetCode history" })).toBeVisible();
    await page.getByLabel("Shuffled").check();
    await page.getByLabel("Selected roadmaps only").check();
    await page.getByRole("checkbox", { name: /NeetCode 150/ }).check();
    await captureVisualArtifact(page, testInfo, "study-plan-onboarding-desktop-dark");
    await page.getByRole("button", { name: "Create my study plan" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "My Study Plan" })).toBeVisible();
    await expect(page.getByText("1 automatic", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expectNoPageOverflow(page);
    await captureVisualArtifact(page, testInfo, "study-plan-dashboard-summary-desktop-dark");

    const firstRevision = await admin.from("study_plan_setting_revisions")
      .select("*").eq("user_id", studySettingsUser.id).order("version", { ascending: false })
      .limit(1).single();
    expect(firstRevision.error).toBeNull();
    expect(firstRevision.data).toMatchObject({
      daily_new_target: 1,
      daily_review_target: 3,
      new_selection_mode: "shuffled",
      followed_roadmap_id: null,
      version: 1,
    });

    await page.goto("/study-plan");
    await expect(page.getByRole("heading", { name: "Shape your daily workload" })).toBeVisible();
    await expect(page.getByLabel("Reviews per day")).toHaveValue("3");
    await page.getByLabel("Reviews per day").fill("0");
    await page.getByLabel("Start tomorrow").check();
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoPageOverflow(page);
    await captureVisualArtifact(page, testInfo, "study-plan-settings-mobile-dark");
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await expect(page.locator("html")).toHaveClass(/\blight\b/);
    await captureVisualArtifact(page, testInfo, "study-plan-settings-mobile-light");
    await page.getByRole("button", { name: "Save study plan" }).click();
    await expect(page.getByText("Your changes will start tomorrow.")).toBeVisible({ timeout: 20_000 });

    const revisions = await admin.from("study_plan_setting_revisions")
      .select("version,daily_review_target,effective_study_date")
      .eq("user_id", studySettingsUser.id).order("version", { ascending: true });
    expect(revisions.error).toBeNull();
    expect(revisions.data).toHaveLength(2);
    expect(revisions.data?.[1]).toMatchObject({ version: 2, daily_review_target: 0 });
    expect(revisions.data?.[1]?.effective_study_date)
      .not.toBe(revisions.data?.[0]?.effective_study_date);
    assertNoBrowserErrors(browserErrors);
  });

  test("roadmaps browser follows now, schedules a stop, and preserves progress UI", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const browserErrors = await prepareVisualScenario(page, "dark");
    await signIn(
      page,
      roadmapBrowserUser.email,
      roadmapBrowserUser.password,
      "/study-plan/setup",
    );
    await page.getByLabel("Shuffled").check();
    await page.getByLabel("Selected roadmaps only").check();
    await page.getByRole("checkbox", { name: /NeetCode 150/ }).check();
    await page.getByRole("button", { name: "Create my study plan" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });

    await page.goto("/roadmaps");
    await expect(page.getByRole("heading", { name: "Choose your path" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Suggested starting point" })).toBeVisible();
    await expect(page.getByText("Suggested", { exact: true })).toBeVisible();
    await expect(page.getByText("Following", { exact: true })).toHaveCount(0);
    await expectNoPageOverflow(page);
    await captureVisualArtifact(page, testInfo, "roadmaps-suggested-desktop-dark");

    await page.getByRole("button", { name: "Follow roadmap", exact: true }).click();
    await page.getByRole("button", { name: "Apply today", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Currently following" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Following", { exact: true })).toBeVisible();
    await expect(page.getByText("Shuffled selection", { exact: true })).toBeVisible();

    const currentRevision = await admin
      .from("study_plan_setting_revisions")
      .select("followed_roadmap_id,new_selection_mode,review_allocation_context_id")
      .eq("user_id", roadmapBrowserUser.id)
      .order("version", { ascending: false })
      .limit(1)
      .single();
    expect(currentRevision.error).toBeNull();
    expect(currentRevision.data).toMatchObject({
      followed_roadmap_id: "neetcode-150",
      new_selection_mode: "shuffled",
    });
    const reviewSource = await admin
      .from("review_allocation_contexts")
      .select("review_source")
      .eq("id", currentRevision.data!.review_allocation_context_id)
      .single();
    expect(reviewSource.data?.review_source).toBe("selected_roadmaps");

    await page.getByRole("button", { name: "Stop following", exact: true }).click();
    await page.getByRole("button", { name: "Start tomorrow", exact: true }).click();
    await expect(page.getByText(/Upcoming change:/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/You will stop following/i)).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await expect(page.locator("html")).toHaveClass(/\blight\b/);
    await expectNoPageOverflow(page);
    await captureVisualArtifact(page, testInfo, "roadmaps-following-mobile-light");

    await page.goto("/roadmaps/neetcode-150");
    await expect(page.getByRole("heading", { name: "NeetCode 150" })).toBeVisible();
    await expect(page.getByText("Shuffled New selection", { exact: true })).toBeVisible();
    assertNoBrowserErrors(browserErrors);
  });

  test("Practice History preview/import populates Library without fake review events", async ({ page }) => {
    await seedDueReviewedProblems(admin, workflowUser.id, 4);
    await signIn(page, workflowUser.email, workflowUser.password, "/problems/import");

    const history = `2 hours ago\n175. Combine Two Tables\nEasy\nAccepted\n1\n\nToday\n4. Median of Two Sorted Arrays\nHard\nWrong Answer\n2`;
    await page.getByLabel("LeetCode Practice History text").fill(history);
    await page.getByRole("button", { name: "Preview import" }).click();
    await expect(page.getByText("Ready to import: previously accepted (1)")).toBeVisible();
    await expect(page.getByText("Attempted-only, not imported (1)")).toBeVisible();
    await page.getByRole("button", { name: "Import problems" }).click();
    await expect(page.getByText("Import complete")).toBeVisible();
    await expect(page.getByText(/1 imported.*1 attempted-only skipped/)).toBeVisible();

    const imported = await admin
      .from("user_problems")
      .select("id,source,external_practice_status,total_reviews,mastery_score,review_stage")
      .eq("user_id", workflowUser.id)
      .eq("leetcode_frontend_id", "175")
      .single();
    expect(imported.error).toBeNull();
    expect(imported.data).toMatchObject({
      source: "leetcode_import",
      external_practice_status: "accepted",
      total_reviews: 0,
      mastery_score: 0,
      review_stage: 0,
    });
    const importedEvents = await admin
      .from("review_events")
      .select("id", { count: "exact", head: true })
      .eq("user_problem_id", imported.data!.id);
    expect(importedEvents.count).toBe(0);
    const attempted = await admin
      .from("user_problems")
      .select("id", { count: "exact", head: true })
      .eq("user_id", workflowUser.id)
      .eq("leetcode_frontend_id", "4");
    expect(attempted.count).toBe(0);

    await page.goto("/problems");
    await expect(page.getByRole("heading", { name: "Problem library" })).toBeVisible();
    await expect(page.getByRole("link", { name: /175\. Combine Two Tables/ })).toBeVisible();
  });

  test("an imported Accepted review settles the plan and activity UI without a page reload", async ({ page }) => {
    const inserted = await admin.from("user_problems").insert({
      user_id: importedRefreshUser.id,
      leetcode_frontend_id: "175",
      leetcode_slug: "combine-two-tables",
      leetcode_url: "https://leetcode.com/problems/combine-two-tables/",
      title: "Combine Two Tables",
      difficulty: "easy",
      leetcode_topics: ["Database"],
      lifecycle_state: "active",
      mastery_score: 0,
      review_stage: 0,
      total_reviews: 0,
      next_review_at: new Date().toISOString(),
      source: "leetcode_import",
      external_practice_status: "accepted",
      external_activity_date: new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10),
    }).select("id").single();
    expect(inserted.error).toBeNull();

    await signIn(
      page,
      importedRefreshUser.email,
      importedRefreshUser.password,
      "/study-plan/setup",
    );
    await page.getByLabel("New problems per day").fill("0");
    await page.getByLabel("Reviews per day").fill("1");
    await page.getByRole("button", { name: "Create my study plan" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
    await waitForPlan(page, 1);

    const card = taskCard(page, "Combine Two Tables");
    await card.getByRole("button", { name: /^Complete / }).click();
    const chooser = card.getByRole("dialog", { name: "How did it go?" });
    await expect(chooser).toBeVisible();
    await chooser.getByRole("button", { name: "OK", exact: true }).click();

    // The actionable control disappears only after the client has consumed a
    // fresh persisted workspace; the optimistic row still contains it.
    await expect(card.getByRole("button", { name: /^Complete / })).toHaveCount(0, {
      timeout: 20_000,
    });
    await expect(page.getByText("1/1 completed", { exact: true })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Today's study plan completion" }))
      .toHaveAttribute("aria-valuenow", "1");
    await expect(page.locator("[data-recent-activity]").getByRole("link", {
      name: /175\. Combine Two Tables/i,
    })).toBeVisible({ timeout: 20_000 });

    const problem = await admin.from("user_problems")
      .select("total_reviews,mastery_score")
      .eq("id", inserted.data!.id)
      .single();
    expect(problem.error).toBeNull();
    expect(problem.data).toMatchObject({ total_reviews: 1, mastery_score: 4 });

    const events = await admin.from("review_events")
      .select("id,rating", { count: "exact" })
      .eq("user_problem_id", inserted.data!.id);
    expect(events.error).toBeNull();
    expect(events.count).toBe(1);
    expect(events.data?.[0]?.rating).toBe("ok");

    const persisted = await getCurrentPlan(admin, importedRefreshUser.id);
    expect(persisted?.plan.planned_task_count).toBe(1);
    expect(persisted?.tasks).toHaveLength(1);
    expect(persisted?.tasks[0]).toMatchObject({
      kind: "calibration",
      status: "completed",
    });
    expect(persisted?.tasks[0].completion_event_id_snapshot).toBe(events.data?.[0]?.id);
  });

  test("persisted daily plan calibrates imports and handles Bad, OK, and Good", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const existingProblems = await admin
      .from("user_problems")
      .select("id", { count: "exact", head: true })
      .eq("user_id", workflowUser.id);
    if ((existingProblems.count ?? 0) === 0) {
      await seedDueReviewedProblems(admin, workflowUser.id, 4);
    }
    const imported = await admin
      .from("user_problems")
      .select("id", { count: "exact", head: true })
      .eq("user_id", workflowUser.id)
      .eq("leetcode_frontend_id", "175");
    if ((imported.count ?? 0) === 0) {
      const seededImport = await admin.from("user_problems").insert({
        user_id: workflowUser.id,
        leetcode_frontend_id: "175",
        leetcode_slug: "combine-two-tables",
        leetcode_url: "https://leetcode.com/problems/combine-two-tables/",
        title: "Combine Two Tables",
        difficulty: "easy",
        leetcode_topics: ["Database"],
        lifecycle_state: "active",
        mastery_score: 0,
        review_stage: 0,
        total_reviews: 0,
        next_review_at: new Date().toISOString(),
        source: "leetcode_import",
        external_practice_status: "accepted",
        external_activity_date: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
      });
      if (seededImport.error) throw seededImport.error;
    }
    const browserErrors = await prepareVisualScenario(page, "light");
    await signIn(page, workflowUser.email, workflowUser.password);
    await waitForPlan(page, 4);
    const initial = await getCurrentPlan(admin, workflowUser.id);
    expect(initial?.plan.planned_task_count).toBe(4);
    expect(initial?.tasks.filter((task) => task.kind === "review")).toHaveLength(3);
    expect(initial?.tasks.filter((task) => task.kind === "calibration")).toHaveLength(1);

    const reviews = initial!.tasks.filter((task) => task.kind === "review");
    const firstCard = taskCard(page, reviews[0].title);
    const firstLink = firstCard.getByRole("link", { name: new RegExp(reviews[0].title, "i") });
    const originalSnapshot = initial!.tasks.map(({ id, status, completion_event_id_snapshot }) => ({ id, status, completion_event_id_snapshot }));
    const firstEventCountBefore = await admin
      .from("review_events")
      .select("id", { count: "exact", head: true })
      .eq("user_problem_id", reviews[0].user_problem_id!);
    const popupPromise = page.waitForEvent("popup");
    await firstLink.click();
    const leetCodePage = await popupPromise;
    await expect.poll(() => leetCodePage.url()).toContain("leetcode.com/problems/");
    await leetCodePage.close();
    expect((await getCurrentPlan(admin, workflowUser.id))!.tasks.map(({ id, status, completion_event_id_snapshot }) => ({ id, status, completion_event_id_snapshot }))).toEqual(originalSnapshot);

    const firstTrigger = firstCard.getByRole("button", { name: /^Complete / });
    await firstTrigger.click();
    const firstChooser = firstCard.getByRole("dialog", { name: "How did it go?" });
    await expect(firstChooser).toBeFocused();
    await captureVisualArtifact(page, testInfo, "study-plan-rating-popover-1440-light", false);
    await expect.poll(async () => {
      const current = await getCurrentPlan(admin, workflowUser.id);
      return current?.tasks.find((task) => task.id === reviews[0].id)?.completed_review_event_id ?? null;
    }).not.toBeNull();
    await expect(firstChooser).toBeVisible();
    await firstChooser.getByRole("button", { name: "Bad", exact: true }).click();
    await expect.poll(async () => {
      const current = await getCurrentPlan(admin, workflowUser.id);
      const completedTask = current!.tasks.find((task) => task.id === reviews[0].id);
      if (!completedTask?.completed_review_event_id) return null;
      const event = await admin
        .from("review_events")
        .select("rating")
        .eq("id", completedTask.completed_review_event_id)
        .single();
      return event.data?.rating ?? null;
    }).toBe("bad");
    const firstEventCountAfter = await admin
      .from("review_events")
      .select("id", { count: "exact", head: true })
      .eq("user_problem_id", reviews[0].user_problem_id!);
    expect(firstEventCountAfter.count).toBe((firstEventCountBefore.count ?? 0) + 1);
    await expectNoPageOverflow(page);

    await page.setViewportSize({ width: 1024, height: 900 });
    const defaultOkCard = taskCard(page, reviews[1].title);
    await defaultOkCard.getByRole("button", { name: /^Complete / }).click();
    const defaultOkChooser = defaultOkCard.getByRole("dialog", { name: "How did it go?" });
    await expect(defaultOkChooser).toBeVisible();
    await page.getByRole("heading", { name: "Today's plan", exact: true }).click();
    await expect(defaultOkChooser).toBeHidden();
    await expect.poll(async () => {
      const current = await getCurrentPlan(admin, workflowUser.id);
      const task = current?.tasks.find((item) => item.id === reviews[1].id);
      if (!task?.completed_review_event_id) return null;
      const event = await admin.from("review_events").select("rating").eq("id", task.completed_review_event_id).single();
      return event.data?.rating ?? null;
    }).toBe("ok");
    await rateTask(page, reviews[2].title, "Good");
    const calibration = initial!.tasks.find((task) => task.kind === "calibration")!;
    const finalCard = taskCard(page, calibration.title);
    await finalCard.getByRole("button", { name: /^Complete / }).click();
    const finalChooser = finalCard.getByRole("dialog", { name: "How did it go?" });
    await expect(finalChooser).toBeVisible();
    await expect(page.getByText("All done for today!", { exact: true })).toBeVisible();
    await expect(finalChooser).toBeVisible();
    await expect(page.locator('[data-study-task-row]')).toHaveCount(4);
    await finalChooser.getByRole("button", { name: "OK", exact: true }).click();

    await expect(page.getByText("All done for today!", { exact: true })).toBeVisible();
    await expect(page.getByText("4/4 completed", { exact: true })).toBeVisible();
    await expect(page.locator('[data-study-task-row]')).toHaveCount(4);
    await expect(page.getByText("View today's problems", { exact: false })).toHaveCount(0);
    await expect.poll(async () => {
      const current = await getCurrentPlan(admin, workflowUser.id);
      return current?.tasks.every((task) => task.status === "completed") ?? false;
    }).toBe(true);
    await expect(finalChooser).toBeHidden();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Add Problem", exact: true }).click();
    const addProblem = page.getByRole("dialog", { name: "Add a problem" });
    await expect(addProblem.getByRole("button", { name: /^Review another/ })).toBeVisible();
    await expect(addProblem.getByRole("button", { name: /^Continue roadmap/ })).toBeVisible();
    await addProblem.getByRole("button", { name: "Close Add Problem" }).click();
    const completed = await getCurrentPlan(admin, workflowUser.id);
    expect(completed?.tasks.every((task) => task.status === "completed")).toBe(true);
    expect(completed?.tasks.every((task) => task.completion_event_id_snapshot)).toBe(true);
    const calibrationEvents = await admin
      .from("review_events")
      .select("id", { count: "exact", head: true })
      .eq("user_problem_id", calibration.user_problem_id!);
    expect(calibrationEvents.count).toBe(1);

    await page.setViewportSize({ width: 390, height: 844 });
    await captureVisualArtifact(page, testInfo, "study-plan-completed-390-light", false);

    await page.reload();
    await expect(page.getByText("All done for today!", { exact: true })).toBeVisible();
    await expect(page.getByText("4/4 completed", { exact: true })).toBeVisible();
    assertNoBrowserErrors(browserErrors);
  });

  test("recommended work joins the persisted checklist, reorders on completion, and survives refresh", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const existing = await admin.from("user_problems")
      .select("id", { count: "exact", head: true })
      .eq("user_id", workflowUser.id);
    if ((existing.count ?? 0) === 0) await seedDueReviewedProblems(admin, workflowUser.id, 5);
    await signIn(page, workflowUser.email, workflowUser.password);
    let before = await getCurrentPlan(admin, workflowUser.id);
    if (!before) await waitForPlan(page, 4);
    before = await getCurrentPlan(admin, workflowUser.id);
    for (const task of before!.tasks.filter((item) => item.status === "pending")) {
      await rateTask(page, task.title, "OK");
    }
    await expect.poll(async () => {
      const current = await getCurrentPlan(admin, workflowUser.id);
      return current?.tasks.every((task) => task.status === "completed") ?? false;
    }, { timeout: 20_000 }).toBe(true);
    before = await getCurrentPlan(admin, workflowUser.id);
    expect(before!.plan.planned_task_count).toBe(4);
    expect(before!.tasks.every((task) => task.status === "completed")).toBe(true);

    await requestExtraStudy(page, "Review another");
    await expect(page.getByText("4/5 completed", { exact: true })).toBeVisible({ timeout: 20_000 });
    const appended = await getCurrentPlan(admin, workflowUser.id);
    expect(appended!.plan.planned_task_count).toBe(5);
    const recommended = appended!.tasks.find((task) => !before!.tasks.some((existing) => existing.id === task.id));
    expect(recommended?.status).toBe("pending");
    const rowsBefore = page.locator('[data-study-task-row]');
    await expect(rowsBefore).toHaveCount(4);
    await page.getByRole("button", { name: "Show all 5 problems" }).click();
    await expect(rowsBefore).toHaveCount(5);
    await expect(rowsBefore.first()).toContainText(recommended!.title);
    await expect(page.getByRole("button", { name: "Dismiss optional problem" })).toHaveCount(0);
    await captureVisualArtifact(page, testInfo, "recommended-task-at-top-1440", false);

    await rateTask(page, recommended!.title, "OK");
    await expect(page.getByText("5/5 completed", { exact: true })).toBeVisible();
    const showAllAfterRating = page.getByRole("button", { name: "Show all 5 problems" });
    if (await showAllAfterRating.isVisible()) await showAllAfterRating.click();
    const rowsAfter = page.locator('[data-study-task-row]');
    await expect(rowsAfter.last()).toContainText(recommended!.title);

    await page.reload();
    await expect(page.getByText("5/5 completed", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Show all 5 problems" }).click();
    await expect(page.locator('[data-study-task-row]').last()).toContainText(recommended!.title);
    const persisted = await getCurrentPlan(admin, workflowUser.id);
    expect(persisted!.plan.planned_task_count).toBe(5);
    expect(persisted!.tasks.find((task) => task.id === recommended!.id)?.status).toBe("completed");
  });

  test("Review another adds the earliest practiced problem even when its review is in the future", async ({ page }) => {
    await signIn(page, futureReviewUser.email, futureReviewUser.password);
    await expect(page.getByRole("heading", { name: "Today's plan" })).toBeVisible();
    await expect.poll(async () => (await getCurrentPlan(admin, futureReviewUser.id))?.tasks.length ?? 0, {
      timeout: 20_000,
    }).toBeGreaterThan(0);

    const before = await getCurrentPlan(admin, futureReviewUser.id);
    expect(before).not.toBeNull();
    const eventCountBefore = await admin.from("review_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", futureReviewUser.id);
    expect(eventCountBefore.error).toBeNull();

    await requestExtraStudy(page, "Review another");
    await expect.poll(async () => {
      const current = await getCurrentPlan(admin, futureReviewUser.id);
      return current?.plan.planned_task_count ?? 0;
    }, { timeout: 20_000 }).toBe(before!.plan.planned_task_count + 1);

    const after = await getCurrentPlan(admin, futureReviewUser.id);
    const added = after!.tasks.find((task) => !before!.tasks.some((existing) => existing.id === task.id));
    expect(added).toMatchObject({
      title: futureReviewProblems[0].title,
      kind: "review",
      status: "pending",
      assignment_source: "manual_today",
      user_problem_id: futureReviewProblems[0].id,
    });
    expect(Date.parse(futureReviewProblems[0].next_review_at)).toBeGreaterThan(Date.now());
    const eventCountAfter = await admin.from("review_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", futureReviewUser.id);
    expect(eventCountAfter.count).toBe(eventCountBefore.count);
    await expect(taskCard(page, futureReviewProblems[0].title)).toBeVisible();

    await page.reload();
    await expect(taskCard(page, futureReviewProblems[0].title)).toBeVisible();
  });

  test("Continue roadmap adds a tracked never-practiced problem as a pending New task", async ({ page }) => {
    await signIn(page, roadmapShortcutUser.email, roadmapShortcutUser.password);
    await expect(page.getByRole("heading", { name: "Today's plan" })).toBeVisible();
    await expect.poll(async () => (await getCurrentPlan(admin, roadmapShortcutUser.id))?.tasks.length ?? 0, {
      timeout: 20_000,
    }).toBeGreaterThan(0);

    const before = await getCurrentPlan(admin, roadmapShortcutUser.id);
    expect(before).not.toBeNull();
    const eventCountBefore = await admin.from("review_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", roadmapShortcutUser.id);
    expect(eventCountBefore.error).toBeNull();

    await requestExtraStudy(page, "Continue roadmap");
    await expect.poll(async () => {
      const current = await getCurrentPlan(admin, roadmapShortcutUser.id);
      return current?.plan.planned_task_count ?? 0;
    }, { timeout: 20_000 }).toBe(before!.plan.planned_task_count + 1);

    const after = await getCurrentPlan(admin, roadmapShortcutUser.id);
    const added = after!.tasks.find((task) => !before!.tasks.some((existing) => existing.id === task.id));
    expect(added).toMatchObject({
      title: trackedRoadmapProblem.title,
      kind: "new_problem",
      status: "pending",
      assignment_source: "manual_today",
      user_problem_id: trackedRoadmapProblem.id,
    });
    const eventCountAfter = await admin.from("review_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", roadmapShortcutUser.id);
    expect(eventCountAfter.count).toBe(eventCountBefore.count);
    const row = taskCard(page, trackedRoadmapProblem.title);
    await expect(row).toBeVisible();
    await expect(row.getByText("New", { exact: true })).toBeVisible();

    await page.reload();
    await expect(taskCard(page, trackedRoadmapProblem.title)).toBeVisible();
  });

  test("adding a To-do problem appends one durable checklist task", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    const browserErrors = await prepareVisualScenario(page, "dark");
    await signIn(page, scheduledUser.email, scheduledUser.password);
    await waitForPlan(page, 1);
    const initial = await getCurrentPlan(admin, scheduledUser.id);
    expect(initial?.tasks).toHaveLength(1);

    await page.getByRole("button", { name: "Add Problem", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add a problem" });
    await expect(dialog).toBeVisible();
    const palette = page.locator("[data-add-problem-palette]");
    const idleBox = await palette.boundingBox();
    expect(idleBox).not.toBeNull();
    await captureVisualArtifact(page, testInfo, "add-problem-command-idle-1024-dark", false);
    await expect(dialog.getByRole("button", { name: /^Review another/ })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^Continue roadmap/ })).toBeVisible();
    await expect(dialog.getByRole("option")).toHaveCount(0);
    const problemSearch = dialog.getByLabel("LeetCode problem", { exact: true });
    await expect(problemSearch).toBeFocused();

    await page.setViewportSize({ width: 650, height: 480 });
    const edgeBox = await palette.boundingBox();
    expect(edgeBox).not.toBeNull();
    expect(edgeBox!.x).toBeGreaterThanOrEqual(15);
    expect(edgeBox!.y).toBeGreaterThanOrEqual(15);
    expect(edgeBox!.x + edgeBox!.width).toBeLessThanOrEqual(635);
    expect(edgeBox!.y + edgeBox!.height).toBeLessThanOrEqual(465);
    await expectNoPageOverflow(page);
    await page.setViewportSize({ width: 1024, height: 900 });

    await problemSearch.fill("two");
    const twoResults = dialog.getByRole("option");
    await expect(twoResults.first()).toContainText("1. Two Sum");
    expect(await twoResults.count()).toBeLessThanOrEqual(5);
    const searchBox = await palette.boundingBox();
    expect(searchBox).not.toBeNull();
    await captureVisualArtifact(page, testInfo, "add-problem-command-search-1024-dark", false);

    await problemSearch.fill("20");
    const numberResults = dialog.getByRole("option");
    await expect(numberResults.first()).toContainText("20. Valid Parentheses");
    expect(await numberResults.count()).toBeLessThanOrEqual(5);

    await problemSearch.fill("no-such-leetcode-problem-xyz");
    await expect(dialog.getByText("No matching problems", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("option")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Clear search" }).click();
    await expect(problemSearch).toHaveValue("");
    await expect(dialog.getByRole("button", { name: /^Review another/ })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^Continue roadmap/ })).toBeVisible();

    await problemSearch.fill("parentheses");
    await expect(dialog.getByRole("option", { name: /20\. Valid Parentheses/ })).toBeVisible();
    const firstActiveResult = await problemSearch.getAttribute("aria-activedescendant");
    await problemSearch.press("ArrowDown");
    expect(await problemSearch.getAttribute("aria-activedescendant")).not.toBe(firstActiveResult);
    await problemSearch.press("ArrowUp");
    expect(await problemSearch.getAttribute("aria-activedescendant")).toBe(firstActiveResult);
    await problemSearch.press("Enter");
    await expect(dialog.locator('input[name="today_status"][value="todo"]')).toBeChecked();
    await dialog.getByText("Done", { exact: true }).click();
    await expect(dialog.locator('input[name="today_status"][value="done"]')).toBeChecked();
    await expect(dialog.getByRole("button", { name: "Mark as Done", exact: true })).toBeVisible();
    await dialog.getByText("To-do", { exact: true }).click();
    await expect(dialog.locator('input[name="today_status"][value="todo"]')).toBeChecked();
    await expect(dialog.getByRole("button", { name: "Add to Today", exact: true })).toBeVisible();
    const selectedBox = await palette.boundingBox();
    expect(selectedBox).not.toBeNull();
    for (const box of [searchBox!, selectedBox!]) {
      expect(Math.abs(box.width - idleBox!.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(box.height - idleBox!.height)).toBeLessThanOrEqual(2);
    }
    await captureVisualArtifact(page, testInfo, "add-problem-command-selected-1024-dark", false);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(palette).toBeVisible();
    await expectNoPageOverflow(page);
    await captureVisualArtifact(page, testInfo, "add-problem-command-selected-390-dark", false);
    await dialog.getByRole("button", { name: "Back", exact: true }).click();
    await expect(problemSearch).toHaveValue("parentheses");
    await dialog.getByRole("option", { name: /20\. Valid Parentheses/ }).click();
    await dialog.getByRole("button", { name: "Add to Today", exact: true }).click();

    await expect(page.getByText("0/2 completed", { exact: false })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("All done for today!", { exact: true })).toHaveCount(0);
    const row = taskCard(page, "Valid Parentheses");
    await expect(row.getByText("New", { exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: /^Complete / })).toBeVisible();
    await captureVisualArtifact(page, testInfo, "study-plan-manual-reactivated-1024-light", false);

    await page.reload();
    await expect(page.getByText("0/2 completed", { exact: false })).toBeVisible();
    await rateTask(page, "Valid Parentheses", "OK");
    await expect(page.getByText("1/2 completed", { exact: false })).toBeVisible();

    const persisted = await getCurrentPlan(admin, scheduledUser.id);
    expect(persisted?.plan.planned_task_count).toBe(2);
    const appended = persisted?.tasks.find((task) => task.leetcode_frontend_id === "20");
    expect(appended).toMatchObject({
      assignment_source: "manual_today",
      kind: "new_problem",
      origin: "tracked",
      status: "completed",
    });
    assertNoBrowserErrors(browserErrors);
  });

  test("Skip today defers a task, creates no event, and persists after refresh", async ({ page }, testInfo) => {
    const seeded = await seedDueReviewedProblems(admin, skipUser.id, 1);
    await page.setViewportSize({ width: 390, height: 844 });
    const browserErrors = await prepareVisualScenario(page, "dark");
    await signIn(page, skipUser.email, skipUser.password);
    await waitForPlan(page, 2);
    const plan = await getCurrentPlan(admin, skipUser.id);
    const review = plan!.tasks.find((task) => task.kind === "review")!;
    const eventCountBefore = await admin.from("review_events").select("id", { count: "exact", head: true }).eq("user_problem_id", seeded[0].id);

    await taskCard(page, review.title).getByRole("button", { name: "Skip today" }).click();
    await expect(taskCard(page, review.title).getByText("Deferred", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expectNoPageOverflow(page);
    await captureVisualArtifact(page, testInfo, "study-plan-deferred-390-dark", false);
    const newTask = plan!.tasks.find((task) => task.kind === "new_problem")!;
    await rateTask(page, newTask.title, "Bad");
    await expect(page.getByText("You're done for today", { exact: true })).toBeVisible();
    await expect(page.getByText(/1\/2 completed.*1 deferred/)).toBeVisible();
    const eventCountAfter = await admin.from("review_events").select("id", { count: "exact", head: true }).eq("user_problem_id", seeded[0].id);
    expect(eventCountAfter.count).toBe(eventCountBefore.count);
    await captureVisualArtifact(page, testInfo, "study-plan-mixed-resolved-390-dark", false);

    await page.reload();
    await expect(page.getByText("You're done for today", { exact: true })).toBeVisible();
    const persisted = await getCurrentPlan(admin, skipUser.id);
    expect(persisted?.tasks.find((task) => task.id === review.id)?.status).toBe("deferred");
    assertNoBrowserErrors(browserErrors);
  });

  test("Analytics reflects real local review events and its controls work", async ({ page }) => {
    await signIn(page, workflowUser.email, workflowUser.password, "/analytics");
    await expect(page.getByRole("heading", { name: "Your progress" })).toBeVisible();
    await expect(page.locator('[data-chart-bar="easy"], [data-chart-bar="medium"], [data-chart-bar="hard"]')).not.toHaveCount(0);
    for (const label of ["Week", "Month", "Difficulty", "Activity type"]) {
      const control = page.getByRole("button", { name: label, exact: true });
      await control.click();
      await expect(control).toHaveAttribute("aria-pressed", "true");
    }
  });

  test("Recent Activity shows bounded genuine events and a compact empty state", async ({ browser }, testInfo) => {
    const populatedContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale: "en-US",
      timezoneId: "America/Denver",
    });
    const populatedPage = await populatedContext.newPage();
    const populatedErrors = await prepareVisualScenario(populatedPage, "dark");
    await signIn(populatedPage, recentActivityUser.email, recentActivityUser.password);
    const populatedCard = populatedPage.locator("[data-recent-activity]");
    const practiceTrend = populatedPage.locator("[data-practice-trend]");
    await expect(practiceTrend.getByRole("heading", { name: "Practice Trend" })).toBeVisible();
    await expect(practiceTrend.getByRole("button", { name: "Month", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(practiceTrend.locator('[data-practice-trend-point="true"]')).toHaveCount(12);
    await practiceTrend.getByRole("button", { name: "Week", exact: true }).click();
    await expect(practiceTrend.getByRole("button", { name: "Week", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(populatedCard.getByRole("heading", { name: "Recent Activity" })).toBeVisible();
    await expect(populatedCard.locator("li")).toHaveCount(3);
    await populatedCard.getByRole("button", { name: "Show more" }).click();
    await expect(populatedCard.locator("li")).toHaveCount(8);
    await expect(populatedCard.getByRole("button", { name: "Show fewer" })).toBeVisible();
    await expectNoPageOverflow(populatedPage);
    await captureVisualArtifact(populatedPage, testInfo, "recent-activity-populated-dark");
    await populatedPage.setViewportSize({ width: 390, height: 844 });
    await expectNoPageOverflow(populatedPage);
    await captureVisualArtifact(populatedPage, testInfo, "recent-activity-populated-mobile-dark");
    assertNoBrowserErrors(populatedErrors);
    await populatedContext.close();

    const emptyContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: "en-US",
      timezoneId: "America/Denver",
    });
    const emptyPage = await emptyContext.newPage();
    const emptyErrors = await prepareVisualScenario(emptyPage, "light");
    await signIn(emptyPage, emptyActivityUser.email, emptyActivityUser.password);
    const emptyCard = emptyPage.locator("[data-recent-activity]");
    await expect(emptyCard.getByText("No practice activity yet")).toBeVisible();
    await expect(emptyCard.locator("li")).toHaveCount(0);
    await expectNoPageOverflow(emptyPage);
    await captureVisualArtifact(emptyPage, testInfo, "recent-activity-empty-mobile-light");
    assertNoBrowserErrors(emptyErrors);
    await emptyContext.close();
  });

  test("major authenticated pages render in desktop/mobile light/dark", async ({ browser }, testInfo: TestInfo) => {
    const routes = [
      { slug: "dashboard", path: "/dashboard", heading: dashboardGreeting, navigation: "Dashboard" },
      { slug: "library", path: "/problems", heading: "Problem library", navigation: "Problems" },
      { slug: "import", path: "/problems/import", heading: "Preview LeetCode history", navigation: "Import" },
      { slug: "roadmaps", path: "/roadmaps", heading: "Choose your path", navigation: "Roadmaps" },
      { slug: "analytics", path: "/analytics", heading: "Your progress", navigation: null },
    ] as const;
    const viewports = [
      { name: "desktop", width: 1440, height: 1000 },
      { name: "mobile", width: 390, height: 844 },
    ] as const;

    for (const viewport of viewports) {
      for (const theme of ["light", "dark"] as VisualTheme[]) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          locale: "en-US",
          timezoneId: "America/Denver",
        });
        const page = await context.newPage();
        await signIn(page, workflowUser.email, workflowUser.password);
        for (const route of routes) {
          const browserErrors = await prepareVisualScenario(page, theme);
          await page.goto(route.path);
          await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
          await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
          await page.evaluate(() => document.fonts.ready);
          await waitForAppHydration(page);
          if (viewport.name === "desktop") {
            const navigation = page.getByRole("navigation", { name: "Main navigation" });
            await expect(navigation).toBeVisible();
            if (route.navigation) {
              await expect(
                navigation.getByRole("link", {
                  name: route.navigation,
                  exact: true,
                }),
              ).toHaveAttribute("aria-current", "page");
            } else {
              await expect(
                navigation.getByRole("link", { name: "Analytics", exact: true }),
              ).toHaveCount(0);
            }
            const sidebarPosition = await page
              .getByLabel("Application sidebar")
              .evaluate((element) => getComputedStyle(element).position);
            expect(sidebarPosition).toBe("sticky");
            if (route.slug === "dashboard" && theme === "light") {
              await page.getByRole("button", { name: "Collapse navigation" }).click();
              await expect
                .poll(async () =>
                  Math.round(
                    (await page.getByLabel("Application sidebar").boundingBox())
                      ?.width ?? 0,
                  ),
                )
                .toBe(64);
              await page.getByRole("button", { name: "Expand navigation" }).click();
              await expect
                .poll(async () =>
                  Math.round(
                    (await page.getByLabel("Application sidebar").boundingBox())
                      ?.width ?? 0,
                  ),
                )
                .toBe(240);
            }
          } else {
            await expect(page.getByRole("button", { name: "Expand navigation" })).toBeVisible();
            await expect
              .poll(async () =>
                Math.round(
                  (await page.getByLabel("Application sidebar").boundingBox())
                    ?.width ?? 0,
                ),
              )
              .toBe(64);
          }
          await expectNoPageOverflow(page);
          await captureVisualArtifact(page, testInfo, `v1-${route.slug}-${viewport.name}-${theme}`);
          if (viewport.name === "mobile" && route.slug === "dashboard") {
            await page.getByRole("button", { name: "Expand navigation" }).click();
            const sidebar = page.getByLabel("Application sidebar");
            await expect
              .poll(async () => Math.round((await sidebar.boundingBox())?.width ?? 0))
              .toBe(240);
            await expect(
              sidebar.getByRole("button", { name: "Toggle theme" }),
            ).toBeVisible();
            await expect(
              sidebar.getByRole("link", { name: "Dashboard", exact: true }),
            ).toHaveAttribute("aria-current", "page");
            await captureVisualArtifact(
              page,
              testInfo,
              `v1-dashboard-mobile-${theme}-navigation-open`,
              false,
            );
            await page.keyboard.press("Escape");
            await expect(page.getByRole("button", { name: "Expand navigation" })).toBeVisible();
            await expect
              .poll(async () => Math.round((await sidebar.boundingBox())?.width ?? 0))
              .toBe(64);
          }
          assertNoBrowserErrors(browserErrors);
        }
        await context.close();
      }
    }
  });

  test("authenticated dashboard shell never overlaps content at supported widths", async ({ browser }, testInfo: TestInfo) => {
    const viewports = [
      { width: 1440, height: 1000, desktop: true },
      { width: 1200, height: 900, desktop: true },
      { width: 1024, height: 900, desktop: true },
      { width: 768, height: 900, desktop: false },
      { width: 390, height: 844, desktop: false },
    ] as const;

    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        locale: "en-US",
        timezoneId: "America/Denver",
      });
      const page = await context.newPage();
      const theme = viewport.width === 1200 || viewport.width === 390 ? "dark" : "light";
      const browserErrors = await prepareVisualScenario(page, theme);

      await signIn(page, recentActivityUser.email, recentActivityUser.password);
      await expect(page.getByRole("heading", { name: dashboardGreeting })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Today's plan", exact: true }),
      ).toBeVisible();
      await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
      await waitForAppHydration(page);

      const defaultWidth = viewport.desktop ? 240 : 64;
      await expect
        .poll(async () => Math.round((await getAppShellGeometry(page)).sidebar.width))
        .toBe(defaultWidth);
      expectDefaultShellGeometry(await getAppShellGeometry(page), defaultWidth);
      await expectNoPageOverflow(page);

      const dashboardGeometry = await page.evaluate(() => {
        const calendar = document.querySelector<HTMLElement>("[data-consistency-calendar]");
        const layout = document.querySelector<HTMLElement>("[data-dashboard-layout]");
        const primary = document.querySelector<HTMLElement>("[data-dashboard-primary]");
        const rail = document.querySelector<HTMLElement>("[data-dashboard-rail]");
        const today = document.querySelector<HTMLElement>("[data-dashboard-today]");
        const trend = document.querySelector<HTMLElement>("[data-dashboard-trend]");
        const recent = document.querySelector<HTMLElement>("[data-dashboard-recent]");
        const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-dashboard-card]"));
        const ring = document.querySelector<HTMLElement>("[data-roadmap-ring]");
        const weekdayHeaders = calendar
          ? Array.from(calendar.querySelectorAll<HTMLElement>('[role="columnheader"]'))
          : [];
        const dayCells = calendar
          ? Array.from(calendar.querySelectorAll<HTMLElement>('[role="gridcell"]'))
          : [];
        const rect = (element: HTMLElement) => {
          const value = element.getBoundingClientRect();
          return {
            top: value.top,
            left: value.left,
            right: value.right,
            bottom: value.bottom,
            width: value.width,
            height: value.height,
          };
        };

        return {
          calendarDisplay: calendar ? getComputedStyle(calendar).display : null,
          calendarWidth: calendar ? rect(calendar).width : 0,
          calendarColumns: calendar
            ? getComputedStyle(calendar).gridTemplateColumns.split(/\s+/).filter(Boolean).length
            : 0,
          weekdayTops: weekdayHeaders.map((element) => rect(element).top),
          daySizes: dayCells.map((element) => {
            const bounds = rect(element);
            return { width: bounds.width, height: bounds.height };
          }),
          layout: layout ? rect(layout) : null,
          layoutColumns: layout
            ? getComputedStyle(layout).gridTemplateColumns.split(/\s+/).filter(Boolean).length
            : 0,
          primary: primary ? rect(primary) : null,
          rail: rail ? rect(rail) : null,
          today: today ? rect(today) : null,
          trend: trend ? rect(trend) : null,
          recent: recent ? rect(recent) : null,
          cards: cards.map((element) => ({
            name: element.dataset.dashboardCard,
            ...rect(element),
          })),
          ring: ring ? rect(ring) : null,
        };
      });

      expect(dashboardGeometry.calendarDisplay).toBe("grid");
      expect(dashboardGeometry.calendarColumns).toBe(7);
      expect(dashboardGeometry.calendarWidth).toBeLessThanOrEqual(280);
      expect(dashboardGeometry.weekdayTops).toHaveLength(7);
      expect(
        Math.max(...dashboardGeometry.weekdayTops) - Math.min(...dashboardGeometry.weekdayTops),
      ).toBeLessThanOrEqual(1);
      expect(dashboardGeometry.daySizes.length).toBeGreaterThan(28);
      expect(Math.max(...dashboardGeometry.daySizes.map((cell) => cell.width))).toBeLessThanOrEqual(29);
      expect(Math.max(...dashboardGeometry.daySizes.map((cell) => cell.height))).toBeLessThanOrEqual(29);

      const consistencyCard = dashboardGeometry.cards.find((card) => card.name === "consistency");
      const roadmapCard = dashboardGeometry.cards.find((card) => card.name === "roadmap");
      const studyPlanCard = dashboardGeometry.cards.find((card) => card.name === "study-plan");
      expect(consistencyCard).toBeTruthy();
      expect(roadmapCard).toBeTruthy();
      expect(studyPlanCard).toBeTruthy();
      expect(Math.max(...dashboardGeometry.cards.map((card) => card.height))).toBeLessThan(460);
      expect(dashboardGeometry.layout).toBeTruthy();
      expect(dashboardGeometry.today).toBeTruthy();
      expect(dashboardGeometry.trend).toBeTruthy();
      expect(dashboardGeometry.recent).toBeTruthy();

      if (dashboardGeometry.layout!.width >= 864) {
        expect(dashboardGeometry.layoutColumns).toBe(2);
        expect(dashboardGeometry.primary).toBeTruthy();
        expect(dashboardGeometry.rail).toBeTruthy();
        expect(dashboardGeometry.primary!.width).toBeGreaterThan(dashboardGeometry.rail!.width * 2.5);
        expect(dashboardGeometry.primary!.right).toBeLessThanOrEqual(dashboardGeometry.rail!.left);
        expect(dashboardGeometry.trend!.top).toBeGreaterThan(dashboardGeometry.today!.bottom);
        expect(dashboardGeometry.recent!.top).toBeGreaterThan(dashboardGeometry.trend!.bottom);
        expect(consistencyCard!.left).toBeCloseTo(roadmapCard!.left, 0);
        expect(roadmapCard!.left).toBeCloseTo(studyPlanCard!.left, 0);
        expect(roadmapCard!.top).toBeGreaterThan(consistencyCard!.bottom);
        expect(studyPlanCard!.top).toBeGreaterThan(roadmapCard!.bottom);
      } else {
        expect(dashboardGeometry.layoutColumns).toBe(1);
        expect(dashboardGeometry.trend!.top).toBeGreaterThan(dashboardGeometry.today!.bottom);
        expect(consistencyCard!.top).toBeGreaterThan(dashboardGeometry.trend!.bottom);
        expect(roadmapCard!.top).toBeGreaterThan(consistencyCard!.bottom);
        expect(studyPlanCard!.top).toBeGreaterThan(roadmapCard!.bottom);
        expect(dashboardGeometry.recent!.top).toBeGreaterThan(studyPlanCard!.bottom);
      }

      expect(dashboardGeometry.ring).toBeTruthy();
      expect(dashboardGeometry.ring!.width).toBeGreaterThanOrEqual(126);
      expect(dashboardGeometry.ring!.width).toBeLessThanOrEqual(130);
      expect(dashboardGeometry.ring!.top).toBeGreaterThan(roadmapCard!.top);
      expect(dashboardGeometry.ring!.bottom).toBeLessThan(roadmapCard!.bottom);
      await captureVisualArtifact(
        page,
        testInfo,
        `authenticated-dashboard-${viewport.width}-default`,
      );

      if (viewport.desktop) {
        await page.getByRole("button", { name: "Collapse navigation" }).click();
        await expect
          .poll(async () => {
            const geometry = await getAppShellGeometry(page);
            return {
              sidebarWidth: Math.round(geometry.sidebar.width),
              mainLeft: Math.round(geometry.main.left),
            };
          })
          .toEqual({ sidebarWidth: 64, mainLeft: 64 });
        expectDefaultShellGeometry(await getAppShellGeometry(page), 64);
        await captureVisualArtifact(
          page,
          testInfo,
          `authenticated-dashboard-${viewport.width}-collapsed`,
          false,
        );

        await page.getByRole("button", { name: "Expand navigation" }).click();
        await expect
          .poll(async () => {
            const geometry = await getAppShellGeometry(page);
            return {
              sidebarWidth: Math.round(geometry.sidebar.width),
              mainLeft: Math.round(geometry.main.left),
            };
          })
          .toEqual({ sidebarWidth: 240, mainLeft: 240 });
        expectDefaultShellGeometry(await getAppShellGeometry(page), 240);
      } else {
        await page.getByRole("button", { name: "Expand navigation" }).click();
        await expect
          .poll(async () => {
            const geometry = await getAppShellGeometry(page);
            return {
              sidebarWidth: Math.round(geometry.sidebar.width),
              mainLeft: Math.round(geometry.main.left),
            };
          })
          .toEqual({ sidebarWidth: 240, mainLeft: 64 });
        const expandedGeometry = await getAppShellGeometry(page);
        expect(expandedGeometry.sidebar.width).toBeLessThan(
          expandedGeometry.viewport.width,
        );
        expect(expandedGeometry.sidebar.height).toBeCloseTo(
          expandedGeometry.viewport.height,
          0,
        );
        expect(
          expandedGeometry.sidebar.bottom - expandedGeometry.account.bottom,
        ).toBeLessThanOrEqual(32);
        await captureVisualArtifact(
          page,
          testInfo,
          `authenticated-dashboard-${viewport.width}-expanded`,
          false,
        );

        await page.keyboard.press("Escape");
        await expect(page.getByRole("button", { name: "Expand navigation" })).toBeFocused();
        await expect
          .poll(async () => {
            const geometry = await getAppShellGeometry(page);
            return {
              sidebarWidth: Math.round(geometry.sidebar.width),
              mainLeft: Math.round(geometry.main.left),
            };
          })
          .toEqual({ sidebarWidth: 64, mainLeft: 64 });
        expectDefaultShellGeometry(await getAppShellGeometry(page), 64);
      }

      assertNoBrowserErrors(browserErrors);
      await context.close();
    }
  });
});
