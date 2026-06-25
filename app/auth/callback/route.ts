import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

type SupabaseExchangeError = {
  code?: string;
  status?: number;
  message?: string;
};

function logCallbackFailure(
  codePresent: boolean,
  error: SupabaseExchangeError | null,
) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.error("Supabase auth callback failure", {
    codePresent,
    exchangeErrorCode: error?.code ?? null,
    status: error?.status ?? null,
    message: error?.message ?? "Missing confirmation code.",
  });
}

function redirectToSignIn(
  request: NextRequest,
  param: "error" | "message",
  value: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  url.searchParams.set(param, value);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = getSafeRedirectPath(request.nextUrl.searchParams.get("next"));

  if (!code) {
    logCallbackFailure(false, null);
    return redirectToSignIn(request, "error", "invalid_callback");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    logCallbackFailure(true, error);
    return redirectToSignIn(request, "message", "email_confirmed");
  }

  return NextResponse.redirect(new URL(next, request.url));
}
