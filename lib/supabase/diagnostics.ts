import "server-only";

type DatabaseError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function getSupabaseTarget() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!rawUrl) return { kind: "unknown", host: null };

  try {
    const url = new URL(rawUrl);
    const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    return {
      kind: loopback ? "local" : "remote",
      host: url.host,
    };
  } catch {
    return { kind: "invalid", host: null };
  }
}

export function logStudySettingsDiagnostic({
  operation,
  error,
  returnedNull,
  authenticatedUserPresent,
}: {
  operation: string;
  error: DatabaseError | null;
  returnedNull: boolean;
  authenticatedUserPresent: boolean;
}) {
  if (process.env.NODE_ENV === "production") return;

  const payload = {
    operation,
    target: getSupabaseTarget(),
    authenticatedUserPresent,
    returnedNull,
    error: error
      ? {
          code: error.code ?? null,
          message: error.message ?? null,
          details: error.details ?? null,
          hint: error.hint ?? null,
        }
      : null,
  };

  if (error) {
    console.error("Study settings database operation failed", payload);
  } else {
    console.info("Study settings database operation returned no settings", payload);
  }
}
