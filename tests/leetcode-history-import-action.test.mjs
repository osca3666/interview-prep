import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

function harness({ authenticated = true, rpcError = null, result = null } = {}) {
  const paths = [];
  const calls = [];
  const client = { auth: { getClaims: async () => ({ data: { claims: authenticated ? { sub: "owner" } : {} }, error: null }) } };
  const { importLeetCodeHistoryAction } = loadTypeScriptModule(
    new URL("../app/problems/import/actions.ts", import.meta.url),
    {
      "next/cache": { revalidatePath: (path) => paths.push(path) },
      "@/lib/supabase/server": { createClient: async () => client },
      "@/data/leetcode-history-import": { importLeetCodeHistory: async (db, problems) => {
        assert.equal(db, client);
        calls.push(problems);
        return { data: rpcError ? null : [result ?? { imported_count: 1, already_tracked_count: 0, skipped_count: 0, failed_count: 0 }], error: rpcError };
      } },
    },
  );
  return { action: importLeetCodeHistoryAction, calls, paths };
}

test("import action resolves canonical metadata and maps historical semantics", async () => {
  const h = harness({ result: { imported_count: 1, already_tracked_count: 1, skipped_count: 1, failed_count: 0 } });
  const result = await h.action([
    { frontendId: " 1 ", importKind: "practiced", historyDate: "2025-09-14", title: "Tampered" },
    { frontendId: "175", importKind: "scheduled", historyDate: null },
  ]);
  assert.deepEqual(result, { ok: true, summary: { imported: 1, alreadyTracked: 1, skipped: 1, failed: 0 } });
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.calls[0][0], {
    frontend_id: "1", slug: "two-sum", title: "Two Sum", difficulty: "easy",
    topics: ["Array", "Hash Table"], leetcode_url: "https://leetcode.com/problems/two-sum/",
    external_practice_status: "accepted", external_activity_date: "2025-09-14",
  });
  assert.equal(h.calls[0][1].external_practice_status, "attempted_only");
  assert.deepEqual(h.paths, ["/dashboard", "/problems", "/problems/import", "/roadmaps/neetcode-150"]);
});

test("import action rejects unauthenticated, unknown, duplicate, malformed and oversized input before RPC", async () => {
  const signedOut = harness({ authenticated: false });
  assert.deepEqual(await signedOut.action([{ frontendId: "1", importKind: "practiced", historyDate: null }]), { ok: false, error: "not_authenticated" });
  assert.equal(signedOut.calls.length, 0);

  for (const input of [
    [],
    [{ frontendId: "unknown", importKind: "practiced", historyDate: null }],
    [{ frontendId: "1", importKind: "practiced", historyDate: "2026-02-30" }],
    [{ frontendId: "1", importKind: "practiced", historyDate: null }, { frontendId: "1", importKind: "scheduled", historyDate: null }],
  ]) {
    const h = harness();
    assert.deepEqual(await h.action(input), { ok: false, error: "invalid_submission" });
    assert.equal(h.calls.length, 0);
  }
  const tooLarge = harness();
  assert.deepEqual(await tooLarge.action(Array.from({ length: 4001 }, () => ({ frontendId: "1", importKind: "practiced", historyDate: null }))), { ok: false, error: "too_many_problems" });
  assert.equal(tooLarge.calls.length, 0);
});

test("import action maps controlled errors and hides unexpected database details", async (t) => {
  const invalid = harness({ rpcError: { code: "P0001", message: "invalid_submission" } });
  assert.deepEqual(await invalid.action([{ frontendId: "1", importKind: "practiced", historyDate: null }]), { ok: false, error: "invalid_submission" });
  const logger = t.mock.method(console, "error", () => {});
  const failed = harness({ rpcError: { code: "XX001", message: "private", details: "private", hint: "private" } });
  assert.deepEqual(await failed.action([{ frontendId: "1", importKind: "practiced", historyDate: null }]), { ok: false, error: "save_failed" });
  assert.equal(logger.mock.calls.length, 1);
  assert.equal(logger.mock.calls[0].arguments[1].operation, "import_leetcode_history");
});
