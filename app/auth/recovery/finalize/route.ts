import {
  hasRecentOtpAuthentication,
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_COOKIE_VALUE,
  PASSWORD_RECOVERY_MAX_AGE_SECONDS,
} from "@/lib/auth/recovery";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const claimsResult = await supabase.auth.getClaims();
  const claims = claimsResult.data?.claims as
    | { amr?: Array<{ method?: string }>; iat?: number }
    | undefined;

  if (
    claimsResult.error ||
    !hasRecentOtpAuthentication(claims)
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    PASSWORD_RECOVERY_COOKIE,
    PASSWORD_RECOVERY_COOKIE_VALUE,
    {
      httpOnly: true,
      maxAge: PASSWORD_RECOVERY_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  );

  return response;
}
