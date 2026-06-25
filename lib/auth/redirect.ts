import { headers } from "next/headers";

const fallbackOrigin = "http://localhost";

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizeOrigin(value: string) {
  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Site URL must use http or https.");
  }

  return stripTrailingSlash(url.origin);
}

export function getSafeRedirectPath(
  value: string | string[] | null | undefined,
  fallback = "/dashboard",
) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\")
  ) {
    return fallback;
  }

  const url = new URL(candidate, fallbackOrigin);

  if (url.origin !== fallbackOrigin) {
    return fallback;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export async function getSiteOrigin() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredSiteUrl) {
    return normalizeOrigin(configuredSiteUrl);
  }

  const headerStore = await headers();
  const forwardedHost = headerStore.get("x-forwarded-host")?.split(",")[0];
  const host = forwardedHost ?? headerStore.get("host");

  if (!host || host.includes("/") || host.includes("\\")) {
    throw new Error("Unable to determine the current site origin.");
  }

  const forwardedProto = headerStore.get("x-forwarded-proto")?.split(",")[0];
  const protocol =
    forwardedProto ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return normalizeOrigin(`${protocol}://${host}`);
}

export async function getAuthCallbackUrl(nextPath = "/dashboard") {
  const origin = await getSiteOrigin();
  const url = new URL("/auth/callback", origin);

  url.searchParams.set("next", getSafeRedirectPath(nextPath));

  return url.toString();
}

export function getAuthErrorMessage(code: string | string[] | undefined) {
  const value = Array.isArray(code) ? code[0] : code;

  switch (value) {
    case "invalid_callback":
      return "That confirmation link is missing required information.";
    case "invalid_credentials":
      return "The email or password you entered is not correct.";
    case "rate_limited":
      return "Too many attempts. Please wait a little and try again.";
    case "signup_failed":
      return "We could not create your account. Please try again.";
    case "signout_failed":
      return "We could not sign you out. Please try again.";
    case "validation":
      return "Enter a valid email and a password with at least 6 characters.";
    default:
      return null;
  }
}

export function getAuthStatusMessage(code: string | string[] | undefined) {
  const value = Array.isArray(code) ? code[0] : code;

  switch (value) {
    case "check_email":
      return "Check your email to confirm your account, then come back to sign in.";
    case "email_confirmed":
      return "Your email is confirmed. Please sign in.";
    default:
      return null;
  }
}
