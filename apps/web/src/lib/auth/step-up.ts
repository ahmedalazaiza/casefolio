import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "@casefolio/db";
import { auth } from "@/lib/auth/server";
import { db, dbSchema } from "@/lib/db";
import { sendStepUpCodeEmail } from "@/lib/email";
import { sanitizeErrorForLogging } from "@/lib/security/redact";
import { consumeSharedRateLimit } from "@/lib/security/shared-rate-limit";

export const STEP_UP_PURPOSES = ["account_deletion", "ownership_transfer"] as const;
export type StepUpPurpose = (typeof STEP_UP_PURPOSES)[number];

export const MAX_STEP_UP_SESSION_AGE_MS = 24 * 60 * 60 * 1000;
const STEP_UP_OTP_TTL_MS = 10 * 60 * 1000;
const STEP_UP_TOKEN_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

export type StepUpErrorCode =
  | "UNAUTHORIZED"
  | "SESSION_TOO_OLD"
  | "RATE_LIMITED"
  | "INVALID_CREDENTIALS"
  | "NO_PASSWORD_ACCOUNT"
  | "INVALID_OR_EXPIRED_OTP"
  | "STEP_UP_REQUIRED"
  | "DELIVERY_FAILED";

export type StepUpVerificationResult =
  | {
      ok: true;
      stepUpToken: string;
      expiresAtIso: string;
    }
  | {
      ok: false;
      status: 400 | 401 | 403 | 429 | 502;
      code: StepUpErrorCode;
      error: string;
      retryAfterSeconds?: number;
    };

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function otpIdentifier(purpose: StepUpPurpose, userId: string): string {
  return `step_up_otp:${purpose}:${userId}`;
}

function tokenIdentifier(purpose: StepUpPurpose, userId: string): string {
  return `step_up_token:${purpose}:${userId}`;
}

function constantTimeHexEqual(aHex: string, bHex: string): boolean {
  if (aHex.length !== bHex.length) {
    return false;
  }
  const aBuf = Buffer.from(aHex, "utf8");
  const bBuf = Buffer.from(bHex, "utf8");
  return timingSafeEqual(aBuf, bBuf);
}

async function assertValidActiveSessionForStepUp(args: {
  userId: string;
  sessionId: string;
  now?: Date;
}): Promise<
  | { ok: true; createdAt: Date }
  | { ok: false; status: 401; code: "UNAUTHORIZED"; error: string }
> {
  const now = args.now ?? new Date();
  const [sessionRow] = await db
    .select({
      userId: dbSchema.sessions.userId,
      createdAt: dbSchema.sessions.createdAt,
      expiresAt: dbSchema.sessions.expiresAt,
    })
    .from(dbSchema.sessions)
    .where(eq(dbSchema.sessions.id, args.sessionId))
    .limit(1);

  if (
    !sessionRow ||
    sessionRow.userId !== args.userId ||
    sessionRow.expiresAt.getTime() <= now.getTime()
  ) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      error: "Authentication required.",
    };
  }

  return { ok: true, createdAt: sessionRow.createdAt };
}

/**
 * Enforces session freshness strictly from `sessions.createdAt` (never `updatedAt`).
 */
export async function assertFreshSessionForStepUp(args: {
  userId: string;
  sessionId: string;
  now?: Date;
}): Promise<
  | { ok: true }
  | { ok: false; status: 401 | 403; code: "UNAUTHORIZED" | "SESSION_TOO_OLD"; error: string }
> {
  const now = args.now ?? new Date();
  const active = await assertValidActiveSessionForStepUp({
    userId: args.userId,
    sessionId: args.sessionId,
    now,
  });
  if (!active.ok) {
    return active;
  }

  if (now.getTime() - active.createdAt.getTime() > MAX_STEP_UP_SESSION_AGE_MS) {
    return {
      ok: false,
      status: 403,
      code: "SESSION_TOO_OLD",
      error:
        "Your sign-in session is older than 24 hours. Please sign out and sign in again to confirm this sensitive action.",
    };
  }

  return { ok: true };
}

async function issueSingleUseStepUpToken(args: {
  userId: string;
  purpose: StepUpPurpose;
  now: Date;
}): Promise<{ stepUpToken: string; expiresAtIso: string }> {
  const stepUpToken = `cf_su_${randomBytes(24).toString("hex")}`;
  const tokenHash = hashSecret(stepUpToken);
  const expiresAt = new Date(args.now.getTime() + STEP_UP_TOKEN_TTL_MS);
  const identifier = tokenIdentifier(args.purpose, args.userId);

  await db
    .delete(dbSchema.verifications)
    .where(eq(dbSchema.verifications.identifier, identifier));

  await db.insert(dbSchema.verifications).values({
    identifier,
    value: tokenHash,
    expiresAt,
    createdAt: args.now,
    updatedAt: args.now,
  });

  return {
    stepUpToken,
    expiresAtIso: expiresAt.toISOString(),
  };
}

