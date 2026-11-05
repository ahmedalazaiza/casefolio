const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const QUERY_SECRET_PATTERN = /([?&](?:token|exportToken|signature|secret|code|otp)=)[^&\s]+/gi;
const PADDLE_KEY_PATTERN =
  /\b(?:pdl_(?:sdbx|live)_apikey_[A-Za-z0-9_]+|pdl_ntfset_[A-Za-z0-9_]+)\b/g;
const RESEND_KEY_PATTERN = /\bre_[A-Za-z0-9_]{12,}\b/g;

export function redactSensitiveText(input: string): string {
  return input
    .replace(BEARER_TOKEN_PATTERN, "Bearer [REDACTED]")
    .replace(QUERY_SECRET_PATTERN, "$1[REDACTED]")
    .replace(PADDLE_KEY_PATTERN, "[REDACTED_PADDLE_KEY]")
    .replace(RESEND_KEY_PATTERN, "[REDACTED_API_KEY]")
    .replace(EMAIL_PATTERN, "[REDACTED_EMAIL]");
}

export function sanitizeErrorForLogging(err: unknown): {
  name: string;
  message: string;
} {
  if (err instanceof Error) {
    return {
      name: err.name || "Error",
      message: redactSensitiveText(err.message),
    };
  }
  if (typeof err === "string") {
    return {
      name: "Error",
      message: redactSensitiveText(err),
    };
  }
  return {
    name: "UnknownError",
    message: "An unexpected internal error occurred.",
  };
}

export function sanitizeHeaderFilename(rawFilename: string, fallback = "download"): string {
  const cleaned = rawFilename
    .replace(/[\r\n"]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : fallback;
}
