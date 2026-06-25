"use server";

import { redirect } from "next/navigation";
import {
  getAuthCallbackUrl,
  getSafeRedirectPath,
} from "@/lib/auth/redirect";
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
  return isValidEmail(email) && password.length >= 6;
}

function logAuthError(operation: "sign-up" | "sign-in", error: SupabaseAuthError) {
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

export async function signUpAction(formData: FormData) {
  const email = getTextField(formData, "email").toLowerCase();
  const password = getPasswordField(formData, "password");

  if (!hasValidCredentials(email, password)) {
    redirect("/sign-up?error=validation");
  }

  const supabase = await createClient();
  const emailRedirectTo = await getAuthCallbackUrl("/dashboard");
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
    redirect("/dashboard");
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
