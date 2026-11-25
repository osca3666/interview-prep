import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

const recovery = loadTypeScriptModule(
  new URL("../lib/auth/recovery.ts", import.meta.url),
);

test("auth callback flow only accepts the recovery allowlist value", () => {
  assert.equal(recovery.getAuthCallbackFlow("recovery"), "recovery");
  assert.equal(recovery.getAuthCallbackFlow("confirmation"), "confirmation");
  assert.equal(recovery.getAuthCallbackFlow("reset"), "confirmation");
  assert.equal(recovery.getAuthCallbackFlow(null), "confirmation");
});

test("reset password validation requires matching passwords of the minimum length", () => {
  assert.equal(
    recovery.getResetPasswordValidationError("short", "short"),
    "password_too_short",
  );
  assert.equal(
    recovery.getResetPasswordValidationError("new-password", "different-password"),
    "password_mismatch",
  );
  assert.equal(
    recovery.getResetPasswordValidationError("new-password", "new-password"),
    null,
  );
});

test("only a recent OTP-authenticated session may finalize recovery", () => {
  const now = 2_000_000_000;

  assert.equal(
    recovery.hasRecentOtpAuthentication(
      { iat: now - 30, amr: [{ method: "otp" }] },
      now,
    ),
    true,
  );
  assert.equal(
    recovery.hasRecentOtpAuthentication(
      { iat: now - 30, amr: [{ method: "password" }] },
      now,
    ),
    false,
  );
  assert.equal(
    recovery.hasRecentOtpAuthentication(
      {
        iat: now - recovery.PASSWORD_RECOVERY_MAX_AGE_SECONDS - 1,
        amr: [{ method: "otp" }],
      },
      now,
    ),
    false,
  );
});

test("safe auth redirects reject external and protocol-relative destinations", () => {
  const redirect = loadTypeScriptModule(
    new URL("../lib/auth/redirect.ts", import.meta.url),
    { "next/headers": { headers: async () => new Headers() } },
  );

  assert.equal(redirect.getSafeRedirectPath("/study-plan/setup"), "/study-plan/setup");
  assert.equal(redirect.getSafeRedirectPath("//example.com"), "/dashboard");
  assert.equal(redirect.getSafeRedirectPath("https://example.com"), "/dashboard");
  assert.equal(redirect.getSafeRedirectPath("/safe\\evil"), "/dashboard");
});
