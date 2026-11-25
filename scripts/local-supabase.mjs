import { spawnSync } from "node:child_process";

const loopbackHosts = new Set(["127.0.0.1", "localhost"]);

export function assertLoopbackUrl(
  rawUrl,
  { expectedPort, expectedPath, label = "Supabase service" } = {},
) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`${label} did not provide a valid local URL.`);
  }

  if (!loopbackHosts.has(url.hostname)) {
    throw new Error(`${label} must use 127.0.0.1 or localhost.`);
  }
  if (expectedPort && url.port !== String(expectedPort)) {
    throw new Error(`${label} is not using the expected local port.`);
  }
  if (expectedPath && url.pathname !== expectedPath) {
    throw new Error(`${label} is not using the expected local database.`);
  }

  return url;
}

export function getLocalSupabaseStatus() {
  const isWindows = process.platform === "win32";
  const args = ["status", "-o", "json"];
  const options = {
    cwd: process.cwd(),
    encoding: "utf8",
  };
  const installedCli = isWindows ? null : spawnSync("supabase", args, options);
  const status =
    !installedCli || installedCli.error?.code === "ENOENT"
      ? spawnSync(isWindows ? "npx.cmd" : "npx", ["supabase", ...args], {
          ...options,
          shell: isWindows,
        })
      : installedCli;

  if (status.status !== 0 || status.error) {
    throw new Error(
      "Local Supabase is unavailable. Start it with `npx supabase start` and retry.",
    );
  }

  let local;
  try {
    const jsonStart = status.stdout.indexOf("{");
    if (jsonStart < 0) throw new Error("missing JSON");
    local = JSON.parse(status.stdout.slice(jsonStart));
  } catch {
    throw new Error("Could not read the local Supabase status response.");
  }

  assertLoopbackUrl(local.API_URL, { label: "Supabase API" });
  return local;
}

export function getLocalPublicSupabaseEnvironment(local) {
  const publishableKey = local.PUBLISHABLE_KEY || local.ANON_KEY;
  if (!publishableKey) {
    throw new Error("Local Supabase did not provide a public client key.");
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  };
}
