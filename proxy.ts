import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import {
  isAnalyticsVisualTestRequest,
  VISUAL_TEST_REQUEST_HEADER,
  VISUAL_TEST_REQUEST_VALUE,
} from "@/lib/visual-test-access";

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(VISUAL_TEST_REQUEST_HEADER);

  if (
    isAnalyticsVisualTestRequest({
      nodeEnv: process.env.NODE_ENV,
      playwrightTest: process.env.PLAYWRIGHT_TEST,
      pathname: request.nextUrl.pathname,
      searchParams: request.nextUrl.searchParams,
    })
  ) {
    requestHeaders.set(
      VISUAL_TEST_REQUEST_HEADER,
      VISUAL_TEST_REQUEST_VALUE,
    );

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  return updateSession(request, requestHeaders);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
