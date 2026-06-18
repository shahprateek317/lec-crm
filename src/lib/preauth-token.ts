// Short-lived HMAC-signed token issued after password verification succeeds
// but before TOTP is verified. Lets the TOTP step skip the password re-entry.
//
// Token format: base64url(email:expiresAtMs) + "." + hmac(sha256, AUTH_SECRET:preauth)
// Delivered via HttpOnly cookie, 5-minute TTL.

import crypto from "node:crypto";
import { env } from "@/lib/env";

const TTL_MS = 5 * 60 * 1000;

function hmacKey(): Buffer {
  return crypto.createHash("sha256").update(env.AUTH_SECRET + ":preauth").digest();
}

export const PREAUTH_COOKIE = "lec-preauth";

export function generatePreauthToken(email: string): string {
  const expiresAt = Date.now() + TTL_MS;
  const payload = Buffer.from(`${email}:${expiresAt}`).toString("base64url");
  const sig = crypto.createHmac("sha256", hmacKey()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export type PreauthResult =
  | { ok: true; email: string }
  | { ok: false };

export function verifyPreauthToken(token: string): PreauthResult {
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx < 1) return { ok: false };

  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  const expected = crypto.createHmac("sha256", hmacKey()).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false };
  }

  try {
    const raw = Buffer.from(payload, "base64url").toString("utf8");
    const colonIdx = raw.lastIndexOf(":");
    const email = raw.slice(0, colonIdx);
    const expiresAt = Number(raw.slice(colonIdx + 1));
    if (!email || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return { ok: false };
    }
    return { ok: true, email };
  } catch {
    return { ok: false };
  }
}
