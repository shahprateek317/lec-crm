// Passwordless client portal auth — hybrid OTP + magic-link delivered in
// one WhatsApp template. See docs/UX_ARCHITECTURE.md §3.
//
// The Indian wellness demographic (clients 30–65) is conditioned by years
// of UPI/Aadhaar/banking to expect a 6-digit code. Magic links are faster
// but less familiar; some WhatsApp preview crawlers also consume single-use
// tokens before a human can tap. We ship both in the same message and let
// the user self-select; consumedVia tells us which path they chose.
//
// Security properties:
//   • Tokens + OTPs are stored as SHA-256 hex hashes — a DB dump never
//     leaks live credentials.
//   • Consume operations are race-safe via the store's atomic
//     "markConsumedIfUnconsumed" primitive (production: conditional
//     UPDATE on consumedAt IS NULL).
//   • OTP attempts are capped at MAX_OTP_ATTEMPTS per challenge — a
//     correct code beyond the cap is still rejected.
//   • Rate-limited to MAGIC_LINK_RATE_LIMIT.count challenges per client
//     per window — burned through requests don't grant infinite OTPs.
//   • Sessions use SHA-256-hashed cookie values too; sliding renewal at
//     >50% TTL elapsed, with explicit revoke + revoke-all-for-client.

import crypto from "node:crypto";

export const MAGIC_LINK_TTL_MIN = 15;
export const CLIENT_SESSION_TTL_DAYS = 30;
export const MAX_OTP_ATTEMPTS = 5;
export const MAGIC_LINK_RATE_LIMIT = { count: 3, windowMin: 60 };

// ── Store interface ──────────────────────────────────────────────────
// The library's only dependency is this typed shape. Production wires
// it to Prisma in a thin adapter (src/lib/client-auth-store.ts). Tests
// use an in-memory fake.

export type ConsumedVia = "OTP" | "LINK";

export type MagicLinkRow = {
  id: string;
  tokenHash: string;
  otpHash: string;
  clientId: string;
  expiresAt: Date;
  consumedAt: Date | null;
  consumedVia: ConsumedVia | null;
  createdAt: Date;
  requestIp: string | null;
  otpAttempts: number;
};

export type SessionRow = {
  tokenHash: string;
  clientId: string;
  expiresAt: Date;
  lastUsedAt: Date;
  createdAt: Date;
  userAgent: string | null;
  revokedAt: Date | null;
};

export type ClientAuthStore = {
  magicLink: {
    create(data: {
      tokenHash: string;
      otpHash: string;
      clientId: string;
      expiresAt: Date;
      requestIp?: string | null;
    }): Promise<{ id: string }>;
    findByTokenHash(hash: string): Promise<MagicLinkRow | null>;
    /** Most-recent UNCONSUMED challenge for this client (for OTP lookups). */
    findLatestUnconsumedForClient(clientId: string): Promise<MagicLinkRow | null>;
    /** Atomic: sets consumedAt+consumedVia only if currently NULL. Returns true on success. */
    markConsumedIfUnconsumed(id: string, when: Date, via: ConsumedVia): Promise<boolean>;
    /** Returns the new attempts count after increment. */
    incrementOtpAttempts(id: string): Promise<number>;
    /** For rate-limiting: how many challenges created in the window. */
    countRecent(clientId: string, since: Date): Promise<number>;
  };
  session: {
    create(data: {
      tokenHash: string;
      clientId: string;
      expiresAt: Date;
      userAgent?: string | null;
    }): Promise<void>;
    findByTokenHash(hash: string): Promise<SessionRow | null>;
    touch(hash: string, when: Date, newExpiry?: Date): Promise<void>;
    revoke(hash: string): Promise<void>;
    revokeAllForClient(clientId: string): Promise<number>;
  };
};

// ── Internals ────────────────────────────────────────────────────────

/** 24-byte (192-bit) base64url token → 32 chars. Used for both magic
 *  links and session cookies. Unguessable, URL-safe, no padding. */
function newToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/** Cryptographically uniform 6-digit OTP. Math.random would be biased
 *  (modulo). crypto.randomInt is unbiased. */
function newOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Single-shot SHA-256 hex. Exported for tests + the store adapter so
 *  both can hash deterministically. Constant-time compare lives in
 *  `hashesEqual` below. */
export function hashToken(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext, "utf8").digest("hex");
}

/** Constant-time hash compare. Both inputs must be hex of the same
 *  length (SHA-256 → 64 chars). */
function hashesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// ── Public API ───────────────────────────────────────────────────────

export type GenerateResult =
  | { ok: true; token: string; otp: string; expiresAt: Date }
  | { ok: false; error: "rate_limited" };

/** Issue a fresh challenge for `clientId`. Returns plaintext token + OTP
 *  for delivery via WhatsApp; persists hashes only. */
