import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
const cache = new Map();
function load(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const compiled = ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const compiledModule = { exports: {} };
  const require = (name) => {
    if (name === "next/navigation") return { useRouter: () => ({ refresh() {} }) };
    if (name === "next/link") return function MockLink({ children, ...props }) {
      return React.createElement("a", props, children);
    };
    if (name.startsWith("@/app/") && name.endsWith("/actions")) return {
      ensureTodayStudyPlanAction: async () => { throw new Error("SSR must not initialize or mutate plans"); },
      addRecommendedProblemToTodayAction: async () => { throw new Error("SSR must not add recommendations"); },
      addProblemToTodayAction: async () => { throw new Error("SSR must not add problems"); },
      completeStudyTaskAction: async () => { throw new Error("SSR must not complete tasks"); },
      correctStudyAttemptAction: async () => { throw new Error("SSR must not correct ratings"); },
      deferStudyTaskAction: async () => { throw new Error("SSR must not defer tasks"); },
      rateNewStudyTaskAction: async () => { throw new Error("SSR must not practice tasks"); },
      submitReviewAction: async () => {}, snoozeReviewAction: async () => {}, addProblemAction: async () => {},
    };
    if (name.startsWith("@/")) {
      for (const extension of [".ts", ".tsx"]) {
        const path = new URL(`../${name.slice(2)}${extension}`, import.meta.url);
        if (existsSync(path)) return load(path);
      }
      throw new Error(`Unknown application import ${name}`);
    }
    return nodeRequire(name);
  };
  runInThisContext(`(function(module,exports,require){\n${compiled}\n})`, { filename: fileURLToPath(url) })(compiledModule, compiledModule.exports, require);
  cache.set(url.href, compiledModule.exports);
  return compiledModule.exports;
}
const { TodaysStudyPlan } = load(new URL("../components/todays-study-plan.tsx", import.meta.url));
const { ReviewTaskActions } = load(new URL("../components/review-task-actions.tsx", import.meta.url));
const { LeetCodeHistoryImportPreview } = load(new URL("../components/leetcode-history-import-preview.tsx", import.meta.url));

function fixture(statuses) {
  return {
    plan: { id: "plan", planned_task_count: statuses.length, study_date: "2026-11-02", time_zone: "America/Denver", day_ends_at: "2026-11-03T07:00:00Z" },
    tasks: statuses.map((status, index) => ({
      id: `task-${index}`, kind: index === 3 ? "new_problem" : "review", origin: index === 3 ? "roadmap" : "tracked",
      user_problem_id: index === 3 ? null : `problem-${index}`, leetcode_frontend_id: String([20, 146, 3, 217][index]),
      title: ["Valid Parentheses", "LRU Cache", "Longest Substring Without Repeating Characters", "Contains Duplicate"][index],
      difficulty: index === 0 || index === 3 ? "easy" : "medium", status,
      leetcode_url: `https://leetcode.com/problems/${["valid-parentheses", "lru-cache", "longest-substring-without-repeating-characters", "contains-duplicate"][index]}/`,
      assignment_source: "generated", position: index,
      created_at: `2026-11-02T12:0${index}:00Z`,
      completed_at: status === "completed" ? `2026-11-02T13:0${index}:00Z` : null,
      deferred_at: status === "deferred" ? `2026-11-02T13:0${index}:00Z` : null,
    })),
    liveProblems: statuses.flatMap((_, index) => index === 3 ? [] : [{
      id: `problem-${index}`, lifecycle_state: "active", next_review_at: "2026-11-01T00:00:00Z", schedule_version: 2,
    }]),
    asOf: "2026-11-02T12:00:00Z",
  };
}

function render(name, data, Component = TodaysStudyPlan) {
  const html = renderToStaticMarkup(React.createElement(Component, Component === TodaysStudyPlan ? { initialWorkspace: data } : data));
  const output = process.env.STUDY_PLAN_UI_OUTPUT_DIR;
  if (output) {
    mkdirSync(output, { recursive: true });
    const chunks = new URL("../.next/static/chunks/", import.meta.url);
    const css = existsSync(chunks) ? readdirSync(chunks).filter((file) => file.endsWith(".css")).map((file) => readFileSync(new URL(file, chunks), "utf8")).join("\n") : "";
    for (const theme of ["light", "dark"]) {
      writeFileSync(join(output, `${name}-${theme}.html`), `<!doctype html><html lang="en" class="${theme}"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body class="bg-zinc-50 dark:bg-zinc-950"><main class="mx-auto max-w-6xl px-5 py-10">${html}</main></body></html>`);
    }
  }
  return html;
}

