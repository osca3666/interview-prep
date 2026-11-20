import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { before, test } from "node:test";

// Opt in only against a dedicated, empty local test database. Never target the linked database.
const databaseUrl = process.env.STUDY_PLAN_TEST_DATABASE_URL;
const psql = process.env.PSQL_PATH ?? "psql";
const psqlDockerContainer = process.env.PSQL_DOCKER_CONTAINER;
const enabled = Boolean(databaseUrl);
if (enabled) {
  const url = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  assert.match(
    url.pathname,
    /^\/study_plan_2a_test(?:_[a-z0-9_]+)?$/,
    "Use a dedicated study_plan_2a_test scratch database",
  );
}
function psqlInvocation(args) {
  if (!psqlDockerContainer) return { command: psql, args };
  const [rawUrl, ...rest] = args;
  const containerUrl = new URL(rawUrl);
  containerUrl.hostname = "127.0.0.1";
  containerUrl.port = "5432";
  return {
    command: "docker",
    args: ["exec", "-i", psqlDockerContainer, "psql", containerUrl.toString(), ...rest],
  };
}
function spawnPsql(args, options) {
  const invocation = psqlInvocation(args);
  return spawn(invocation.command, invocation.args, options);
}
function spawnPsqlSync(args, options) {
  const invocation = psqlInvocation(args);
  return spawnSync(invocation.command, invocation.args, options);
}
function execute(sql) {
  const result = spawnPsqlSync([databaseUrl, "-XAtq", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message);
  return result.stdout.trim();
}
function authenticated(userId, sql) {
  return `begin; set local role authenticated; set local "request.jwt.claim.sub" = '${userId}'; ${sql}; commit;`;
}
function create(userId, tasks = [], zone = "America/Denver", reference = "clock_timestamp()") {
  return JSON.parse(execute(authenticated(userId,
    `select row_to_json(public.create_daily_study_plan('${zone}', ${reference}, '${JSON.stringify(tasks)}'::jsonb))`)));
}
function user() {
  const id = randomUUID();
  execute(`insert into auth.users(id) values ('${id}')`);
  return id;
}
function problem(userId, { reviews = 1, active = true, due = "now() - interval '1 day'" } = {}) {
  const id = randomUUID();
  execute(`insert into public.user_problems(id,user_id,leetcode_slug,leetcode_url,title,difficulty,total_reviews,next_review_at,lifecycle_state)
    values ('${id}','${userId}','problem-${id}','https://leetcode.com/problems/two-sum/','Original title','easy',${reviews},${due},'${active ? "active" : "paused"}')`);
  return id;
}
function tracked(id, kind = "review", version = 0) {
  return { kind, origin: "tracked", user_problem_id: id, schedule_version: version };
}
const roadmap = { kind: "new_problem", origin: "roadmap", frontend_id: "1", slug: "two-sum",
  title: "Two Sum", difficulty: "easy", leetcode_url: "https://leetcode.com/problems/two-sum/", roadmap_order: 3 };
const dbTest = (name, fn) => test(name, { skip: !enabled }, fn);

before(() => {
  if (!enabled) return;
  assert.equal(execute("select count(*) from information_schema.tables where table_schema in ('public','auth')"), "0", "Use an empty scratch database");
  execute(`do $$ begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    end $$;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;`);
  for (const filename of readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((name) => name.endsWith(".sql")).sort()) {
    execute(readFileSync(new URL(`../supabase/migrations/${filename}`, import.meta.url), "utf8"));
  }
  // Supabase grants authenticated table access before RLS; the scratch cluster
  // applies only repository migrations, so mirror that platform-level grant.
  execute("grant select on public.user_problems to authenticated");
}, { timeout: 120_000 });

dbTest("database: creates ordered snapshots and preserves the actual denominator", () => {
  const id = user();
  const reviewId = problem(id);
  const newId = problem(id, { reviews: 0 });
  const plan = create(id, [tracked(reviewId), tracked(newId, "new_problem")]);
  assert.equal(plan.planned_task_count, 2);
  assert.equal(plan.review_target, 3);
  assert.equal(plan.new_problem_target, 1);
  const rows = JSON.parse(execute(`select json_agg(t order by position) from public.daily_study_plan_tasks t where plan_id='${plan.id}'`));
  assert.deepEqual(rows.map((row) => row.position), [0, 1]);
  assert.deepEqual(rows.map((row) => row.status), ["pending", "pending"]);
  assert.equal(rows[0].title, "Original title");
  execute(`update public.user_problems set title='Changed title', total_reviews=10 where id='${reviewId}'`);
  assert.equal(create(id, [tracked(reviewId, "review", 999)], "Asia/Tokyo").id, plan.id);
  assert.equal(execute(`select title from public.daily_study_plan_tasks where plan_id='${plan.id}' and position=0`), "Original title");
});

dbTest("database: first saved timezone wins and repeat empty plans remain empty", () => {
  const id = user();
  const first = create(id);
  const second = create(id, [roadmap], "Asia/Tokyo");
  assert.equal(first.id, second.id);
  assert.equal(second.time_zone, "America/Denver");
  assert.equal(second.planned_task_count, 0);
});

dbTest("database: unauthenticated and invalid timezone requests fail", () => {
  assert.throws(() => execute("select public.create_daily_study_plan('UTC',now(),'[]')"), /not_authenticated/);
  for (const zone of ["", "Not/A_Timezone"]) assert.throws(() => create(user(), [], zone), /invalid_time_zone/);
});

dbTest("database: ownership, RLS and direct-write permissions are enforced", () => {
  const owner = user();
  const other = user();
  const id = problem(owner);
  const plan = create(owner, [tracked(id)]);
  assert.throws(() => create(other, [tracked(id)]), /stale_recommendations/);
  for (const table of ["user_study_preferences", "daily_study_plans", "daily_study_plan_tasks"]) {
    assert.equal(execute(authenticated(other, `select count(*) from public.${table} where user_id='${owner}'`)), "0");
    for (const privilege of ["INSERT", "UPDATE", "DELETE"]) {
      assert.equal(execute(`select has_table_privilege('authenticated','public.${table}','${privilege}')`), "f");
    }
  }
  assert.equal(execute(authenticated(owner, `select count(*) from public.daily_study_plans where id='${plan.id}'`)), "1");
  assert.equal(execute("select has_function_privilege('anon','public.create_daily_study_plan(text,timestamptz,jsonb)','EXECUTE')"), "f");
});

dbTest("database: stale versions, classification changes, paused and future problems roll back", () => {
  for (const options of [{}, { reviews: 0 }, { active: false }, { due: "now() + interval '1 day'" }]) {
    const id = user();
    const problemId = problem(id, options);
    const version = Object.keys(options).length === 0 ? 1 : 0;
    assert.throws(() => create(id, [tracked(problemId, "review", version)]), /stale_recommendations/);
    assert.equal(execute(`select count(*) from public.daily_study_plans where user_id='${id}'`), "0");
  }
});

dbTest("database: roadmap tasks preserve metadata and reject newly tracked recommendations", () => {
  const id = user();
  const plan = create(id, [roadmap]);
  assert.equal(execute(`select leetcode_frontend_id from public.daily_study_plan_tasks where plan_id='${plan.id}'`), "1");
  const other = user();
  const trackedId = problem(other);
  execute(`update public.user_problems set leetcode_slug='two-sum' where id='${trackedId}'`);
  assert.throws(() => create(other, [roadmap]), /stale_recommendations/);
});

dbTest("database: invalid quotas, duplicate tasks and malformed proposals do not leave partial plans", () => {
  const id = user();
  const review = problem(id);
  assert.throws(() => create(id, [tracked(review), tracked(review)]), /invalid_submission/);
  assert.throws(() => create(id, [roadmap, { ...roadmap, slug: "valid-anagram" }]), /invalid_submission/);
  assert.throws(() => create(id, [tracked("not-a-uuid")]), /invalid_submission/);
  assert.equal(execute(`select count(*) from public.daily_study_plans where user_id='${id}'`), "0");
});

dbTest("database: problem deletion preserves task snapshots and denominator", () => {
  const id = user();
  const problemId = problem(id);
  const plan = create(id, [tracked(problemId)]);
  execute(`delete from public.user_problems where id='${problemId}'`);
  const row = JSON.parse(execute(`select row_to_json(t) from public.daily_study_plan_tasks t where plan_id='${plan.id}'`));
  assert.equal(row.user_problem_id, null);
  assert.equal(row.original_user_problem_id, problemId);
  assert.equal(row.title, "Original title");
  assert.equal(create(id).planned_task_count, 1);
});

dbTest("database: old plans survive and a new local study date gets a new plan", () => {
  const id = user();
  const previous = create(id);
  execute(`update public.daily_study_plans set study_date=study_date-1,day_starts_at=day_starts_at-interval '1 day',
    day_ends_at=day_ends_at-interval '1 day', reference_time=reference_time-interval '1 day' where id='${previous.id}'`);
  assert.notEqual(create(id).id, previous.id);
  assert.equal(execute(`select count(*) from public.daily_study_plans where user_id='${id}'`), "2");
});

dbTest("database: day boundaries use local midnight, including 23-hour and 25-hour DST days", () => {
  for (const [date, hours] of [["2026-03-08", 23], ["2026-11-01", 25]]) {
    assert.equal(execute(`select extract(epoch from ((('${date}'::date+1)::timestamp at time zone 'America/Denver')-
      ('${date}'::timestamp at time zone 'America/Denver')))/3600`), `${hours}.0000000000000000`);
  }
  for (const zone of ["America/Denver", "Asia/Tokyo", "Pacific/Kiritimati"]) {
    const plan = create(user(), [], zone);
    assert.equal(execute(`select ('${plan.day_starts_at}'::timestamptz at time zone '${zone}')::time = time '00:00'`), "t");
    assert.equal(execute(`select ('${plan.day_ends_at}'::timestamptz at time zone '${zone}')::date = '${plan.study_date}'::date+1`), "t");
  }
  assert.throws(() => create(user(), [], "UTC", "clock_timestamp() - interval '2 days'"), /stale_recommendations/);
});

dbTest("database: simultaneous creation returns one plan and one ordered task set", async () => {
  const id = user();
  const problemId = problem(id);
  const sql = authenticated(id,
    `select (public.create_daily_study_plan('UTC',clock_timestamp(),'${JSON.stringify([tracked(problemId)])}')).id; select pg_sleep(0.2)`);
  const request = () => new Promise((resolve, reject) => {
    const child = spawnPsql([databaseUrl, "-XAtq", "-v", "ON_ERROR_STOP=1", "-c", sql]);
    let output = "";
    let errors = "";
    child.stdout.on("data", (data) => { output += data; });
    child.stderr.on("data", (data) => { errors += data; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(errors)));
  });
  const results = await Promise.all([request(), request(), request()]);
  assert.equal(new Set(results).size, 1);
  assert.equal(execute(`select count(*) from public.daily_study_plans where user_id='${id}'`), "1");
  assert.equal(execute(`select count(*) from public.daily_study_plan_tasks where user_id='${id}'`), "1");
});

dbTest("database: account deletion cascades only the deleted user's plan data", () => {
  const id = user();
  const other = user();
  const retainedPlan = create(other);
  create(id, [tracked(problem(id))]);
  execute(`delete from auth.users where id='${id}'`);
  assert.equal(execute(`select count(*) from public.daily_study_plan_tasks where user_id='${id}'`), "0");
  assert.equal(execute(`select count(*) from public.daily_study_plans where user_id='${id}'`), "0");
  assert.equal(execute(`select count(*) from public.daily_study_plans where id='${retainedPlan.id}'`), "1");
});

function tasks(plan) {
  return JSON.parse(execute(`select coalesce(json_agg(t order by position),'[]') from public.daily_study_plan_tasks t where plan_id='${plan.id}'`));
}
function reviewSql(id, version = 0, rating = "good") {
  return `select row_to_json(result) from public.submit_problem_review('${id}','${rating}',${version}) result`;
}
function review(userId, id, version = 0, rating = "good") {
  return JSON.parse(execute(authenticated(userId, reviewSql(id, version, rating))));
}
function trackingSql(mode, { backdated = false, zone = "UTC", metadata = roadmap, rating = "good" } = {}) {
  const date = `(clock_timestamp() at time zone '${zone}')::date${backdated ? "-1" : ""}`;
  return `select row_to_json(result) from public.create_user_problem_with_timezone(
    '${metadata.frontend_id}','${metadata.slug}','${metadata.leetcode_url}','${metadata.title}',
    '${metadata.difficulty}','{}'::text[],'','${mode}','${rating}',${date},'${zone}') result`;
}
function track(userId, mode, options) {
  return JSON.parse(execute(authenticated(userId, trackingSql(mode, options))));
}
function defer(userId, taskId) {
  return JSON.parse(execute(authenticated(userId,
    `select row_to_json(public.defer_daily_study_plan_task('${taskId}'))`)));
}
function addTodaySql(intent, metadata = roadmap) {
  return `select row_to_json(result) from public.add_problem_to_today(
    '${intent}','${metadata.frontend_id}','${metadata.slug}','${metadata.leetcode_url}',
    '${metadata.title}','${metadata.difficulty}','{}'::text[]) result`;
}
function addToday(userId, intent, metadata = roadmap) {
  return JSON.parse(execute(authenticated(userId, addTodaySql(intent, metadata))));
}
function addRecommendedSql(mode, metadata, { version = null, order = null } = {}) {
  const expectedVersion = version === null ? "null" : String(version);
  const roadmapOrder = order === null ? "null" : String(order);
  return `select row_to_json(result) from public.add_problem_to_today(
    '${"todo"}','${metadata.frontend_id}','${metadata.slug}','${metadata.leetcode_url}',
    '${metadata.title}','${metadata.difficulty}','{}'::text[],'${mode}',
    ${expectedVersion}::bigint,${roadmapOrder}::integer) result`;
}
function addRecommended(userId, mode, metadata, options) {
  return JSON.parse(execute(authenticated(userId, addRecommendedSql(mode, metadata, options))));
}
function concurrent(sql) {
  return new Promise((resolve, reject) => {
    const child = spawnPsql([databaseUrl, "-XAtq", "-v", "ON_ERROR_STOP=1", "-c", sql]);
    let output = "";
    let errors = "";
    child.stdout.on("data", (data) => { output += data; });
    child.stderr.on("data", (data) => { errors += data; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(errors)));
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function v1ReviewRaceFixture() {
  const owner = user();
  execute(authenticated(owner,
    "select public.save_study_plan_settings(0,1,null,'sequential','all','{}'::text[],'today','UTC')"));
  const problemId = problem(owner, { due: "clock_timestamp() - interval '5 days'" });
  execute(`update public.user_problems
    set scheduling_policy_version='v1', last_reviewed_at=clock_timestamp()-interval '10 days'
    where id='${problemId}'`);
  const revisionId = execute(`select id from public.study_plan_setting_revisions
    where user_id='${owner}' order by version desc limit 1`);
  const studyDate = execute("select (clock_timestamp() at time zone 'UTC')::date");
  const proposal = [{
    kind: "review",
    origin: "tracked",
    user_problem_id: problemId,
    schedule_version: 0,
    review_pool: "established",
    allocation_key: `v1:${studyDate}:review:0`,
    imported_weight: 0,
    established_weight: 1,
  }];
  const plan = JSON.parse(execute(authenticated(owner,
    `select row_to_json(public.create_v1_daily_study_plan(
      'UTC',clock_timestamp(),'${revisionId}','${JSON.stringify(proposal)}'::jsonb
    ))`)));
  return { owner, problemId, plan };
}

function applyZeroTargetSql() {
  return `select row_to_json(public.save_and_reconcile_study_plan_settings(
    0,0,null,'sequential','all','{}'::text[],'today','UTC',clock_timestamp(),'[]'::jsonb
  ))`;
}

dbTest("today-only add: new To-do creates one pending task without practice", () => {
  const owner = user();
  const plan = create(owner);
  const result = addToday(owner, "todo");
  assert.equal(result.outcome, "added_todo");
  assert.equal(result.task_status, "pending");
  const [task] = tasks(plan);
  assert.deepEqual(
    [task.kind, task.origin, task.status, task.assignment_source],
    ["new_problem", "tracked", "pending", "manual_today"],
  );
  assert.equal(create(owner).planned_task_count, 1);
  assert.equal(execute(`select total_reviews from public.user_problems where user_id='${owner}'`), "0");
  assert.equal(execute(`select count(*) from public.review_events where user_id='${owner}'`), "0");
});

dbTest("today-only add: new Done creates one completed task and one correctable event", () => {
  const owner = user();
  const plan = create(owner);
  const result = addToday(owner, "done");
  assert.equal(result.outcome, "marked_done");
  assert.ok(result.review_event_id);
  const [task] = tasks(plan);
  assert.deepEqual(
    [task.kind, task.status, task.assignment_source, task.completed_review_event_id],
    ["new_problem", "completed", "manual_today", result.review_event_id],
  );
  assert.equal(create(owner).planned_task_count, 1);
  assert.equal(execute(`select count(*) from public.review_events where user_id='${owner}'`), "1");
  const corrected = JSON.parse(execute(authenticated(owner,
    `select row_to_json(result) from public.correct_review_rating('${result.review_event_id}','good') result`)));
  assert.equal(corrected.review_event_id, result.review_event_id);
  assert.equal(execute(`select count(*) from public.review_events where user_id='${owner}'`), "1");
});

dbTest("today-only add: future reviewed problems stay scheduled but become actionable through their manual task", () => {
  const owner = user();
  const plan = create(owner);
  const problemId = problem(owner, { reviews: 2, due: "now() + interval '30 days'" });
  execute(`update public.user_problems set leetcode_frontend_id='1',leetcode_slug='two-sum',
    leetcode_url='https://leetcode.com/problems/two-sum/',title='Two Sum' where id='${problemId}'`);
  const beforeDue = execute(`select next_review_at from public.user_problems where id='${problemId}'`);
  addToday(owner, "todo");
  const [task] = tasks(plan);
  assert.deepEqual([task.kind, task.status, task.assignment_source], ["review", "pending", "manual_today"]);
  assert.equal(execute(`select next_review_at from public.user_problems where id='${problemId}'`), beforeDue);
  const completed = review(owner, problemId, 0, "ok");
  assert.ok(completed.review_event_id);
  assert.equal(tasks(plan)[0].status, "completed");
});

dbTest("today-only add: tracked never-practiced roadmap problems remain New without a practice event", () => {
  const owner = user();
  const plan = create(owner);
  const problemId = problem(owner, { reviews: 0, due: "now() + interval '30 days'" });
  execute(`update public.user_problems set leetcode_frontend_id='1',leetcode_slug='two-sum',
    leetcode_url='https://leetcode.com/problems/two-sum/',title='Two Sum' where id='${problemId}'`);

  const result = addToday(owner, "todo");
  assert.equal(result.outcome, "added_todo");
  const [task] = tasks(plan);
  assert.deepEqual(
    [task.kind, task.origin, task.status, task.assignment_source, task.user_problem_id],
    ["new_problem", "tracked", "pending", "manual_today", problemId],
  );
  assert.equal(create(owner).planned_task_count, 1);
  assert.equal(execute(`select count(*) from public.review_events where user_id='${owner}'`), "0");
});

dbTest("today-only add: duplicate states are controlled and pending Done completes the same task", () => {
  const owner = user();
  const plan = create(owner);
  const todo = addToday(owner, "todo");
  assert.throws(() => addToday(owner, "todo"), /already_in_today/);
  const done = addToday(owner, "done");
  assert.equal(done.task_id, todo.task_id);
  assert.equal(tasks(plan).length, 1);
  assert.equal(tasks(plan)[0].status, "completed");
  assert.equal(execute(`select count(*) from public.review_events where user_id='${owner}'`), "1");
  assert.throws(() => addToday(owner, "done"), /already_completed_today/);
  assert.equal(execute(`select count(*) from public.review_events where user_id='${owner}'`), "1");

  const deferredOwner = user();
  const deferredPlan = create(deferredOwner);
  addToday(deferredOwner, "todo");
  const deferredTask = tasks(deferredPlan)[0];
  execute(authenticated(deferredOwner,
    `select public.snooze_problem_review('${deferredTask.user_problem_id}',0,'America/Denver')`));
  assert.throws(() => addToday(deferredOwner, "todo"), /already_deferred_today/);
  assert.equal(tasks(deferredPlan).length, 1);
});

dbTest("unified add: recommended review becomes a pending task without review or schedule mutation", () => {
  const owner = user();
  const baseProblem = problem(owner);
  const plan = create(owner, [tracked(baseProblem)]);
  review(owner, baseProblem);
  const reviewed = problem(owner, { reviews: 2 });
  execute(`update public.user_problems set leetcode_frontend_id='1',leetcode_slug='two-sum',
    leetcode_url='https://leetcode.com/problems/two-sum/',title='Two Sum' where id='${reviewed}'`);
  const metadata = {
    frontend_id: "1", slug: "two-sum", title: "Two Sum", difficulty: "easy",
    leetcode_url: "https://leetcode.com/problems/two-sum/",
  };
  const beforeDue = execute(`select next_review_at from public.user_problems where id='${reviewed}'`);
  const beforeEvents = execute(`select count(*) from public.review_events where user_id='${owner}'`);

  const result = addRecommended(owner, "review", metadata, { version: 0 });
  assert.equal(result.outcome, "added_todo");
  const rows = tasks(plan);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    [rows[1].kind, rows[1].origin, rows[1].status, rows[1].assignment_source, rows[1].user_problem_id],
    ["review", "tracked", "pending", "manual_today", reviewed],
  );
  assert.equal(create(owner).planned_task_count, 2);
  assert.equal(execute(`select next_review_at from public.user_problems where id='${reviewed}'`), beforeDue);
  assert.equal(execute(`select count(*) from public.review_events where user_id='${owner}'`), beforeEvents);
});

dbTest("unified add: roadmap recommendation stays untracked and creates no practice event", () => {
  const owner = user();
  const baseProblem = problem(owner);
  const plan = create(owner, [tracked(baseProblem)]);
  review(owner, baseProblem);
  const metadata = {
    frontend_id: "20", slug: "valid-parentheses", title: "Valid Parentheses",
    difficulty: "easy", leetcode_url: "https://leetcode.com/problems/valid-parentheses/",
  };
  const beforeEvents = execute(`select count(*) from public.review_events where user_id='${owner}'`);

  const result = addRecommended(owner, "roadmap", metadata, { order: 1 });
  assert.equal(result.outcome, "added_todo");
  const rows = tasks(plan);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    [rows[1].kind, rows[1].origin, rows[1].status, rows[1].assignment_source, rows[1].user_problem_id],
    ["new_problem", "roadmap", "pending", "manual_today", null],
  );
  assert.equal(create(owner).planned_task_count, 2);
  assert.equal(execute(`select count(*) from public.user_problems where user_id='${owner}' and leetcode_frontend_id='20'`), "0");
  assert.equal(execute(`select count(*) from public.review_events where user_id='${owner}'`), beforeEvents);
  assert.throws(() => addRecommended(owner, "roadmap", metadata, { order: 1 }), /plan_not_resolved/);
  assert.equal(tasks(plan).length, 2);
  assert.equal(create(owner).planned_task_count, 2);
});

dbTest("unified add: unresolved plans and stale review versions cannot append recommendations", () => {
  const owner = user();
  const pending = problem(owner);
  const due = problem(owner, { reviews: 2 });
  execute(`update public.user_problems set leetcode_frontend_id='1',leetcode_slug='two-sum',
    leetcode_url='https://leetcode.com/problems/two-sum/',title='Two Sum' where id='${due}'`);
  const metadata = {
    frontend_id: "1", slug: "two-sum", title: "Two Sum", difficulty: "easy",
    leetcode_url: "https://leetcode.com/problems/two-sum/",
  };
  const plan = create(owner, [tracked(pending)]);
  assert.throws(() => addRecommended(owner, "review", metadata, { version: 0 }), /plan_not_resolved/);
  review(owner, pending);
  assert.throws(() => addRecommended(owner, "review", metadata, { version: 99 }), /candidate_changed/);
  assert.equal(tasks(plan).length, 1);
  assert.equal(create(owner).planned_task_count, 1);
});

dbTest("completion: a review completes only its matching task with the exact inserted event", () => {
  const id = user();
  const selected = problem(id);
  const other = problem(id);
  const plan = create(id, [tracked(selected)]);
  const original = tasks(plan)[0];
  review(id, other);
  assert.equal(tasks(plan)[0].status, "pending");
  const result = review(id, selected);
  assert.equal(result.new_schedule_version, 1);
  const completed = tasks(plan)[0];
  const eventId = execute(`select id from public.review_events where user_problem_id='${selected}'`);
  assert.equal(completed.status, "completed");
  assert.equal(completed.completed_review_event_id, eventId);
  assert.equal(completed.completion_event_id_snapshot, eventId);
  assert.ok(completed.completed_at);
  for (const key of ["id", "title", "position", "mastery_score_snapshot", "schedule_version_snapshot", "next_review_at_snapshot"]) {
    assert.equal(completed[key], original[key]);
  }
  assert.equal(create(id).planned_task_count, 1);
});

dbTest("completion: practiced tracking binds a new task and links exactly its first review event", () => {
  const id = user();
  const plan = create(id, [roadmap], "UTC");
  const result = track(id, "practiced");
  const completed = tasks(plan)[0];
  assert.equal(completed.user_problem_id, result.user_problem_id);
  assert.equal(completed.status, "completed");
  assert.equal(completed.origin, "roadmap");
  assert.equal(completed.original_user_problem_id, null);
  assert.equal(execute(`select count(*) from public.review_events where id='${completed.completed_review_event_id}' and user_problem_id='${result.user_problem_id}' and user_id='${id}'`), "1");
  assert.equal(result.total_reviews, 1);
});

dbTest("completion: scheduled tracking binds without credit, then an actual review completes it", () => {
  const id = user();
  const plan = create(id, [roadmap], "UTC");
  const result = track(id, "scheduled");
  assert.equal(tasks(plan)[0].user_problem_id, result.user_problem_id);
  assert.equal(tasks(plan)[0].status, "pending");
  assert.equal(tasks(plan)[0].assignment_source, "generated");
  assert.equal(create(id).planned_task_count, 1);
  assert.equal(tasks(plan)[0].completed_review_event_id, null);
  assert.equal(execute(`select count(*) from public.review_events where user_id='${id}'`), "0");
  review(id, result.user_problem_id);
  assert.equal(tasks(plan)[0].status, "completed");
});

dbTest("scheduling: a same-day manual problem appends once and completes through a real review", () => {
  const id = user();
  const generatedReviews = [problem(id), problem(id), problem(id)];
  const generatedNew = problem(id, { reviews: 0 });
  const plan = create(id, [
    ...generatedReviews.map((problemId) => tracked(problemId)),
    tracked(generatedNew, "new_problem"),
  ], "UTC");
  for (const problemId of [...generatedReviews, generatedNew]) review(id, problemId);
  const resolvedTasks = tasks(plan);
  assert.equal(resolvedTasks.length, 4);
  assert.ok(resolvedTasks.every((task) => task.status === "completed"));
  const resolvedEvidence = resolvedTasks.map((task) => task.completion_event_id_snapshot);
  const metadata = {
    frontend_id: "20",
    slug: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "easy",
    leetcode_url: "https://leetcode.com/problems/valid-parentheses/",
  };

  const result = track(id, "scheduled", { metadata, zone: "UTC" });
  const appended = tasks(plan);
  assert.equal(appended.length, 5);
  assert.deepEqual(appended.map((task) => task.position), [0, 1, 2, 3, 4]);
  assert.equal(appended[4].assignment_source, "manual_scheduled");
  assert.equal(appended[4].kind, "new_problem");
  assert.equal(appended[4].origin, "tracked");
  assert.equal(appended[4].status, "pending");
  assert.equal(appended[4].user_problem_id, result.user_problem_id);
  assert.deepEqual(appended.slice(0, 4).map((task) => task.status), ["completed", "completed", "completed", "completed"]);
  assert.deepEqual(appended.slice(0, 4).map((task) => task.completion_event_id_snapshot), resolvedEvidence);
  assert.equal(create(id).planned_task_count, 5);
  assert.equal(execute(`select count(*) from public.review_events where user_problem_id='${result.user_problem_id}'`), "0");

  assert.throws(() => track(id, "scheduled", { metadata, zone: "UTC" }), /duplicate_problem/);
  assert.equal(tasks(plan).length, 5);
  assert.equal(create(id).planned_task_count, 5);

  review(id, result.user_problem_id);
  const completed = tasks(plan)[4];
  assert.equal(completed.status, "completed");
  assert.ok(completed.completion_event_id_snapshot);
  assert.equal(create(id).planned_task_count, 5);
  assert.equal(execute(`select count(*) from public.review_events where user_problem_id='${result.user_problem_id}'`), "1");
});

dbTest("completion: backdated practice binds but does not complete today's task", () => {
  const id = user();
  const plan = create(id, [roadmap], "UTC");
  const result = track(id, "practiced", { backdated: true });
  const pending = tasks(plan)[0];
  assert.equal(pending.user_problem_id, result.user_problem_id);
  assert.equal(pending.status, "pending");
  assert.equal(pending.completion_event_id_snapshot, null);
  assert.equal(result.total_reviews, 1);
});

dbTest("completion: the saved study day stays authoritative across device timezones", () => {
  for (const backdated of [false, true]) {
    const id = user();
    const plan = create(id, [roadmap], "America/Denver");
    track(id, "practiced", { zone: "Pacific/Kiritimati", backdated });
    assert.equal(tasks(plan)[0].status, backdated ? "pending" : "completed");
    if (!backdated) {
      const completed = tasks(plan)[0];
      assert.ok(Date.parse(completed.completed_at) >= Date.parse(plan.day_starts_at));
      assert.ok(Date.parse(completed.completed_at) < Date.parse(plan.day_ends_at));
    }
  }
});

dbTest("deferral: Skip today preserves practice fields and does not replace or complete its task", () => {
  const id = user();
  const selected = problem(id, { reviews: 0 });
  const plan = create(id, [tracked(selected, "new_problem")]);
  execute(authenticated(id, `select public.snooze_problem_review('${selected}',0,'UTC')`));
  const deferred = tasks(plan)[0];
  assert.equal(deferred.status, "deferred");
  assert.ok(deferred.deferred_at);
  assert.equal(deferred.completed_at, null);
  assert.equal(deferred.completed_review_event_id, null);
  assert.equal(execute(`select count(*) from public.review_events where user_id='${id}'`), "0");
  assert.equal(execute(`select total_reviews||','||mastery_score||','||review_stage||','||schedule_version from public.user_problems where id='${selected}'`), "0,0,0,1");
  assert.equal(create(id).planned_task_count, 1);
  assert.equal(tasks(plan).length, 1);
  // Extra practice later must not silently reopen a deferred task.
  execute(`update public.user_problems set next_review_at=now()-interval '1 day' where id='${selected}'`);
  review(id, selected, 1);
  assert.equal(tasks(plan)[0].status, "deferred");
});

dbTest("deferral: untracked roadmap deferral is owned, current-day, idempotent and creates no activity", () => {
  const id = user();
  const other = user();
  const plan = create(id, [roadmap]);
  const pending = tasks(plan)[0];
  assert.throws(() => defer(other, pending.id), /not_found/);
  const deferred = defer(id, pending.id);
  assert.equal(deferred.status, "deferred");
  assert.equal(defer(id, pending.id).deferred_at, deferred.deferred_at);
  assert.equal(execute(`select count(*) from public.user_problems where user_id='${id}'`), "0");
  assert.equal(execute(`select count(*) from public.review_events where user_id='${id}'`), "0");
  track(id, "practiced");
  assert.equal(tasks(plan)[0].status, "deferred");

  const historicalOwner = user();
  const historical = create(historicalOwner, [roadmap]);
  const historicalTask = tasks(historical)[0];
  execute(`update public.daily_study_plans set study_date=study_date-1,day_starts_at=day_starts_at-interval '1 day',
    day_ends_at=day_ends_at-interval '1 day',reference_time=reference_time-interval '1 day' where id='${historical.id}'`);
  assert.throws(() => defer(historicalOwner, historicalTask.id), /not_found/);
  assert.equal(tasks(historical)[0].status, "pending");
});

dbTest("completion: canonical identity mismatch and foreign-user reviews cannot complete a task", () => {
  const id = user();
  const other = user();
  const selected = problem(id);
  const plan = create(id, [tracked(selected)]);
  assert.throws(() => review(other, selected), /problem_not_due/);
  execute(`update public.daily_study_plan_tasks set leetcode_frontend_id='9999' where plan_id='${plan.id}'`);
  review(id, selected);
  assert.equal(tasks(plan)[0].status, "pending");
  assert.equal(execute("select has_function_privilege('authenticated','private.record_daily_study_activity(uuid,text,uuid,date,text)','EXECUTE')"), "f");
  assert.throws(() => execute(authenticated(id,
    `select private.record_daily_study_activity('${selected}','review',null,null,null)`)), /permission denied/);
});

dbTest("completion: no plan preserves ordinary review, tracking and snooze behavior", () => {
  const id = user();
  const selected = problem(id);
  review(id, selected);
  const newlyTracked = track(id, "practiced");
  assert.equal(newlyTracked.total_reviews, 1);
  const scheduled = problem(id, { reviews: 0 });
  execute(authenticated(id, `select public.snooze_problem_review('${scheduled}',0,'UTC')`));
  assert.equal(execute(`select count(*) from public.daily_study_plans where user_id='${id}'`), "0");
  assert.equal(execute(`select count(*) from public.user_study_preferences where user_id='${id}'`), "0");
  assert.equal(execute(`select count(*) from public.review_events where user_id='${id}'`), "2");
});

dbTest("completion: old plans remain pending and completed evidence survives problem deletion", () => {
  const id = user();
  const selected = problem(id);
  const historical = create(id, [tracked(selected)]);
  execute(`update public.daily_study_plans set study_date=study_date-1,day_starts_at=day_starts_at-interval '1 day',
    day_ends_at=day_ends_at-interval '1 day',reference_time=reference_time-interval '1 day' where id='${historical.id}'`);
  review(id, selected);
  assert.equal(tasks(historical)[0].status, "pending");

  const owner = user();
  const problemId = problem(owner);
  const plan = create(owner, [tracked(problemId)]);
  review(owner, problemId);
  const completed = tasks(plan)[0];
  execute(`delete from public.user_problems where id='${problemId}'`);
  const retained = tasks(plan)[0];
  assert.equal(retained.status, "completed");
  assert.equal(retained.completed_review_event_id, null);
  assert.equal(retained.completion_event_id_snapshot, completed.completion_event_id_snapshot);
  assert.equal(retained.completed_at, completed.completed_at);
  assert.equal(retained.title, completed.title);
  assert.equal(retained.user_problem_id, null);
  execute(`delete from auth.users where id='${owner}'`);
});

dbTest("completion: unexpected task-update failure rolls back reviews, tracking and snooze", () => {
  for (const activity of ["review", "practiced", "snooze"]) {
    const id = user();
    const selected = activity === "practiced" ? null : problem(id);
    const plan = create(id, selected ? [tracked(selected)] : [roadmap], "UTC");
    execute(`create function private.reject_test_task_update() returns trigger language plpgsql as
      $$ begin raise exception 'forced_task_update_failure'; end $$;
      create trigger reject_test_task_update before update on public.daily_study_plan_tasks
      for each row when (new.user_id='${id}'::uuid) execute function private.reject_test_task_update()`);
    try {
      const action = () => activity === "review" ? review(id, selected)
        : activity === "practiced" ? track(id, "practiced")
        : execute(authenticated(id, `select public.snooze_problem_review('${selected}',0,'UTC')`));
      assert.throws(action, /forced_task_update_failure/);
      assert.equal(tasks(plan)[0].status, "pending");
      assert.equal(execute(`select count(*) from public.review_events where user_id='${id}'`), "0");
      if (selected) {
        assert.equal(execute(`select schedule_version||','||total_reviews from public.user_problems where id='${selected}'`), "0,1");
      } else {
        assert.equal(execute(`select count(*) from public.user_problems where user_id='${id}'`), "0");
        assert.equal(tasks(plan)[0].user_problem_id, null);
      }
    } finally {
      execute("drop trigger reject_test_task_update on public.daily_study_plan_tasks; drop function private.reject_test_task_update()");
    }
  }
});

dbTest("completion: duplicate and concurrent submissions create one event and one completion", async () => {
  const id = user();
  const selected = problem(id);
  const plan = create(id, [tracked(selected)]);
  const request = authenticated(id, `set local statement_timeout='5s'; ${reviewSql(selected)}`);
  const results = await Promise.allSettled([concurrent(request), concurrent(request)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.match(results.find((result) => result.status === "rejected").reason.message, /stale_review/);
  assert.equal(execute(`select count(*) from public.review_events where user_id='${id}'`), "1");
  assert.equal(tasks(plan)[0].status, "completed");
  const completed = tasks(plan)[0];
  assert.throws(() => review(id, selected), /stale_review/);
  assert.equal(tasks(plan)[0].completion_event_id_snapshot, completed.completion_event_id_snapshot);
  execute(`update public.user_problems set next_review_at=now()-interval '1 day' where id='${selected}'`);
  review(id, selected, 1);
  assert.equal(execute(`select count(*) from public.review_events where user_id='${id}'`), "2");
  assert.equal(tasks(plan)[0].completion_event_id_snapshot, completed.completion_event_id_snapshot);
  assert.equal(tasks(plan)[0].completed_at, completed.completed_at);
});

dbTest("completion: concurrent review and snooze produce exactly one terminal task state", async () => {
  const id = user();
  const selected = problem(id);
  const plan = create(id, [tracked(selected)]);
  const results = await Promise.allSettled([
    concurrent(authenticated(id, `set local statement_timeout='5s'; ${reviewSql(selected)}`)),
    concurrent(authenticated(id, `set local statement_timeout='5s'; select public.snooze_problem_review('${selected}',0,'UTC')`)),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const terminal = tasks(plan)[0];
  assert.ok(["completed", "deferred"].includes(terminal.status));
  assert.equal(execute(`select count(*) from public.review_events where user_id='${id}'`), terminal.status === "completed" ? "1" : "0");
});

dbTest("completion: plan creation and review use compatible locks without implicit replacements", async () => {
  const id = user();
  const selected = problem(id);
  const proposal = JSON.stringify([tracked(selected)]);
  const results = await Promise.allSettled([
    concurrent(authenticated(id, `set local statement_timeout='5s'; select (public.create_daily_study_plan('UTC',clock_timestamp(),'${proposal}')).id`)),
    concurrent(authenticated(id, `set local statement_timeout='5s'; ${reviewSql(selected)}`)),
  ]);
  assert.equal(results[1].status, "fulfilled");
  if (results[0].status === "rejected") {
    assert.match(results[0].reason.message, /stale_recommendations/);
    assert.equal(execute(`select count(*) from public.daily_study_plans where user_id='${id}'`), "0");
  } else {
    assert.equal(execute(`select status from public.daily_study_plan_tasks where user_id='${id}'`), "completed");
  }
});

function rateNewSql(taskId, rating = "good", metadata = roadmap) {
  return `select row_to_json(public.rate_new_daily_study_task('${taskId}','${rating}',
    '${metadata.frontend_id}','${metadata.slug}','${metadata.leetcode_url}',
    '${metadata.title}','${metadata.difficulty}',array['Array','Hash Table']))`;
}
function rateNew(userId, taskId, rating, metadata) {
  return JSON.parse(execute(authenticated(userId, rateNewSql(taskId, rating, metadata))));
}

dbTest("daily rating: all three first-practice ratings reuse creation rules and exact task evidence", () => {
  for (const [rating, stage, mastery, days] of [["bad", 0, 0, 1], ["ok", 1, 2, 3], ["good", 2, 3, 7]]) {
    const owner = user();
    const plan = create(owner, [roadmap], "Pacific/Kiritimati");
    const original = tasks(plan)[0];
    const completed = rateNew(owner, original.id, rating);
    assert.equal(completed.id, original.id);
    assert.equal(completed.status, "completed");
    const row = JSON.parse(execute(`select row_to_json(p) from public.user_problems p where id='${completed.user_problem_id}'`));
    assert.equal(row.review_stage, stage);
    assert.equal(row.mastery_score, mastery);
    assert.equal(row.total_reviews, 1);
    assert.deepEqual(row.leetcode_topics, ["Array", "Hash Table"]);
    assert.equal(execute(`select (next_review_at at time zone '${plan.time_zone}')::date = '${plan.study_date}'::date+${days}
      from public.user_problems where id='${row.id}'`), "t");
    assert.equal(execute(`select count(*) from public.review_events where user_id='${owner}' and rating='${rating}'
      and id='${completed.completion_event_id_snapshot}' and reviewed_at='${plan.day_starts_at}'`), "1");
    assert.equal(create(owner).planned_task_count, 1);
  }
});

dbTest("daily rating: due tracked never-practiced problems use the original review RPC", () => {
  for (const [rating, stage, mastery] of [["bad", 0, 0], ["ok", 1, 2], ["good", 2, 3]]) {
    const owner = user();
    const selected = problem(owner, { reviews: 0 });
    const plan = create(owner, [tracked(selected, "new_problem")]);
    review(owner, selected, 0, rating);
    assert.equal(tasks(plan)[0].status, "completed");
    assert.equal(execute(`select review_stage||','||mastery_score||','||total_reviews from public.user_problems where id='${selected}'`), `${stage},${mastery},1`);
    assert.throws(() => review(owner, selected, 0, rating), /stale_review/);
  }
});

dbTest("rating correction updates the same attempt and recomputes its transition for five minutes", () => {
  const owner = user();
  const selected = problem(owner, { reviews: 0 });
  const plan = create(owner, [tracked(selected, "new_problem")]);
  const initial = review(owner, selected, 0, "ok");
  const eventId = initial.review_event_id;

  assert.equal(tasks(plan)[0].completed_review_event_id, eventId);
  assert.equal(execute(`select count(*) from public.review_events where user_problem_id='${selected}'`), "1");
  assert.equal(execute(`select rating from public.review_events where id='${eventId}'`), "ok");
  assert.equal(execute(`select review_stage||','||mastery_score||','||total_reviews||','||schedule_version
    from public.user_problems where id='${selected}'`), "1,2,1,1");

  const corrected = JSON.parse(execute(authenticated(owner,
    `select row_to_json(result) from public.correct_review_rating('${eventId}','good') result`)));
  assert.equal(corrected.review_event_id, eventId);
  assert.equal(corrected.rating, "good");
  assert.equal(execute(`select count(*) from public.review_events where user_problem_id='${selected}'`), "1");
  assert.equal(execute(`select rating||','||new_review_stage from public.review_events where id='${eventId}'`), "good,2");
  assert.equal(execute(`select review_stage||','||mastery_score||','||total_reviews||','||schedule_version
    from public.user_problems where id='${selected}'`), "2,3,1,2");
  assert.equal(tasks(plan)[0].completed_review_event_id, eventId);

  const idempotent = JSON.parse(execute(authenticated(owner,
    `select row_to_json(result) from public.correct_review_rating('${eventId}','good') result`)));
  assert.equal(idempotent.new_schedule_version, 2);
  assert.equal(execute(`select schedule_version from public.user_problems where id='${selected}'`), "2");

  const other = user();
  assert.throws(() => execute(authenticated(other,
    `select public.correct_review_rating('${eventId}','bad')`)), /not_found/);
  execute(`update public.review_events set correctable_until=clock_timestamp()-interval '1 second' where id='${eventId}'`);
  assert.throws(() => execute(authenticated(owner,
    `select public.correct_review_rating('${eventId}','bad')`)), /correction_expired/);
  assert.equal(execute(`select count(*) from public.review_events where user_problem_id='${selected}'`), "1");
});

dbTest("daily rating: future and inactive tracked tasks cannot bypass due/lifecycle rules", () => {
  for (const scenario of ["future", "inactive"]) {
    const owner = user();
    const selected = problem(owner, { reviews: 0 });
    const plan = create(owner, [tracked(selected, "new_problem")]);
    if (scenario === "future") {
      execute(`update public.user_problems
        set next_review_at=now()+interval '1 day', schedule_version=schedule_version+1
        where id='${selected}'`);
      assert.throws(() => review(owner, selected), /stale_review/);
    } else {
      execute(`update public.user_problems set lifecycle_state='paused' where id='${selected}'`);
      assert.throws(() => review(owner, selected), /problem_not_due/);
    }
    assert.throws(() => rateNew(owner, tasks(plan)[0].id), /stale_task/);
    assert.equal(tasks(plan)[0].status, "pending");
    assert.equal(execute(`select count(*) from public.review_events where user_id='${owner}'`), "0");
  }
});

dbTest("daily rating: authentication, ownership, metadata and input validation prevent writes", () => {
  const owner = user();
  const other = user();
  const plan = create(owner, [roadmap]);
  const taskId = tasks(plan)[0].id;
  assert.throws(() => execute(rateNewSql(taskId)), /not_authenticated/);
  assert.throws(() => rateNew(other, taskId), /not_found/);
  assert.throws(() => rateNew(owner, randomUUID()), /not_found/);
  for (const rating of ["hard", "invalid"]) assert.throws(() => rateNew(owner, taskId, rating), /invalid_submission/);
  assert.throws(() => rateNew(owner, taskId, "good", { ...roadmap, frontend_id: "2" }), /stale_task/);
  assert.throws(() => rateNew(owner, taskId, "good", { ...roadmap, slug: "wrong" }), /invalid_submission/);
  assert.equal(execute(`select count(*) from public.user_problems where user_id='${owner}'`), "0");
  assert.equal(execute("select has_function_privilege('anon','public.rate_new_daily_study_task(uuid,text,text,text,text,text,text,text[])','EXECUTE')"), "f");
});

dbTest("daily rating: completed, deferred, expired and newly bound tasks reject stale first ratings", () => {
  for (const state of ["completed", "deferred", "expired", "future", "scheduled"]) {
    const owner = user();
    const plan = create(owner, [roadmap], "UTC");
    const taskId = tasks(plan)[0].id;
    if (state === "completed") rateNew(owner, taskId);
    if (state === "deferred") defer(owner, taskId);
    if (state === "scheduled") track(owner, "scheduled");
    if (state === "expired") execute(`update public.daily_study_plans set study_date=study_date-1,
      day_starts_at=day_starts_at-interval '1 day',day_ends_at=day_ends_at-interval '1 day',
      reference_time=reference_time-interval '1 day' where id='${plan.id}'`);
    if (state === "future") execute(`update public.daily_study_plans set study_date=study_date+1,
      day_starts_at=day_starts_at+interval '1 day',day_ends_at=day_ends_at+interval '1 day',
      reference_time=reference_time+interval '1 day' where id='${plan.id}'`);
    const before = tasks(plan)[0];
    assert.throws(() => rateNew(owner, taskId), /task_not_pending|stale_task|not_found/);
    assert.deepEqual(tasks(plan)[0], before);
    assert.equal(execute(`select count(*) from public.review_events where user_id='${owner}'`), state === "completed" ? "1" : "0");
  }
});

dbTest("daily rating: genuinely untracked check catches stale Library identity without creating a second problem", () => {
  const owner = user();
  const plan = create(owner, [roadmap]);
  const selected = problem(owner);
  execute(`update public.user_problems set leetcode_frontend_id='1' where id='${selected}'`);
  assert.throws(() => rateNew(owner, tasks(plan)[0].id), /stale_task/);
  assert.equal(tasks(plan)[0].status, "pending");
  assert.equal(execute(`select count(*) from public.user_problems where user_id='${owner}'`), "1");
});

dbTest("daily rating: failure to complete the exact task rolls back creation and practice", () => {
  const owner = user();
  const plan = create(owner, [roadmap]);
  // Suppress the nested helper's task match, so the wrapper's own postcondition must reject.
  execute(`create function private.suppress_test_task_match() returns trigger language plpgsql as
    $$ begin update public.daily_study_plan_tasks set status='deferred',deferred_at=clock_timestamp()
      where user_id=new.user_id and status='pending'; return new; end $$;
    create trigger suppress_test_task_match after insert on public.user_problems
    for each row when (new.user_id='${owner}'::uuid) execute function private.suppress_test_task_match()`);
  try {
    assert.throws(() => rateNew(owner, tasks(plan)[0].id), /study_task_update_failed/);
    assert.equal(tasks(plan)[0].status, "pending");
    assert.equal(execute(`select count(*) from public.user_problems where user_id='${owner}'`), "0");
    assert.equal(execute(`select count(*) from public.review_events where user_id='${owner}'`), "0");
  } finally {
    execute("drop trigger suppress_test_task_match on public.user_problems; drop function private.suppress_test_task_match()");
  }
});

dbTest("daily rating: concurrent first ratings create exactly one problem, event and completion", async () => {
  const owner = user();
  const plan = create(owner, [roadmap]);
  const sql = authenticated(owner, `set local statement_timeout='5s'; ${rateNewSql(tasks(plan)[0].id)}`);
  const results = await Promise.allSettled([concurrent(sql), concurrent(sql)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.match(results.find((result) => result.status === "rejected").reason.message, /task_not_pending/);
  assert.equal(execute(`select count(*) from public.user_problems where user_id='${owner}'`), "1");
  assert.equal(execute(`select count(*) from public.review_events where user_id='${owner}'`), "1");
  assert.equal(tasks(plan)[0].status, "completed");
});

dbTest("daily rating: deferral and first practice cannot both succeed", async () => {
  const owner = user();
  const plan = create(owner, [roadmap]);
  const taskId = tasks(plan)[0].id;
  const results = await Promise.allSettled([
    concurrent(authenticated(owner, `set local statement_timeout='5s'; ${rateNewSql(taskId)}`)),
    concurrent(authenticated(owner, `set local statement_timeout='5s'; select public.defer_daily_study_plan_task('${taskId}')`)),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const terminal = tasks(plan)[0];
  assert.ok(["completed", "deferred"].includes(terminal.status));
  const expected = terminal.status === "completed" ? "1" : "0";
  assert.equal(execute(`select count(*) from public.review_events where user_id='${owner}'`), expected);
  assert.equal(execute(`select count(*) from public.user_problems where user_id='${owner}'`), expected);
});

function resolvedPlan(owner, deferred = false) {
  const selected = problem(owner);
  const plan = create(owner, [tracked(selected), roadmap], "Pacific/Kiritimati");
  review(owner, selected);
  if (deferred) defer(owner, tasks(plan)[1].id);
  else track(owner, "practiced", { zone: plan.time_zone });
  return plan;
}
function planSnapshot(plan) {
  return { plan: JSON.parse(execute(`select row_to_json(p) from public.daily_study_plans p where id='${plan.id}'`)), tasks: tasks(plan) };
}
const extraRoadmap = { frontend_id: "2", slug: "add-two-numbers", title: "Add Two Numbers", difficulty: "medium", leetcode_url: "https://leetcode.com/problems/add-two-numbers/" };

dbTest("optional work: every rating preserves completed and mixed-deferred plan snapshots exactly", () => {
  for (const deferred of [false, true]) {
    const owner = user();
    const plan = resolvedPlan(owner, deferred);
    const original = planSnapshot(plan);
    const extras = [extraRoadmap,
      { frontend_id: "3", slug: "longest-substring-without-repeating-characters", title: "Longest Substring Without Repeating Characters", difficulty: "medium", leetcode_url: "https://leetcode.com/problems/longest-substring-without-repeating-characters/" },
      { frontend_id: "4", slug: "median-of-two-sorted-arrays", title: "Median of Two Sorted Arrays", difficulty: "hard", leetcode_url: "https://leetcode.com/problems/median-of-two-sorted-arrays/" }];
    for (const [index, rating] of ["bad", "ok", "good"].entries()) {
      const extra = problem(owner);
      review(owner, extra, 0, rating);
      const practiced = track(owner, "practiced", { metadata: extras[index], zone: plan.time_zone, rating });
      assert.equal(practiced.total_reviews, 1);
      assert.equal(execute(`select count(*) from public.review_events where user_problem_id='${practiced.user_problem_id}' and rating='${rating}'`), "1");
      assert.deepEqual(planSnapshot(plan), original);
    }
    assert.equal(execute(`select count(*) from public.daily_study_plans where user_id='${owner}'`), "1");
    assert.equal(execute(`select count(*) from public.daily_study_plan_tasks where user_id='${owner}'`), "2");
  }
});

dbTest("optional work: concurrent roadmap practice creates one event and leaves the original plan unchanged", async () => {
  const owner = user();
  const plan = resolvedPlan(owner, true);
  const original = planSnapshot(plan);
  const sql = authenticated(owner, `set local statement_timeout='5s'; ${trackingSql("practiced", { metadata: extraRoadmap, zone: plan.time_zone })}`);
  const results = await Promise.allSettled([concurrent(sql), concurrent(sql)]);
  assert.equal(results.filter((row) => row.status === "fulfilled").length, 1);
  assert.match(results.find((row) => row.status === "rejected").reason.message, /duplicate_problem/);
  assert.equal(execute(`select count(*) from public.review_events e join public.user_problems p on p.id=e.user_problem_id where p.user_id='${owner}' and p.leetcode_frontend_id='2'`), "1");
  assert.deepEqual(planSnapshot(plan), original);
});

dbTest("optional work: concurrent extra reviews preserve stale-submit protection and original completion evidence", async () => {
  const owner = user();
  const plan = resolvedPlan(owner);
  const original = planSnapshot(plan);
  const extra = problem(owner);
  const sql = authenticated(owner, `set local statement_timeout='5s'; ${reviewSql(extra)}`);
  const results = await Promise.allSettled([concurrent(sql), concurrent(sql)]);
  assert.equal(results.filter((row) => row.status === "fulfilled").length, 1);
  assert.match(results.find((row) => row.status === "rejected").reason.message, /stale_review/);
  assert.equal(execute(`select count(*) from public.review_events where user_problem_id='${extra}'`), "1");
  assert.deepEqual(planSnapshot(plan), original);
});

const acceptedImport = {
  frontend_id: "1", slug: "two-sum", title: "Two Sum", difficulty: "easy",
  topics: ["Array", "Hash Table"], leetcode_url: "https://leetcode.com/problems/two-sum/",
  external_practice_status: "accepted", external_activity_date: "2025-09-14",
};
const attemptedImport = {
  frontend_id: "175", slug: "combine-two-tables", title: "Combine Two Tables", difficulty: "easy",
  topics: ["Database"], leetcode_url: "https://leetcode.com/problems/combine-two-tables/",
  external_practice_status: "attempted_only", external_activity_date: null,
};
function importHistory(owner, rows) {
  const payload = JSON.stringify(rows).replaceAll("'", "''");
  return JSON.parse(execute(authenticated(owner,
    `select row_to_json(result) from public.import_leetcode_history('${payload}'::jsonb) result`)));
}

dbTest("history import: accepted activity creates unknown mastery without fake review events", () => {
  const owner = user();
  assert.deepEqual(importHistory(owner, [acceptedImport, attemptedImport]), {
    imported_count: 1, already_tracked_count: 0, skipped_count: 1, failed_count: 0,
  });
  const row = JSON.parse(execute(`select row_to_json(p) from public.user_problems p where user_id='${owner}'`));
  assert.equal(row.source, "leetcode_import");
  assert.equal(row.external_practice_status, "accepted");
  assert.equal(row.external_activity_date, "2025-09-14");
  assert.equal(row.total_reviews, 0);
  assert.equal(row.mastery_score, 0);
  assert.equal(row.provisional_mastery_score, 3);
  assert.equal(row.review_stage, 0);
  assert.equal(row.last_reviewed_at, null);
  assert.ok(Math.abs(Date.parse(row.next_review_at) - Date.parse(row.created_at)) < 5_000);
  assert.equal(execute(`select count(*) from public.review_events where user_id='${owner}'`), "0");
});

dbTest("history import: existing progress is preserved and malformed batches are atomic", () => {
  const owner = user();
  const practiced = track(owner, "practiced", { metadata: {
    frontend_id: "1", slug: "two-sum", title: "Two Sum", difficulty: "easy", leetcode_url: "https://leetcode.com/problems/two-sum/",
  } });
  assert.deepEqual(importHistory(owner, [acceptedImport]), {
    imported_count: 0, already_tracked_count: 1, skipped_count: 0, failed_count: 0,
  });
  assert.equal(execute(`select total_reviews from public.user_problems where id='${practiced.user_problem_id}'`), "1");
  assert.equal(execute(`select count(*) from public.review_events where user_problem_id='${practiced.user_problem_id}'`), "1");
  assert.throws(() => importHistory(owner, [
    { ...acceptedImport, frontend_id: "2", slug: "add-two-numbers", title: "Add Two Numbers", difficulty: "medium", leetcode_url: "https://leetcode.com/problems/add-two-numbers/" },
    { ...acceptedImport, frontend_id: "3", slug: "bad", leetcode_url: "https://leetcode.com/problems/bad/", external_activity_date: "2026-02-30" },
  ]), /invalid_submission/);
  assert.equal(execute(`select count(*) from public.user_problems where user_id='${owner}'`), "1");
});

dbTest("history import: concurrent imports create one row and never alter an existing daily plan", async () => {
  const owner = user();
  const selected = problem(owner);
  const plan = create(owner, [tracked(selected)]);
  const original = planSnapshot(plan);
  const payload = JSON.stringify([acceptedImport]).replaceAll("'", "''");
  const sql = authenticated(owner, `set local statement_timeout='5s'; select row_to_json(result) from public.import_leetcode_history('${payload}'::jsonb) result`);
  const results = await Promise.all([concurrent(sql), concurrent(sql)]);
  assert.equal(execute(`select count(*) from public.user_problems where user_id='${owner}' and leetcode_frontend_id='1'`), "1");
  assert.equal(results.some((value) => value.includes('"imported_count":1')), true);
  assert.equal(results.some((value) => value.includes('"already_tracked_count":1')), true);
  assert.deepEqual(planSnapshot(plan), original);
});

dbTest("history import: calibration is one persisted slot and its first real rating starts normal review history", () => {
  const owner = user();
  importHistory(owner, [acceptedImport]);
  const importedId = execute(`select id from public.user_problems where user_id='${owner}' and leetcode_frontend_id='1'`);
  const plan = create(owner, [tracked(importedId, "calibration")]);
  const task = tasks(plan)[0];
  assert.equal(task.kind, "calibration");
  assert.equal(task.status, "pending");
  review(owner, importedId, 0, "good");
  assert.equal(tasks(plan)[0].status, "completed");
  assert.equal(execute(`select provisional_mastery_score is null from public.user_problems where id='${importedId}'`), "t");
  assert.equal(execute(`select total_reviews||','||mastery_score||','||review_stage from public.user_problems where id='${importedId}'`), "1,3,2");
  assert.equal(execute(`select count(*) from public.review_events where user_problem_id='${importedId}'`), "1");
});

dbTest("history import: RPC authentication, ownership and direct table RLS remain enforced", () => {
  const owner = user();
  const other = user();
  importHistory(owner, [acceptedImport]);
  assert.throws(() => execute(`select * from public.import_leetcode_history('[]'::jsonb)`), /not_authenticated/);
  assert.equal(execute(authenticated(other, `select count(*) from public.user_problems where source='leetcode_import'`)), "0");
  assert.equal(execute("select has_function_privilege('anon','public.import_leetcode_history(jsonb)','EXECUTE')"), "f");
  assert.equal(execute("select has_function_privilege('authenticated','public.import_leetcode_history(jsonb)','EXECUTE')"), "t");
});

dbTest("V1 foundation: settings revisions are immutable to clients and enforce target bounds", () => {
  const owner = user();
  const other = user();
  const contextId = execute(`insert into public.review_allocation_contexts(
      user_id, review_source, filter_fingerprint
    ) values ('${owner}', 'all', 'all') returning id`);
  execute(`insert into public.study_plan_setting_revisions(
      user_id, version, effective_study_date, daily_new_target, daily_review_target,
      followed_roadmap_id, new_selection_mode, review_allocation_context_id
    ) values
      ('${owner}', 1, '2026-11-10', 0, 0, null, 'sequential', '${contextId}'),
      ('${owner}', 2, '2026-11-11', 10, 20, 'neetcode-150', 'shuffled', '${contextId}')`);
  assert.equal(execute(`select count(*) from public.study_plan_setting_revisions where user_id='${owner}'`), "2");
  assert.throws(() => execute(`insert into public.study_plan_setting_revisions(
      user_id, version, effective_study_date, daily_new_target, daily_review_target,
      new_selection_mode, review_allocation_context_id
    ) values ('${owner}', 3, '2026-11-12', 11, 1, 'sequential', '${contextId}')`), /check constraint/);
  assert.throws(() => execute(authenticated(owner,
    `update public.study_plan_setting_revisions set daily_new_target=4 where user_id='${owner}'`)), /permission denied/);
  assert.equal(execute(authenticated(owner,
    `select count(*) from public.study_plan_setting_revisions where user_id='${owner}'`)), "2");
  assert.equal(execute(authenticated(other,
    `select count(*) from public.study_plan_setting_revisions where user_id='${owner}'`)), "0");
});

dbTest("V1 foundation: event classification snapshots and local study context are constrained", () => {
  const owner = user();
  const practiced = track(owner, "practiced");
  const eventId = practiced.review_event_id;
  execute(`update public.review_events set
    previous_consecutive_good_count=0,
    resulting_consecutive_good_count=1,
    scheduling_policy_version='v1',
    pre_practice_problem_type='new',
    pre_practice_review_pool=null,
    practice_local_date='2026-11-10',
    practice_time_zone='America/Denver'
    where id='${eventId}'`);
  assert.equal(execute(`select pre_practice_problem_type||','||resulting_consecutive_good_count
    from public.review_events where id='${eventId}'`), "new,1");
  assert.throws(() => execute(`update public.review_events
    set pre_practice_problem_type='new', pre_practice_review_pool='imported'
    where id='${eventId}'`), /check constraint/);
  assert.throws(() => execute(`update public.review_events
    set practice_local_date='2026-11-10', practice_time_zone=null
    where id='${eventId}'`), /check constraint/);
});

dbTest("V1 foundation: allocation credits are idempotent and unassignment requires a reason", () => {
  const owner = user();
  const problemId = problem(owner);
  const plan = create(owner, [tracked(problemId)]);
  const task = tasks(plan)[0];
  const contextId = execute(`insert into public.review_allocation_contexts(
    user_id, review_source, filter_fingerprint
  ) values ('${owner}', 'all', 'all') returning id`);
  execute(`insert into public.review_allocation_entries(
    context_id, user_id, allocation_key, candidate_user_problem_id,
    candidate_problem_id_snapshot, pool, source, imported_weight, established_weight,
    daily_study_plan_task_id, daily_study_plan_task_id_snapshot
  ) values (
    '${contextId}', '${owner}', 'plan:${task.id}', '${problemId}', '${problemId}',
    'established', 'generated', 2, 3, '${task.id}', '${task.id}'
  )`);
  assert.throws(() => execute(`insert into public.review_allocation_entries(
    context_id, user_id, allocation_key, candidate_problem_id_snapshot,
    pool, source, imported_weight, established_weight, daily_study_plan_task_id_snapshot
  ) values (
    '${contextId}', '${owner}', 'plan:${task.id}', '${problemId}',
    'established', 'generated', 2, 3, '${task.id}'
  )`), /unique constraint/);
  execute(`update public.daily_study_plan_tasks
    set status='unassigned', unassigned_at=now(), unassignment_reason='settings_changed'
    where id='${task.id}'`);
  assert.equal(execute(`select status from public.daily_study_plan_tasks where id='${task.id}'`), "unassigned");
  assert.throws(() => execute(`update public.daily_study_plan_tasks
    set unassignment_reason=null where id='${task.id}'`), /check constraint/);
  execute(`update public.review_allocation_entries
    set active=false, reversed_at=now(), reversal_reason='task_unassigned'
    where allocation_key='plan:${task.id}'`);
  assert.equal(execute(`select active from public.review_allocation_entries
    where allocation_key='plan:${task.id}'`), "f");
});

dbTest("V1 concurrency: review and Apply today serialize without losing completed work", async () => {
  const { owner, problemId, plan } = v1ReviewRaceFixture();
  const lock = `select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-study-plan:${owner}',0));`;
  const reviewRequest = concurrent(authenticated(owner,
    `${lock} select pg_sleep(0.25); ${reviewSql(problemId, 0, "ok")}`));
  await wait(50);
  const settingsRequest = concurrent(authenticated(owner, applyZeroTargetSql()));
  const results = await Promise.allSettled([reviewRequest, settingsRequest]);
  assert.deepEqual(results.map((result) => result.status), ["fulfilled", "fulfilled"]);

  assert.equal(execute(`select count(*) from public.review_events
    where user_id='${owner}' and user_problem_id='${problemId}'`), "1");
  assert.equal(execute(`select status from public.daily_study_plan_tasks
    where plan_id='${plan.id}' and original_user_problem_id='${problemId}'`), "completed");
  assert.equal(execute(`select planned_task_count from public.daily_study_plans
    where id='${plan.id}'`), "1");
  assert.equal(execute(`select count(*) from public.review_allocation_entries
    where user_id='${owner}' and source='generated' and active`), "1");
  assert.equal(execute(`select count(*) from public.study_plan_setting_revisions
    where user_id='${owner}'`), "2");
});

dbTest("V1 concurrency: Apply today first preserves later practice and reverses once", async () => {
  const { owner, problemId, plan } = v1ReviewRaceFixture();
  const lock = `select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-study-plan:${owner}',0));`;
  const settingsRequest = concurrent(authenticated(owner,
    `${lock} select pg_sleep(0.25); ${applyZeroTargetSql()}`));
  await wait(50);
  const reviewRequest = concurrent(authenticated(owner, reviewSql(problemId, 0, "ok")));
  const results = await Promise.allSettled([settingsRequest, reviewRequest]);
  assert.deepEqual(results.map((result) => result.status), ["fulfilled", "fulfilled"]);

  assert.equal(execute(`select count(*) from public.review_events
    where user_id='${owner}' and user_problem_id='${problemId}'`), "1");
  assert.equal(execute(`select status from public.daily_study_plan_tasks
    where plan_id='${plan.id}' and original_user_problem_id='${problemId}'`), "unassigned");
  assert.equal(execute(`select planned_task_count from public.daily_study_plans
    where id='${plan.id}'`), "0");
  assert.equal(execute(`select count(*) from public.review_allocation_entries
    where user_id='${owner}' and source='generated' and not active
      and reversal_reason='settings_reconciliation'`), "1");
  assert.equal(execute(`select count(*) from public.review_allocation_entries
    where user_id='${owner}' and source='manual' and active`), "1");
});
