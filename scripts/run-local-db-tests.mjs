import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  assertLoopbackUrl,
  getLocalSupabaseStatus,
} from "./local-supabase.mjs";

const container =
  process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_leetcode-review";

if (!/^[a-zA-Z0-9_.-]+$/.test(container)) {
  process.stderr.write("Invalid local Supabase database container name.\n");
  process.exit(1);
}

let local;
try {
  local = getLocalSupabaseStatus();
  assertLoopbackUrl(local.DB_URL, {
    expectedPort: 54122,
    expectedPath: "/postgres",
    label: "Supabase database",
  });
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Local Supabase setup failed."}\n`,
  );
  process.exit(1);
}

const databaseName = `study_plan_2a_test_ci_${randomBytes(8).toString("hex")}`;
const scratchUrl = new URL(local.DB_URL);
scratchUrl.pathname = `/${databaseName}`;
scratchUrl.search = "";
scratchUrl.hash = "";

function runPostgresCommand(sql) {
  return spawnSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-XAtq",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { cwd: process.cwd(), encoding: "utf8", shell: false },
  );
}

let databaseCreated = false;
let exitCode = 1;

try {
  const createResult = runPostgresCommand(`create database ${databaseName}`);
  if (createResult.status !== 0 || createResult.error) {
    throw new Error(
      createResult.stderr ||
        createResult.error?.message ||
        "Could not create the local scratch database.",
    );
  }
  databaseCreated = true;

  const testResult = spawnSync(
    process.execPath,
    [
      "--test",
      "--test-reporter=tap",
      "tests/daily-study-plan-db.test.mjs",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      shell: false,
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        STUDY_PLAN_TEST_DATABASE_URL: scratchUrl.toString(),
        PSQL_DOCKER_CONTAINER: container,
      },
    },
  );

  process.stdout.write(testResult.stdout ?? "");
  process.stderr.write(testResult.stderr ?? "");

  if (testResult.status !== 0 || testResult.error) {
    throw new Error(
      testResult.error?.message || "PostgreSQL integration tests failed.",
    );
  }

  const output = testResult.stdout ?? "";
  const total = Number(output.match(/^# tests (\d+)$/m)?.[1] ?? "0");
  const passed = Number(output.match(/^# pass (\d+)$/m)?.[1] ?? "0");
  const failed = Number(output.match(/^# fail (\d+)$/m)?.[1] ?? "0");
  const skipped = Number(output.match(/^# skipped (\d+)$/m)?.[1] ?? "0");

  if (total < 1 || passed !== total || failed !== 0 || skipped !== 0) {
    throw new Error(
      `Database test verification failed (tests=${total}, passed=${passed}, failed=${failed}, skipped=${skipped}).`,
    );
  }

  process.stdout.write(
    `Verified ${passed} PostgreSQL integration tests passed with no skips.\n`,
  );
  exitCode = 0;
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Database integration setup failed."}\n`,
  );
} finally {
  if (databaseCreated) {
    const dropResult = runPostgresCommand(
      `drop database if exists ${databaseName} with (force)`,
    );
    if (dropResult.status !== 0 || dropResult.error) {
      process.stderr.write(
        dropResult.stderr ||
          dropResult.error?.message ||
          "Could not remove the local scratch database.\n",
      );
      exitCode = 1;
    }
  }
}

process.exit(exitCode);
