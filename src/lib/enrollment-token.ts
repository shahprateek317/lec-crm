// Short-lived, stateless HMAC-signed token for the admin TOTP enrollment
// grace path. Used when an ADMIN/SUPER_ADMIN signs in without TOTP configured:
// authorize() blocks the session, the sign-in action issues this token, and
// the /admin-enroll page verifies it to grant access to the enrollment form.
//
// Token format:  base64url(email:expiresAtMs) + "." + hmac(sha256, AUTH_SECRET)
//
// The token is delivered via an HttpOnly cookie (not the URL) so it doesn't
// appear in browser history, server access logs, or Referer headers.
//
// Single-use semantics: after verifyEnrollmentToken() succeeds, the caller must
// check user.totpEnabledAt before proceeding. Once enrollment completes that
// field is set, so subsequent token presentations (even valid ones) bounce off
// the "already enrolled" guard in the action.

import crypto from "node:crypto";
import { env } from "@/lib/env";

const TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

// In-memory rate limiter keyed by hashed token. Entries expire with the token.
// Single-instance Docker server — in-memory is fine. A Redis store would be
// needed for multi-instance deployments.
const attemptStore = new Map<string, { count: number; resetAt: number }>();

function hmacKey(): Buffer {
  return crypto.createHash("sha256").update(env.AUTH_SECRET + ":enroll").digest();
}

function tokenHash(payload: string): string {
  return crypto.createHash("sha256").update(payload).digest("base64url");
}

export function generateEnrollmentToken(email: string): string {
  const expiresAt = Date.now() + TTL_MS;
  const payload = Buffer.from(`${email}:${expiresAt}`).toString("base64url");
  const sig = crypto.createHmac("sha256", hmacKey()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export type TokenResult =
  | { ok: true; email: string }
  | { ok: false; reason: "invalid" | "expired" | "rate_limited" };

export function verifyEnrollmentToken(token: string): TokenResult {
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx < 1) return { ok: false, reason: "invalid" };

  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  // Constant-time HMAC comparison. Lengths must match for timingSafeEqual;
  // SHA-256 base64url is always 43 chars so a length mismatch means the
  // token is structurally invalid — safe to short-circuit before the compare.
  const expected = crypto.createHmac("sha256", hmacKey()).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: "invalid" };
  }

  // Rate limit by hashed payload (not raw token, to avoid storing the secret).
  const key = tokenHash(payload);
  const now = Date.now();
  let entry = attemptStore.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + TTL_MS };
    attemptStore.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return { ok: false, reason: "rate_limited" };
  }

  // Decode and validate.
  let email: string;
  let expiresAt: number;
  try {
    const raw = Buffer.from(payload, "base64url").toString("utf8");
    const colonIdx = raw.lastIndexOf(":");
    email = raw.slice(0, colonIdx);
    expiresAt = Number(raw.slice(colonIdx + 1));
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (!email || !Number.isFinite(expiresAt) || expiresAt <= now) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, email };
}

export const ENROLLMENT_COOKIE = "lec-admin-enroll";
