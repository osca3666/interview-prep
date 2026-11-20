import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

const {
  buildRecentActivitySnapshot,
  formatRecentActivityTime,
} = loadTypeScriptModule(new URL("../lib/recent-activity.ts", import.meta.url));
const { getRecentActivity } = loadTypeScriptModule(
  new URL("../data/recent-activity.ts", import.meta.url),
);

const referenceTime = new Date("2026-11-07T18:00:00.000Z");
const timeZone = "America/Denver";

function problem(id = "problem-1") {
  return {
    id,
    frontendId: "200",
    title: "Number of Islands",
    difficulty: "medium",
    leetcodeUrl: "https://leetcode.com/problems/number-of-islands/",
  };
}

function event(id, reviewedAt, rating = "ok", transitionKind = "review") {
  return {
    id,
    userProblemId: "problem-1",
    rating,
    reviewedAt,
    transitionKind,
  };
}

test("formats Today, Yesterday, and older dates in the saved timezone", () => {
  assert.equal(
    formatRecentActivityTime("2026-11-07T22:42:00.000Z", timeZone, referenceTime),
    "Today, 3:42 PM",
  );
  assert.equal(
    formatRecentActivityTime("2026-11-07T03:30:00.000Z", timeZone, referenceTime),
    "Yesterday, 8:30 PM",
  );
  assert.equal(
    formatRecentActivityTime("2026-11-03T14:15:00.000Z", timeZone, referenceTime),
    "Nov 3, 2026 · 7:15 AM",
  );
});

test("keeps repeated genuine attempts and uses each event's current rating", () => {
  const snapshot = buildRecentActivitySnapshot({
    events: [
      event("older", "2026-11-07T16:00:00.000Z", "bad", "initial_practice"),
      event("newer", "2026-11-07T17:00:00.000Z", "good", "review"),
    ],
    problems: [problem()],
    timeZone,
    referenceTime,
  });

  assert.equal(snapshot.items.length, 2);
  assert.deepEqual(snapshot.items.map((item) => item.id), ["newer", "older"]);
  assert.deepEqual(snapshot.items.map((item) => item.rating), ["good", "bad"]);
  assert.deepEqual(snapshot.items.map((item) => item.kind), ["review", "new"]);
});

test("sorts deterministically, limits to ten, and handles missing problem metadata", () => {
  const events = Array.from({ length: 12 }, (_, index) =>
    event(`event-${String(index).padStart(2, "0")}`, "2026-11-07T17:00:00.000Z"),
  );
  events[0] = { ...events[0], userProblemId: "deleted-problem" };
  const snapshot = buildRecentActivitySnapshot({ events, problems: [problem()], timeZone, referenceTime });

  assert.equal(snapshot.items.length, 10);
  assert.equal(snapshot.items[0].id, "event-11");
  assert.equal(snapshot.items.at(-1).id, "event-02");
});

function recentActivityClientStub(events, problems) {
  const queries = [];
  return {
    queries,
    client: {
      from(table) {
        const query = { table, filters: [], orders: [] };
        queries.push(query);
        const builder = {
          select(fields) { query.fields = fields; return builder; },
          eq(field, value) { query.filters.push([field, value]); return builder; },
          in(field, value) { query.in = [field, value]; return builder; },
          order(field, options) { query.orders.push([field, options]); return builder; },
          limit(value) { query.limit = value; return builder; },
          then(resolve, reject) {
            const data = table === "review_events" ? events : problems;
            return Promise.resolve({ data, error: null }).then(resolve, reject);
          },
        };
        return builder;
      },
    },
  };
}

test("data helper performs bounded owner-scoped event and problem reads", async () => {
  const rawEvents = [{
    id: "event-1",
    user_problem_id: "problem-1",
    rating: "ok",
    reviewed_at: "2026-11-07T17:00:00.000Z",
    transition_kind: "review",
  }];
  const rawProblems = [{
    id: "problem-1",
    leetcode_frontend_id: "200",
    title: "Number of Islands",
    difficulty: "medium",
    leetcode_url: "https://leetcode.com/problems/number-of-islands/",
  }];
  const { client, queries } = recentActivityClientStub(rawEvents, rawProblems);
  const result = await getRecentActivity(client, "current-user", timeZone, referenceTime);

  assert.equal(result.error, null);
  assert.equal(result.data.items.length, 1);
  assert.deepEqual(queries.map((query) => query.table), ["review_events", "user_problems"]);
  assert.deepEqual(queries[0].filters, [["user_id", "current-user"]]);
  assert.deepEqual(queries[1].filters, [["user_id", "current-user"]]);
  assert.equal(queries[0].limit, 10);
  assert.deepEqual(queries[0].orders, [
    ["reviewed_at", { ascending: false }],
    ["id", { ascending: false }],
  ]);
});

test("empty activity avoids the problem metadata query", async () => {
  const { client, queries } = recentActivityClientStub([], []);
  const result = await getRecentActivity(client, "current-user", timeZone, referenceTime);
  assert.equal(result.data.items.length, 0);
  assert.deepEqual(queries.map((query) => query.table), ["review_events"]);
});