test("render: initial state labels the study plan without inventing a denominator", () => {
  const html = render("loading", null);
  assert.match(html, /Today&#x27;s study plan/);
  assert.doesNotMatch(html, /Welcome back|Small steps/);
  assert.match(html, /Preparing today/);
  assert.doesNotMatch(html, /0 \/ 4/);
});

test("render: import starts as an accessible responsive preview with no implicit write", () => {
  const html = renderToStaticMarkup(React.createElement(LeetCodeHistoryImportPreview, {
    catalogProblems: [],
    existingProblems: [],
  }));
  assert.match(html, /LeetCode Practice History/);
  assert.match(html, /Nothing is saved during preview/);
  assert.match(html, /Preview import/);
  assert.match(html, /Import problems/);
  assert.match(html, /disabled=""/);
  assert.match(html, /lg:grid-cols-\[minmax\(0,440px\)_1fr\]/);
  assert.match(html, /dark:bg-zinc-900/);
  assert.match(html, /dark:text-zinc-100/);
  assert.doesNotMatch(html, /Import complete|Importing problems/);
});

test("render: assigned checklist rows hide ratings until their action circle is opened", () => {
  const html = render("active", fixture(["pending", "pending", "pending", "pending"]));
  assert.match(html, />0\/4 completed/);
  const ratingButtons = (html.match(/<button\b[^>]*>/g) ?? []).filter((button) => button.includes('name="rating"'));
  assert.equal(ratingButtons.length, 0);
  assert.equal((html.match(/aria-label="Complete /g) ?? []).length, 4);
  assert.equal((html.match(/aria-expanded="false"/g) ?? []).length, 4);
  assert.equal((html.match(/name="expected_schedule_version" value="2"/g) ?? []).length, 3);
  assert.match(html, /name="time_zone" value="America\/Denver"/);
  assert.doesNotMatch(html, /Track Problem|grid-cols-1 gap-3 md:grid-cols-2/);
  assert.match(html, /divide-y divide-zinc-200/);
  assert.equal((html.match(/name="task_id" value="task-3"/g) ?? []).length, 1);
  assert.match(html, /target="_blank" rel="noreferrer"/);
  assert.equal((html.match(/aria-label="Skip today"/g) ?? []).length, 4);
  assert.match(html, />Add Problem<\/button>/);
});

test("render: shared rating forms expose only canonical Bad, OK, and Good values", () => {
  const html = renderToStaticMarkup(React.createElement(ReviewTaskActions, {
    problem: { id: "problem-0", schedule_version: 2 },
    returnTo: "/dashboard",
    timeZone: "America/Denver",
    display: "ratings",
  }));
  assert.equal((html.match(/name="rating"/g) ?? []).length, 3);
  for (const label of ["Bad", "OK", "Good"]) {
    assert.match(html, new RegExp(`>${label}<\\/button>`));
  }
  for (const value of ["bad", "ok", "good"]) {
    assert.match(html, new RegExp(`value="${value}"`));
  }
  assert.doesNotMatch(html, /again|easy|Redo|Great/);
});

test("render: Review, New, and internal calibration rows retain protected actions with two user-facing labels", () => {
  const tracked = renderToStaticMarkup(React.createElement(ReviewTaskActions, {
    problem: { id: "tracked-problem", schedule_version: 7 },
    returnTo: "/dashboard",
    timeZone: "America/Denver",
    display: "ratings",
  }));
  assert.equal((tracked.match(/name="user_problem_id" value="tracked-problem"/g) ?? []).length, 3);
  assert.equal((tracked.match(/name="expected_schedule_version" value="7"/g) ?? []).length, 3);

  const roadmap = renderToStaticMarkup(React.createElement(ReviewTaskActions, {
    newTask: { id: "new-task", rate: async () => {}, skip: async () => {} },
    display: "ratings",
  }));
  assert.equal((roadmap.match(/name="task_id" value="new-task"/g) ?? []).length, 3);
  assert.doesNotMatch(roadmap, /user_problem_id|expected_schedule_version/);

  const calibration = fixture(["pending"]);
  calibration.tasks[0].kind = "calibration";
  const calibrationHtml = render("calibration", calibration);
  assert.match(calibrationHtml, />Review</);
  assert.match(calibrationHtml, />1 review</);
  assert.doesNotMatch(calibrationHtml, /calibration/i);
  assert.match(calibrationHtml, /Complete 20\. Valid Parentheses/);
});

test("render: completion celebration requires every persisted task to be completed", () => {
  const html = render("complete", fixture(["completed", "completed", "completed", "completed"]));
  assert.match(html, /All done for today!/);
  assert.match(html, /Mon, Nov 2/);
  assert.match(html, />4\/4 completed</);
  assert.match(html, /Great work showing up\./);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-valuenow="4"/);
  assert.match(html, /width:100%/);
  assert.doesNotMatch(html, /0 remaining|All set for today/);
  assert.doesNotMatch(html, /<form/);
  assert.doesNotMatch(html, /View today&#x27;s problems|<details/);
  assert.equal((html.match(/data-study-task-row=/g) ?? []).length, 4);
  assert.equal((html.match(/class="sr-only">Completed<\/span>/g) ?? []).length, 4);
  assert.equal((html.match(/\[&amp;_a\]:line-through/g) ?? []).length, 4);
  assert.doesNotMatch(html, /text-emerald-700[^>]*>Completed<\/span>/);
  assert.match(html, />Add Problem</);
  assert.doesNotMatch(html, /Review another|Continue roadmap/);
  assert.doesNotMatch(html, /aria-haspopup="menu"|role="menu"/);
  assert.ok(html.indexOf('role="progressbar"') < html.indexOf("data-study-task-row"));
});

test("render: mixed completion and deferral remains accurate", () => {
  const html = render("deferred", fixture(["completed", "completed", "completed", "deferred"]));
  assert.match(html, />3\/4 completed \u00b7 1 deferred</);
  assert.match(html, /You&#x27;re done for today/);
  assert.match(html, /Your progress is saved\. You can pick up tomorrow\./);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-valuenow="3"/);
  assert.match(html, /width:75%/);
  assert.doesNotMatch(html, /Today&#x27;s plan completed|0 remaining/);
  assert.equal((html.match(/data-study-task-row=/g) ?? []).length, 4);
  assert.equal((html.match(/class="sr-only">Completed<\/span>/g) ?? []).length, 3);
  assert.equal((html.match(/Deferred<\/span>/g) ?? []).length, 1);
  assert.equal((html.match(/\[&amp;_a\]:line-through/g) ?? []).length, 3);
  assert.doesNotMatch(html, /View today&#x27;s problems|<details/);
  assert.match(html, />Add Problem</);
  assert.doesNotMatch(html, /Review another|Continue roadmap/);
});

test("render: empty plan has helpful Library navigation and no celebration or full bar", () => {
  const html = render("empty", fixture([]));
  assert.match(html, /No tasks assigned today/);
  assert.match(html, /href="\/problems"/);
  assert.doesNotMatch(html, /role="progressbar"|You completed today|0 \/ 0/);
  assert.doesNotMatch(html, /Keep studying/);
});

test("render: a future-scheduled bound task stays pending without duplicate tracking controls", () => {
  const data = fixture(["pending"]);
  data.tasks[0].kind = "new_problem";
  data.tasks[0].origin = "roadmap";
  data.liveProblems[0].next_review_at = "2026-11-04T07:00:00Z";
  const html = render("scheduled", data);
  assert.match(html, /Scheduled for Nov 4/);
  assert.doesNotMatch(html, /Track Problem|<form/);
});

test("render: in-progress layout counts only persisted completion and retains remaining controls", () => {
  const html = render("in-progress", fixture(["completed", "completed", "pending", "pending"]));
  assert.match(html, />2\/4 completed</);
  assert.doesNotMatch(html, /2 remaining/);
  assert.match(html, /aria-valuenow="2"/);
  assert.match(html, /width:50%/);
  assert.match(html, /bg-violet-600/);
  assert.doesNotMatch(html, /Welcome back|Small steps/);
  assert.doesNotMatch(html, /<details|You completed today/);
  assert.doesNotMatch(html, /Keep studying/);
  const buttons = (html.match(/aria-label="Complete /g) ?? []);
  assert.equal(buttons.length, 2);
  assert.doesNotMatch(html, /name="rating"/);
  const cardTags = html.match(/<li\b[^>]*>/g) ?? [];
  assert.equal(cardTags.length, 4);
  assert.ok(cardTags.every((tag) => !tag.includes("border-emerald")));
});

test("render: deferred tasks do not inflate completion or remaining work", () => {
  const html = render("all-deferred", fixture(["deferred", "deferred", "deferred", "deferred"]));
  assert.match(html, />0\/4 completed \u00b7 4 deferred</);
  assert.match(html, /4 deferred/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-valuenow="0"/);
  assert.match(html, /width:0%/);
  assert.doesNotMatch(html, /Today&#x27;s plan completed|0 remaining|<form/);
});

test("render: an unavailable task has no rating or deferral controls", () => {
  const data = fixture(["pending"]);
  data.liveProblems[0].lifecycle_state = "paused";
  const html = render("unavailable", data);
  assert.match(html, />Unavailable</);
  assert.doesNotMatch(html, /<form|You completed today/);
});

test("render: shared controls disable every rating and Skip today while the workspace is busy", () => {
  const html = renderToStaticMarkup(React.createElement(ReviewTaskActions, {
    problem: { id: "problem", schedule_version: 5 }, returnTo: "/dashboard", timeZone: "America/Denver", disabled: true,
  }));
  const buttons = html.match(/<button\b[^>]*>/g) ?? [];
  assert.equal(buttons.length, 4);
  assert.ok(buttons.every((button) => button.includes('disabled=""')));
  assert.equal((html.match(/name="expected_schedule_version" value="5"/g) ?? []).length, 4);
  assert.match(html, /name="return_to" value="\/dashboard"/);
});

