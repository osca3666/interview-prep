"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getAuthCallbackUrl,
  getSafeRedirectPath,
} from "@/lib/auth/redirect";
import {
  AUTH_MIN_PASSWORD_LENGTH,
  getResetPasswordValidationError,
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_COOKIE_VALUE,
} from "@/lib/auth/recovery";
import { createClient } from "@/lib/supabase/server";

type SupabaseAuthError = {
  code?: string;
  status?: number;
  message?: string;
};

function getTextField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function getPasswordField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hasValidCredentials(email: string, password: string) {
  return isValidEmail(email) && password.length >= AUTH_MIN_PASSWORD_LENGTH;
}

function logAuthError(
  operation:
    | "sign-up"
    | "sign-in"
    | "request-password-reset"
    | "update-password"
    | "sign-out-after-password-reset",
  error: SupabaseAuthError,
) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.error("Supabase auth error", {
    operation,
    code: error.code ?? null,
    status: error.status ?? null,
    message: error.message ?? null,
  });
}

function shouldTreatSignupErrorAsCheckEmail(error: SupabaseAuthError) {
  const code = error.code?.toLowerCase() ?? "";
  const message = error.message?.toLowerCase() ?? "";

  return (
    code === "email_exists" ||
    code === "user_already_exists" ||
    message.includes("already registered") ||
    message.includes("already been registered")
  );
}

function shouldTreatSignupErrorAsRateLimited(error: SupabaseAuthError) {
  const code = error.code?.toLowerCase() ?? "";
  const message = error.message?.toLowerCase() ?? "";

  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    error.status === 429
  ) {
    return true;
  }

  return !code && message.includes("rate limit");
}

function clearPasswordRecoveryCookie(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  cookieStore.set(PASSWORD_RECOVERY_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function signUpAction(formData: FormData) {
  const email = getTextField(formData, "email").toLowerCase();
  const password = getPasswordField(formData, "password");

  if (!hasValidCredentials(email, password)) {
    redirect("/sign-up?error=validation");
  }

  const supabase = await createClient();
  const emailRedirectTo = await getAuthCallbackUrl(
    "/study-plan/setup",
    "confirmation",
  );
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
    },
  });

  if (error) {
    logAuthError("sign-up", error);

    if (shouldTreatSignupErrorAsCheckEmail(error)) {
      redirect("/sign-up?message=check_email");
    }

    if (shouldTreatSignupErrorAsRateLimited(error)) {
      redirect("/sign-up?error=rate_limited");
    }

    redirect("/sign-up?error=signup_failed");
  }

  if (data.session) {
    redirect("/study-plan/setup");
  }

  redirect("/sign-up?message=check_email");
}

export async function signInAction(formData: FormData) {
  const email = getTextField(formData, "email").toLowerCase();
  const password = getPasswordField(formData, "password");
  const next = getSafeRedirectPath(getTextField(formData, "next"));

  if (!hasValidCredentials(email, password)) {
    redirect("/sign-in?error=validation");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    logAuthError("sign-in", error);
    redirect("/sign-in?error=invalid_credentials");
  }

  redirect(next);
}

export async function signOutAction() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    redirect("/dashboard?error=signout_failed");
  }

  redirect("/sign-in");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = getTextField(formData, "email").toLowerCase();

  if (!isValidEmail(email)) {
    redirect("/forgot-password?error=validation");
  }

  const supabase = await createClient();
  const redirectTo = await getAuthCallbackUrl("/reset-password", "recovery");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    logAuthError("request-password-reset", error);

    if (shouldTreatSignupErrorAsRateLimited(error)) {
      redirect("/forgot-password?error=rate_limited");
    }

    redirect("/forgot-password?error=request_failed");
  }

  redirect("/forgot-password?message=check_email");
}

export async function resetPasswordAction(formData: FormData) {
  const password = getPasswordField(formData, "password");
  const confirmation = getPasswordField(formData, "password_confirmation");
  const validationError = getResetPasswordValidationError(
    password,
    confirmation,
  );

  if (validationError) {
    redirect(`/reset-password?error=${validationError}`);
  }

  const cookieStore = await cookies();
  const recoveryMarker = cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value;

  if (recoveryMarker !== PASSWORD_RECOVERY_COOKIE_VALUE) {
    redirect("/reset-password?error=invalid_recovery");
  }

  const supabase = await createClient();
  const claimsResult = await supabase.auth.getClaims();

  if (claimsResult.error || !claimsResult.data?.claims) {
    clearPasswordRecoveryCookie(cookieStore);
    redirect("/reset-password?error=invalid_recovery");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    logAuthError("update-password", error);

    if (
      error.code === "session_not_found" ||
      error.code === "refresh_token_not_found" ||
      error.status === 401
    ) {
      clearPasswordRecoveryCookie(cookieStore);
      redirect("/reset-password?error=invalid_recovery");
    }

    redirect("/reset-password?error=update_failed");
  }

  clearPasswordRecoveryCookie(cookieStore);
  const signOutResult = await supabase.auth.signOut({ scope: "local" });

  if (signOutResult.error) {
    logAuthError("sign-out-after-password-reset", signOutResult.error);
  }

  redirect("/reset-password?message=password_updated");
}