export async function generateChallenge(
  store: ClientAuthStore,
  clientId: string,
  opts: { ip?: string } = {},
): Promise<GenerateResult> {
  const windowStart = new Date(Date.now() - MAGIC_LINK_RATE_LIMIT.windowMin * 60_000);
  const recent = await store.magicLink.countRecent(clientId, windowStart);
  if (recent >= MAGIC_LINK_RATE_LIMIT.count) {
    return { ok: false, error: "rate_limited" };
  }

  const token = newToken();
  const otp = newOtp();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MIN * 60_000);

  await store.magicLink.create({
    tokenHash: hashToken(token),
    otpHash: hashToken(otp),
    clientId,
    expiresAt,
    requestIp: opts.ip ?? null,
  });

  return { ok: true, token, otp, expiresAt };
}

export type ConsumeResult =
  | { ok: true; clientId: string }
  | { ok: false; error: "not_found" | "expired" | "already_consumed" | "no_challenge" | "wrong" | "locked" };

/** Validate + consume a magic-link token. Idempotent rejection on second use. */
export async function consumeMagicLink(
  store: ClientAuthStore,
  token: string,
): Promise<ConsumeResult> {
  if (!token || token.length < 16) return { ok: false, error: "not_found" };

  const row = await store.magicLink.findByTokenHash(hashToken(token));
  if (!row) return { ok: false, error: "not_found" };
  if (row.consumedAt) return { ok: false, error: "already_consumed" };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, error: "expired" };

  const claimed = await store.magicLink.markConsumedIfUnconsumed(row.id, new Date(), "LINK");
  if (!claimed) return { ok: false, error: "already_consumed" };

  return { ok: true, clientId: row.clientId };
}

/** Validate + consume a 6-digit OTP for a given client. Increments
 *  attempts on a miss; locks the challenge after MAX_OTP_ATTEMPTS. */
export async function consumeOtp(
  store: ClientAuthStore,
  clientId: string,
  otp: string,
): Promise<ConsumeResult> {
  // Look up the freshest unconsumed challenge.
  const row = await store.magicLink.findLatestUnconsumedForClient(clientId);
  if (!row) return { ok: false, error: "no_challenge" };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, error: "expired" };
  if (row.otpAttempts >= MAX_OTP_ATTEMPTS) return { ok: false, error: "locked" };

  if (!hashesEqual(row.otpHash, hashToken(otp))) {
    const next = await store.magicLink.incrementOtpAttempts(row.id);
    return { ok: false, error: next >= MAX_OTP_ATTEMPTS ? "locked" : "wrong" };
  }

  const claimed = await store.magicLink.markConsumedIfUnconsumed(row.id, new Date(), "OTP");
  if (!claimed) return { ok: false, error: "already_consumed" };

  return { ok: true, clientId: row.clientId };
}

// ── Sessions ─────────────────────────────────────────────────────────

export type CreateSessionResult = { token: string; expiresAt: Date };

/** Mint a session cookie value + persist the hashed form. */
export async function createClientSession(
  store: ClientAuthStore,
  clientId: string,
  opts: { userAgent?: string } = {},
): Promise<CreateSessionResult> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + CLIENT_SESSION_TTL_DAYS * 24 * 60 * 60_000);
  await store.session.create({
    tokenHash: hashToken(token),
    clientId,
    expiresAt,
    userAgent: opts.userAgent ?? null,
  });
  return { token, expiresAt };
}

/** Returns { clientId } iff the session is valid and live. Updates
 *  lastUsedAt; slides expiry forward when more than half the TTL has
 *  elapsed since issue. */
export async function validateClientSession(
  store: ClientAuthStore,
  token: string,
): Promise<{ clientId: string } | null> {
  if (!token) return null;
  const hash = hashToken(token);
  const row = await store.session.findByTokenHash(hash);
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;

  const now = new Date();
  // Sliding renewal: if more than half the TTL has elapsed since the
  // session was created, push expiry to TTL-from-now.
  const ttlMs = CLIENT_SESSION_TTL_DAYS * 24 * 60 * 60_000;
  const elapsedMs = now.getTime() - row.createdAt.getTime();
  const newExpiry = elapsedMs > ttlMs / 2
    ? new Date(now.getTime() + ttlMs)
    : undefined;
  await store.session.touch(hash, now, newExpiry);

  return { clientId: row.clientId };
}

export async function revokeClientSession(store: ClientAuthStore, token: string): Promise<void> {
  if (!token) return;
  await store.session.revoke(hashToken(token));
}

export async function revokeAllSessionsForClient(store: ClientAuthStore, clientId: string): Promise<number> {
  return store.session.revokeAllForClient(clientId);
}
