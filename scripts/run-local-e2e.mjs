import { spawnSync } from "node:child_process";
import {
  assertLoopbackUrl,
  getLocalPublicSupabaseEnvironment,
  getLocalSupabaseStatus,
} from "./local-supabase.mjs";

let local;
try {
  local = getLocalSupabaseStatus();
  assertLoopbackUrl(local.API_URL, {
    expectedPort: 54121,
    label: "Supabase API",
  });
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

const localEnvironment = getLocalPublicSupabaseEnvironment(local);
const serviceRoleKey = local.SERVICE_ROLE_KEY || local.SECRET_KEY;
const mailpitUrl = local.MAILPIT_URL || local.INBUCKET_URL;
if (!serviceRoleKey) {
  process.stderr.write("Local Supabase did not provide an E2E service key.\n");
  process.exit(1);
}
if (!mailpitUrl) {
  process.stderr.write("Local Supabase did not provide a Mailpit URL.\n");
  process.exit(1);
}

try {
  assertLoopbackUrl(mailpitUrl, {
    expectedPort: 54124,
    label: "Supabase Mailpit",
  });
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Local Mailpit setup failed."}\n`,
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["node_modules/@playwright/test/cli.js", "test", "--config=playwright.authenticated.config.ts", ...process.argv.slice(2)],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      PLAYWRIGHT_E2E: "1",
      ...localEnvironment,
      E2E_SUPABASE_URL: local.API_URL,
      E2E_SUPABASE_PUBLISHABLE_KEY:
        localEnvironment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      E2E_SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      E2E_MAILPIT_URL: mailpitUrl,
    },
  },
);

process.exit(result.status ?? 1);
