export const AUTH_MIN_PASSWORD_LENGTH = 6;
export const PASSWORD_RECOVERY_FLOW = "recovery";
export const PASSWORD_RECOVERY_COOKIE = "interviewprep-password-recovery";
export const PASSWORD_RECOVERY_COOKIE_VALUE = "active";
export const PASSWORD_RECOVERY_MAX_AGE_SECONDS = 10 * 60;

export type AuthCallbackFlow = "confirmation" | "recovery";

export function getAuthCallbackFlow(
  value: string | null | undefined,
): AuthCallbackFlow {
  return value === PASSWORD_RECOVERY_FLOW ? "recovery" : "confirmation";
}

export function getResetPasswordValidationError(
  password: string,
  confirmation: string,
) {
  if (password.length < AUTH_MIN_PASSWORD_LENGTH) {
    return "password_too_short" as const;
  }

  if (password !== confirmation) {
    return "password_mismatch" as const;
  }

  return null;
}

export function hasRecentOtpAuthentication(
  claims: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!claims || typeof claims !== "object") return false;

  const record = claims as Record<string, unknown>;
  const issuedAt = record.iat;
  const methods = record.amr;

  if (
    typeof issuedAt !== "number" ||
    issuedAt > nowSeconds + 60 ||
    nowSeconds - issuedAt > PASSWORD_RECOVERY_MAX_AGE_SECONDS ||
    !Array.isArray(methods)
  ) {
    return false;
  }

  return methods.some(
    (entry) =>
      Boolean(entry) &&
      typeof entry === "object" &&
      ["otp", "recovery"].includes(
        String((entry as Record<string, unknown>).method ?? ""),
      ),
  );
}