export async function sendStepUpOtp(args: {
  userId: string;
  userEmail: string;
  sessionId: string;
  purpose: StepUpPurpose;
  now?: Date;
}): Promise<
  | { ok: true; expiresAtIso: string }
  | {
      ok: false;
      status: 401 | 403 | 429 | 502;
      code: StepUpErrorCode;
      error: string;
      retryAfterSeconds?: number;
    }
> {
  const now = args.now ?? new Date();
  const active = await assertValidActiveSessionForStepUp({
    userId: args.userId,
    sessionId: args.sessionId,
    now,
  });
  if (!active.ok) {
    return active;
  }

  const rate = await consumeSharedRateLimit({
    key: `step-up-send:${args.userId}`,
    limit: 3,
    windowMs: 60_000,
    now,
  });
  if (!rate.allowed) {
    return {
      ok: false,
      status: 429,
      code: "RATE_LIMITED",
      error: `Please wait ${rate.retryAfterSeconds}s before requesting another confirmation code.`,
      retryAfterSeconds: rate.retryAfterSeconds,
    };
  }

  const otp = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const otpHash = hashSecret(otp);
  const expiresAt = new Date(now.getTime() + STEP_UP_OTP_TTL_MS);
  const identifier = otpIdentifier(args.purpose, args.userId);

  await db
    .delete(dbSchema.verifications)
    .where(eq(dbSchema.verifications.identifier, identifier));

  await db.insert(dbSchema.verifications).values({
    identifier,
    value: `${otpHash}:0`,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  try {
    const sent = await sendStepUpCodeEmail({
      to: args.userEmail,
      otp,
      purpose: args.purpose,
    });
    if (process.env.VERCEL_ENV === "production" && !sent.delivered) {
      return {
        ok: false,
        status: 502,
        code: "DELIVERY_FAILED",
        error: "Could not deliver confirmation code right now. Please try again shortly.",
      };
    }
  } catch (err) {
    const safe = sanitizeErrorForLogging(err);
    console.warn("[step-up] confirmation code delivery error:", safe.message);
    return {
      ok: false,
      status: 502,
      code: "DELIVERY_FAILED",
      error: "Could not deliver confirmation code right now. Please try again shortly.",
    };
  }

  return {
    ok: true,
    expiresAtIso: expiresAt.toISOString(),
  };
}

export async function verifyStepUpWithPassword(args: {
  userId: string;
  sessionId: string;
  purpose: StepUpPurpose;
  password: string;
  now?: Date;
}): Promise<StepUpVerificationResult> {
  const now = args.now ?? new Date();
  const fresh = await assertFreshSessionForStepUp({
    userId: args.userId,
    sessionId: args.sessionId,
    now,
  });
  if (!fresh.ok) {
    return fresh;
  }

  const rate = await consumeSharedRateLimit({
    key: `step-up-verify:${args.userId}`,
    limit: 6,
    windowMs: 60_000,
    now,
  });
  if (!rate.allowed) {
    return {
      ok: false,
      status: 429,
      code: "RATE_LIMITED",
      error: `Too many verification attempts. Please wait ${rate.retryAfterSeconds}s.`,
      retryAfterSeconds: rate.retryAfterSeconds,
    };
  }

  const accountRows = await db
    .select({
      providerId: dbSchema.accounts.providerId,
      password: dbSchema.accounts.password,
    })
    .from(dbSchema.accounts)
    .where(eq(dbSchema.accounts.userId, args.userId));

  const credential = accountRows.find(
    (row) => row.providerId === "credential" || Boolean(row.password),
  );
  if (!credential?.password) {
    return {
      ok: false,
      status: 400,
      code: "NO_PASSWORD_ACCOUNT",
      error: "This account signs in without a password. Request a 6-digit email code instead.",
    };
  }

  const authCtx = await auth.$context;
  const verified = await authCtx.password.verify({
    hash: credential.password,
    password: args.password,
  });

  if (!verified) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_CREDENTIALS",
      error: "Incorrect password. Please try again.",
    };
  }

  const issued = await issueSingleUseStepUpToken({
    userId: args.userId,
    purpose: args.purpose,
    now,
  });

  return {
    ok: true,
    ...issued,
  };
}

