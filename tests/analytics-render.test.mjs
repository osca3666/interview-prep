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
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  } }).outputText;
  const compiledModule = { exports: {} };
  const require = (name) => {
    if (name === "next/link") return function MockLink({ children, ...props }) {
      return React.createElement("a", props, children);
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

const { AnalyticsDashboard } = load(new URL("../components/analytics/analytics-dashboard.tsx", import.meta.url));
const { PracticeTrendCard } = load(new URL("../components/analytics/practice-trend-card.tsx", import.meta.url));
const { buildAnalyticsSnapshot } = load(new URL("../lib/analytics.ts", import.meta.url));

const referenceTime = new Date("2026-11-03T18:00:00.000Z");
const events = Array.from({ length: 24 }, (_, index) => ({
  id: `event-${index}`,
  userProblemId: `problem-${index % 7}`,
  rating: ["bad", "ok", "good"][index % 3],
  reviewedAt: new Date(referenceTime.getTime() - (index % 18) * 86_400_000).toISOString(),
  practiceLocalDate: new Date(referenceTime.getTime() - (index % 18) * 86_400_000)
    .toISOString()
    .slice(0, 10),
  prePracticeProblemType: index < 7 ? "new" : "review",
}));
const problems = Array.from({ length: 7 }, (_, index) => ({
  id: `problem-${index}`,
  topics: index % 2 === 0 ? ["Array", "Hash Table"] : ["Tree", "Depth-First Search"],
  masteryScore: index + 2,
  difficulty: ["easy", "medium", "hard"][index % 3],
  source: index < 2 ? "leetcode_import" : "manual",
  externalPracticeStatus: index < 2 ? "accepted" : null,
  externalActivityDate:
    index < 2 ? `2026-${String(index + 9).padStart(2, "0")}-15` : null,
}));

function render(snapshot, name) {
  const html = renderToStaticMarkup(React.createElement(AnalyticsDashboard, { snapshot }));
  const output = process.env.ANALYTICS_UI_OUTPUT_DIR;
  if (output) {
    mkdirSync(output, { recursive: true });
    const chunks = new URL("../.next/static/chunks/", import.meta.url);
    const css = existsSync(chunks)
      ? readdirSync(chunks).filter((file) => file.endsWith(".css")).map((file) => readFileSync(new URL(file, chunks), "utf8")).join("\n")
      : "";
    for (const theme of ["light", "dark"]) {
      writeFileSync(join(output, `${name}-${theme}.html`), `<!doctype html><html lang="en" class="${theme}"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body class="bg-zinc-50 dark:bg-zinc-950"><main class="mx-auto max-w-6xl px-5 py-10">${html}</main></body></html>`);
    }
  }
  return html;
}

test("render: populated analytics includes the combined Practice Over Time chart", () => {
  const snapshot = buildAnalyticsSnapshot({ events, problems, timeZone: "America/Denver", referenceTime });
  const html = render(snapshot, "populated");
  assert.match(html, /Practice Over Time/);
  assert.doesNotMatch(html, /More insights|This week|This month|Mastery/);
  assert.doesNotMatch(html, /Consistency|Active Days|Current Streak|Longest Streak/);
  assert.doesNotMatch(html, /Reviews completed/);
  assert.doesNotMatch(html, /Your ratings|Top topics/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /dark:bg-zinc-900/);
  assert.match(html, /Group by/);
  assert.match(html, /Breakdown/);
  assert.match(html, /Difficulty/);
  assert.match(html, /Activity type/);
  assert.match(html, /data-chart-bar="(?:easy|medium|hard)"/);
  assert.match(html, /data-chart-total-label="true"/);
  assert.match(html, /h-2\.5 w-2\.5/);
});

test("render: empty analytics uses a truthful call to action and no fake chart data", () => {
  const snapshot = buildAnalyticsSnapshot({ events: [], problems: [], timeZone: "UTC", referenceTime });
  const html = render(snapshot, "empty");
  assert.match(html, /Your practice story starts here/);
  assert.match(html, /Go to today/);
  assert.doesNotMatch(html, /Your ratings/);
});

test("render: sparse real activity still produces a visible chart mark", () => {
  const snapshot = buildAnalyticsSnapshot({
    events: [events[0]],
    problems: [problems[0]],
    timeZone: "America/Denver",
    referenceTime,
  });
  const html = render(snapshot, "sparse");
  assert.match(html, /data-chart-bar="easy"/);
  assert.match(html, /data-chart-total-label="true"/);
});

test("render: Practice Over Time defaults to Month and Difficulty", () => {
  const snapshot = buildAnalyticsSnapshot({
    events,
    problems,
    timeZone: "America/Denver",
    referenceTime,
  });
  const html = render(snapshot, "activity-modes");
  const source = readFileSync(
    new URL("../components/analytics/analytics-dashboard.tsx", import.meta.url),
    "utf8",
  );

  for (const mode of ["Week", "Month", "Difficulty", "Activity type"]) {
    assert.match(html, new RegExp(`>${mode}</button>`));
  }
  assert.match(source, /useState<PracticeOverTimeGroup>\("month"\)/);
  assert.match(source, /useState<PracticeOverTimeBreakdown>\("difficulty"\)/);
  assert.match(source, /snapshot\.practiceOverTime\.monthly/);
});

test("render: dashboard Practice Trend reuses monthly and weekly analytics buckets", () => {
  const snapshot = buildAnalyticsSnapshot({
    events,
    problems,
    timeZone: "America/Denver",
    referenceTime,
  });
  const html = renderToStaticMarkup(
    React.createElement(PracticeTrendCard, { snapshot }),
  );
  const source = readFileSync(
    new URL("../components/analytics/practice-trend-card.tsx", import.meta.url),
    "utf8",
  );

  assert.match(html, /Practice Trend/);
  assert.match(html, /Recorded activity over time/);
  assert.match(html, /View analytics/);
  assert.match(html, /aria-label="Recorded activity trend"/);
  assert.equal((html.match(/data-practice-trend-point="true"/g) ?? []).length, 12);
  assert.match(html, /data-practice-trend-line="true"/);
  assert.match(source, /useState<PracticeOverTimeGroup>\("month"\)/);
  assert.match(source, /snapshot\.practiceOverTime\.weekly/);
  assert.match(source, /snapshot\.practiceOverTime\.monthly/);
});
