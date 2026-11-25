import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

function createNextResponseMock() {
  return {
    redirect(url) {
      const cookies = [];
      return {
        location: url.toString(),
        cookies: {
          set(...args) {
            cookies.push(args);
          },
          values: cookies,
        },
      };
    },
  };
}

function createRequest(value) {
  const nextUrl = new URL(value);
  nextUrl.clone = () => new URL(nextUrl.toString());
  return { nextUrl, url: nextUrl.toString() };
}

function loadCallback(exchangeResult) {
  const callback = loadTypeScriptModule(
    new URL("../app/auth/callback/route.ts", import.meta.url),
    {
      "next/headers": {
        headers: async () => new Headers({ host: "localhost" }),
      },
      "next/server": { NextResponse: createNextResponseMock() },
      "@/lib/supabase/server": {
        createClient: async () => ({
          auth: { exchangeCodeForSession: async () => exchangeResult },
        }),
      },
    },
  );
  return callback;
}

test("confirmation exchange failures are never reported as confirmation success", async () => {
  const callback = loadCallback({
    error: { code: "bad_code", status: 400, message: "Invalid code" },
  });
  const response = await callback.GET(
    createRequest(
      "http://localhost/auth/callback?flow=confirmation&code=bad&next=%2Fdashboard",
    ),
  );

  assert.equal(
    response.location,
    "http://localhost/sign-in?error=confirmation_failed",
  );
});

test("recovery exchange failures use the reset page without retaining the code", async () => {
  const callback = loadCallback({
    error: { code: "bad_code", status: 400, message: "Invalid code" },
  });
  const response = await callback.GET(
    createRequest(
      "http://localhost/auth/callback?flow=recovery&code=secret&next=https%3A%2F%2Fevil.example",
    ),
  );

  assert.equal(
    response.location,
    "http://localhost/reset-password?error=invalid_recovery",
  );
  assert.equal(response.location.includes("secret"), false);
});

test("successful recovery ignores submitted destinations and removes the code before finalization", async () => {
  const callback = loadCallback({ error: null });
  const response = await callback.GET(
    createRequest(
      "http://localhost/auth/callback?flow=recovery&code=secret&next=https%3A%2F%2Fevil.example",
    ),
  );

  assert.equal(
    response.location,
    "http://localhost/auth/recovery/complete",
  );
  assert.equal(response.location.includes("secret"), false);
});