export async function verifyStepUpWithOtp(args: {
  userId: string;
  sessionId: string;
  purpose: StepUpPurpose;
  otp: string;
  now?: Date;
}): Promise<StepUpVerificationResult> {
  const now = args.now ?? new Date();
  const active = await assertValidActiveSessionForStepUp({
    userId: args.userId,
    sessionId: args.sessionId,
    now,
  });
  if (!active.ok) {
    return active;
  }

  const rate = await consumeSharedRateLimit({
    key: `step-up-verify:${args.userId}`,
    limit: 6,
    windowMs: 60_000,
    now,
  });
  if (!rate.allowed) {
    return {
      ok: false,
      status: 429,
      code: "RATE_LIMITED",
      error: `Too many verification attempts. Please wait ${rate.retryAfterSeconds}s.`,
      retryAfterSeconds: rate.retryAfterSeconds,
    };
  }

  const cleanOtp = args.otp.trim();
  if (!/^\d{6}$/.test(cleanOtp)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_OR_EXPIRED_OTP",
      error: "Enter the 6-digit security confirmation code.",
    };
  }

  const identifier = otpIdentifier(args.purpose, args.userId);
  const [row] = await db
    .select()
    .from(dbSchema.verifications)
    .where(
      and(
        eq(dbSchema.verifications.identifier, identifier),
        gt(dbSchema.verifications.expiresAt, now),
      ),
    )
    .limit(1);

  if (!row) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_OR_EXPIRED_OTP",
      error: "Confirmation code expired or not found. Request a new 6-digit code.",
    };
  }

  const [storedHash = "", attemptsStr = "0"] = row.value.split(":");
  const attempts = Number.parseInt(attemptsStr, 10) || 0;
  const candidateHash = hashSecret(cleanOtp);

  if (!constantTimeHexEqual(storedHash, candidateHash)) {
    const nextAttempts = attempts + 1;
    if (nextAttempts >= MAX_OTP_ATTEMPTS) {
      await db.delete(dbSchema.verifications).where(eq(dbSchema.verifications.id, row.id));
    } else {
      await db
        .update(dbSchema.verifications)
        .set({ value: `${storedHash}:${nextAttempts}`, updatedAt: now })
        .where(eq(dbSchema.verifications.id, row.id));
    }
    return {
      ok: false,
      status: 401,
      code: "INVALID_OR_EXPIRED_OTP",
      error: "Invalid confirmation code. Please check the 6-digit code and try again.",
    };
  }

  const consumed = await db
    .delete(dbSchema.verifications)
    .where(
      and(
        eq(dbSchema.verifications.id, row.id),
        gt(dbSchema.verifications.expiresAt, now),
      ),
    )
    .returning({ id: dbSchema.verifications.id });

  if (consumed.length === 0) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_OR_EXPIRED_OTP",
      error: "Confirmation code was already used or expired.",
    };
  }

  const issued = await issueSingleUseStepUpToken({
    userId: args.userId,
    purpose: args.purpose,
    now,
  });

  return {
    ok: true,
    ...issued,
  };
}

export async function consumeStepUpToken(args: {
  userId: string;
  sessionId: string;
  purpose: StepUpPurpose;
  stepUpToken: string;
  now?: Date;
}): Promise<
  | { ok: true }
  | { ok: false; status: 400 | 401 | 403; code: StepUpErrorCode; error: string }
> {
  const now = args.now ?? new Date();
  const cleanToken = args.stepUpToken.trim();
  if (!cleanToken.startsWith("cf_su_") || cleanToken.length < 20) {
    return {
      ok: false,
      status: 400,
      code: "STEP_UP_REQUIRED",
      error: "Identity confirmation is required before completing this action.",
    };
  }

  const fresh = await assertFreshSessionForStepUp({
    userId: args.userId,
    sessionId: args.sessionId,
    now,
  });
  if (!fresh.ok) {
    return fresh;
  }

  const identifier = tokenIdentifier(args.purpose, args.userId);
  const expectedHash = hashSecret(cleanToken);

  const deleted = await db
    .delete(dbSchema.verifications)
    .where(
      and(
        eq(dbSchema.verifications.identifier, identifier),
        eq(dbSchema.verifications.value, expectedHash),
        gt(dbSchema.verifications.expiresAt, now),
      ),
    )
    .returning({ id: dbSchema.verifications.id });

  if (deleted.length === 0) {
    return {
      ok: false,
      status: 403,
      code: "STEP_UP_REQUIRED",
      error: "Your security confirmation expired or was already used. Please confirm again.",
    };
  }

  return { ok: true };
}
