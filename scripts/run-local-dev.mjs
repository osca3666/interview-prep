import { spawn } from "node:child_process";
import { resolve } from "node:path";
import {
  getLocalPublicSupabaseEnvironment,
  getLocalSupabaseStatus,
} from "./local-supabase.mjs";

const nextArgs = process.argv.slice(2);
if (
  nextArgs.some(
    (argument) =>
      argument === "-H" ||
      argument === "--hostname" ||
      argument.startsWith("--hostname="),
  )
) {
  process.stderr.write(
    "`dev:local` always binds to 127.0.0.1; hostname overrides are not allowed.\n",
  );
  process.exit(1);
}

let localEnvironment;
try {
  const local = getLocalSupabaseStatus();
  localEnvironment = getLocalPublicSupabaseEnvironment(local);
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Local Supabase setup failed."}\n`,
  );
  process.exit(1);
}

process.stdout.write(
  "Starting Next.js on 127.0.0.1 with the local Supabase stack.\n",
);

const child = spawn(
  process.execPath,
  [
    resolve("node_modules/next/dist/bin/next"),
    "dev",
    ...nextArgs,
    "--hostname",
    "127.0.0.1",
  ],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      ...localEnvironment,
    },
  },
);

child.once("error", () => {
  process.stderr.write("Could not start the local Next.js development server.\n");
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
