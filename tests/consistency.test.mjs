import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

const { buildConsistencySnapshot } = loadTypeScriptModule(
  new URL("../lib/consistency.ts", import.meta.url),
);
const { getConsistencySnapshot } = loadTypeScriptModule(
  new URL("../data/consistency.ts", import.meta.url),
);

const referenceTime = new Date("2026-11-05T18:00:00.000Z");
const timeZone = "America/Denver";

function event(id, reviewedAt) {
  return { id, reviewedAt };
}

test("daily streak keeps yesterday active until the current local day ends", () => {
  const snapshot = buildConsistencySnapshot({
    events: [
      event("one", "2026-11-03T18:00:00.000Z"),
      event("two", "2026-11-04T18:00:00.000Z"),
    ],
    timeZone,
    referenceTime,
  });

  assert.equal(snapshot.today, "2026-11-05");
  assert.equal(snapshot.currentDailyStreak, 2);
});

test("daily streak resets after both today and yesterday are inactive", () => {
  const snapshot = buildConsistencySnapshot({
    events: [event("old", "2026-11-03T18:00:00.000Z")],
    timeZone,
    referenceTime,
  });
  assert.equal(snapshot.currentDailyStreak, 0);
});

test("weekly streak uses Monday weeks and gives the current empty week grace", () => {
  const snapshot = buildConsistencySnapshot({
    events: [
      event("week-one", "2026-10-21T18:00:00.000Z"),
      event("week-two", "2026-10-28T18:00:00.000Z"),
    ],
    timeZone,
    referenceTime,
  });
  assert.equal(snapshot.currentDailyStreak, 0);
  assert.equal(snapshot.currentWeeklyStreak, 2);
});

test("current-month calendar uses complete Monday-Sunday rows", () => {
  const snapshot = buildConsistencySnapshot({
    events: [event("active", "2026-11-05T18:00:00.000Z")],
    timeZone,
    referenceTime,
  });

  assert.equal(snapshot.monthLabel, "November 2026");
  assert.equal(snapshot.calendarDays.length % 7, 0);
  assert.equal(snapshot.calendarDays[0].date, "2026-10-26");
  assert.equal(snapshot.calendarDays.at(-1).date, "2026-12-06");
  assert.equal(snapshot.activeDaysThisMonth, 1);
  assert.equal(snapshot.calendarDays.find((day) => day.date === "2026-11-05")?.count, 1);
});

test("duplicate, invalid, and future events do not inflate consistency", () => {
  const duplicate = event("same", "2026-11-05T17:00:00.000Z");
  const snapshot = buildConsistencySnapshot({
    events: [duplicate, duplicate, event("invalid", "not-a-date"), event("future", "2026-11-06T18:00:00.000Z")],
    timeZone,
    referenceTime,
  });
  assert.equal(snapshot.currentDailyStreak, 1);
  assert.equal(snapshot.activeDaysThisMonth, 1);
  assert.equal(snapshot.calendarDays.find((day) => day.date === "2026-11-05")?.count, 1);
});

function consistencyClientStub() {
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
          order(field, options) { query.orders.push([field, options]); return builder; },
          limit(value) { query.limit = value; return builder; },
          or(value) { query.cursor = value; return builder; },
          maybeSingle() { return Promise.resolve({ data: { time_zone: timeZone }, error: null }); },
          then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); },
        };
        return builder;
      },
    },
  };
}

test("consistency reads are owner-scoped and use the persisted timezone", async () => {
  const { client, queries } = consistencyClientStub();
  const result = await getConsistencySnapshot(client, "current-user", referenceTime);
  assert.equal(result.error, null);
  assert.equal(result.data.timeZone, timeZone);
  assert.deepEqual(queries.map((query) => query.table).sort(), ["review_events", "user_study_preferences"]);
  for (const query of queries) assert.deepEqual(query.filters, [["user_id", "current-user"]]);
});
