import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
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

const { RecentActivityCard } = load(new URL("../components/recent-activity-card.tsx", import.meta.url));

function item(index) {
  return {
    id: `event-${index}`,
    userProblemId: `problem-${index}`,
    frontendId: String(200 + index),
    title: `Problem ${index}`,
    difficulty: "medium",
    leetcodeUrl: `https://leetcode.com/problems/problem-${index}/`,
    rating: ["bad", "ok", "good"][index % 3],
    kind: index === 0 ? "new" : "review",
    reviewedAt: "2026-11-07T17:00:00.000Z",
    reviewedAtLabel: "Today, 10:00 AM",
  };
}

test("empty recent activity renders the compact truthful empty state", () => {
  const html = renderToStaticMarkup(React.createElement(RecentActivityCard, {
    snapshot: { timeZone: "America/Denver", items: [] },
  }));
  assert.match(html, /No practice activity yet/);
  assert.match(html, /Complete your first problem/);
  assert.doesNotMatch(html, /Show more/);
});

test("three events render three linked rows without a disclosure control", () => {
  const html = renderToStaticMarkup(React.createElement(RecentActivityCard, {
    snapshot: { timeZone: "America/Denver", items: [item(0), item(1), item(2)] },
  }));
  assert.equal((html.match(/leetcode\.com\/problems/g) ?? []).length, 3);
  assert.match(html, />New</);
  assert.match(html, />Review</);
  assert.match(html, />medium</);
  assert.doesNotMatch(html, />Bad<|>OK<|>Good<|Practiced/);
  assert.doesNotMatch(html, /Show more/);
});

test("eight events initially render three rows and Show more", () => {
  const html = renderToStaticMarkup(React.createElement(RecentActivityCard, {
    snapshot: { timeZone: "America/Denver", items: Array.from({ length: 8 }, (_, index) => item(index)) },
  }));
  assert.equal((html.match(/leetcode\.com\/problems/g) ?? []).length, 3);
  assert.match(html, /Show more/);
  assert.match(html, /aria-expanded="false"/);
});
