// Tests for the passwordless client portal auth library.
//
// Public API takes RAW tokens/OTPs (what the user pastes from WhatsApp);
// the library hashes before persisting + on every lookup. The store
// interface only ever sees hashes — even our fake test store cannot leak
// plaintext. Constant-time compare is used by the underlying crypto.
//
// What's covered:
//   - generateChallenge: token shape, OTP shape, TTL, rate limit per client
//   - consumeMagicLink: happy / not-found / expired / already-consumed / race
//   - consumeOtp: happy / wrong / lockout after 5 attempts / expired / unknown
//   - createClientSession + validateClientSession: happy / expired / sliding
//   - revokeClientSession / revokeAllSessionsForClient

import { describe, it, expect, beforeEach } from "vitest";
import {
  generateChallenge,
  consumeMagicLink,
  consumeOtp,
  createClientSession,
  validateClientSession,
  revokeClientSession,
  revokeAllSessionsForClient,
  hashToken,
  MAGIC_LINK_TTL_MIN,
  CLIENT_SESSION_TTL_DAYS,
  MAGIC_LINK_RATE_LIMIT,
  MAX_OTP_ATTEMPTS,
  type ClientAuthStore,
  type MagicLinkRow,
  type SessionRow,
} from "./client-auth";

type Fake = ClientAuthStore & {
  _links: MagicLinkRow[];
  _sessions: SessionRow[];
};

function makeStore(): Fake {
  const links: MagicLinkRow[] = [];
  const sessions: SessionRow[] = [];
  let nextId = 1;

  return {
    _links: links,
    _sessions: sessions,
    magicLink: {
      async create(data) {
        const id = `link_${nextId++}`;
        links.push({
          id,
          tokenHash: data.tokenHash,
          otpHash: data.otpHash,
          clientId: data.clientId,
          expiresAt: data.expiresAt,
          consumedAt: null,
          consumedVia: null,
          createdAt: new Date(),
          requestIp: data.requestIp ?? null,
          otpAttempts: 0,
        });
        return { id };
      },
      async findByTokenHash(hash) {
        return links.find((l) => l.tokenHash === hash) ?? null;
      },
      async findLatestUnconsumedForClient(clientId) {
        const unconsumed = links
          .filter((l) => l.clientId === clientId && l.consumedAt === null)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return unconsumed[0] ?? null;
      },
      async markConsumedIfUnconsumed(id, when, via) {
        const row = links.find((l) => l.id === id);
        if (!row || row.consumedAt !== null) return false;
        row.consumedAt = when;
        row.consumedVia = via;
        return true;
      },
      async incrementOtpAttempts(id) {
        const row = links.find((l) => l.id === id);
        if (!row) return 0;
        row.otpAttempts += 1;
        return row.otpAttempts;
      },
      async countRecent(clientId, since) {
        return links.filter((l) => l.clientId === clientId && l.createdAt >= since).length;
      },
    },
    session: {
      async create(data) {
        sessions.push({
          tokenHash: data.tokenHash,
          clientId: data.clientId,
          expiresAt: data.expiresAt,
          lastUsedAt: new Date(),
          createdAt: new Date(),
          userAgent: data.userAgent ?? null,
          revokedAt: null,
        });
      },
      async findByTokenHash(hash) {
        return sessions.find((s) => s.tokenHash === hash) ?? null;
      },
      async touch(hash, when, newExpiry) {
        const row = sessions.find((s) => s.tokenHash === hash);
        if (!row) return;
        row.lastUsedAt = when;
        if (newExpiry) row.expiresAt = newExpiry;
      },
      async revoke(hash) {
        const row = sessions.find((s) => s.tokenHash === hash);
        if (row && !row.revokedAt) row.revokedAt = new Date();
      },
      async revokeAllForClient(clientId) {
        let n = 0;
        for (const s of sessions) {
          if (s.clientId === clientId && !s.revokedAt) {
            s.revokedAt = new Date();
            n++;
          }
        }
        return n;
      },
    },
  };
}

// ──────────────────────────────────────────────────────────────────
describe("generateChallenge", () => {
  let store: Fake;
  beforeEach(() => { store = makeStore(); });

  it("returns a 32-char base64url token AND a 6-digit OTP", async () => {
    const r = await generateChallenge(store, "client_abc");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(r.otp).toMatch(/^\d{6}$/);
  });

  it("TTL is MAGIC_LINK_TTL_MIN minutes", async () => {
    const before = Date.now();
    const r = await generateChallenge(store, "c");
    if (!r.ok) throw new Error("setup");
    const ttl = r.expiresAt.getTime() - before;
    expect(ttl).toBeGreaterThan((MAGIC_LINK_TTL_MIN - 1) * 60_000);
    expect(ttl).toBeLessThanOrEqual(MAGIC_LINK_TTL_MIN * 60_000 + 500);
  });

  it("persists hashed tokenHash + otpHash, never plaintext", async () => {
    const r = await generateChallenge(store, "c");
    if (!r.ok) throw new Error("setup");
    const row = store._links[0];
    expect(row.tokenHash).toBe(hashToken(r.token));
    expect(row.otpHash).toBe(hashToken(r.otp));
    // Neither field should contain the plaintext.
    expect(row.tokenHash).not.toBe(r.token);
    expect(row.otpHash).not.toBe(r.otp);
  });

  it("rate-limits after MAGIC_LINK_RATE_LIMIT.count per window", async () => {
    for (let i = 0; i < MAGIC_LINK_RATE_LIMIT.count; i++) {
      const ok = await generateChallenge(store, "c");
      expect(ok.ok).toBe(true);
    }
    const blocked = await generateChallenge(store, "c");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toBe("rate_limited");
  });

  it("rate limit is per-client, not global", async () => {
    for (let i = 0; i < MAGIC_LINK_RATE_LIMIT.count; i++) {
      await generateChallenge(store, "a");
    }
    const other = await generateChallenge(store, "b");
    expect(other.ok).toBe(true);
  });

  it("each call returns a unique token AND a unique OTP (collisions only by chance)", async () => {
    const a = await generateChallenge(store, "c");
    const b = await generateChallenge(store, "c");
    if (!a.ok || !b.ok) throw new Error("setup");
    expect(a.token).not.toBe(b.token);
    // 6-digit OTPs collide ~1/1M; not asserted strictly, but token-uniqueness gates this for testing.
  });

  it("records the requestIp when supplied", async () => {
    await generateChallenge(store, "c", { ip: "203.0.113.7" });
    expect(store._links[0].requestIp).toBe("203.0.113.7");
  });
});

// ──────────────────────────────────────────────────────────────────
describe("consumeMagicLink", () => {
  let store: Fake;
  beforeEach(() => { store = makeStore(); });

  it("returns clientId for a valid token + marks consumed via LINK", async () => {
    const r = await generateChallenge(store, "client_abc");
    if (!r.ok) throw new Error("setup");
    const c = await consumeMagicLink(store, r.token);
    expect(c.ok).toBe(true);
    if (c.ok) expect(c.clientId).toBe("client_abc");
    expect(store._links[0].consumedAt).not.toBeNull();
    expect(store._links[0].consumedVia).toBe("LINK");
  });

  it("rejects an unknown token", async () => {
    const c = await consumeMagicLink(store, "bogus_token_value_padded_long_enough_to_pass_format_check");
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.error).toBe("not_found");
  });

  it("rejects an already-consumed token (idempotent)", async () => {
    const r = await generateChallenge(store, "c");
    if (!r.ok) throw new Error("setup");
    await consumeMagicLink(store, r.token);
    const second = await consumeMagicLink(store, r.token);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe("already_consumed");
  });

  it("rejects an expired token", async () => {
    const r = await generateChallenge(store, "c");
    if (!r.ok) throw new Error("setup");
    store._links[0].expiresAt = new Date(Date.now() - 1000);
    const c = await consumeMagicLink(store, r.token);
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.error).toBe("expired");
  });

  it("is race-safe: concurrent consumes — only one wins", async () => {
    const r = await generateChallenge(store, "c");
    if (!r.ok) throw new Error("setup");
    const [a, b] = await Promise.all([
      consumeMagicLink(store, r.token),
      consumeMagicLink(store, r.token),
    ]);
    const oks = [a, b].filter((x) => x.ok);
    const fails = [a, b].filter((x) => !x.ok);
    expect(oks).toHaveLength(1);
    expect(fails).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────
describe("consumeOtp", () => {
  let store: Fake;
  beforeEach(() => { store = makeStore(); });

  it("returns clientId for a valid 6-digit OTP + marks consumed via OTP", async () => {
    const r = await generateChallenge(store, "client_abc");
    if (!r.ok) throw new Error("setup");
    const c = await consumeOtp(store, "client_abc", r.otp);
    expect(c.ok).toBe(true);
    if (c.ok) expect(c.clientId).toBe("client_abc");
    expect(store._links[0].consumedVia).toBe("OTP");
  });

  it("rejects when no challenge has been issued for the client", async () => {
    const c = await consumeOtp(store, "stranger", "123456");
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.error).toBe("no_challenge");
  });

  it("rejects a wrong OTP and increments attempts", async () => {
    const r = await generateChallenge(store, "c");
    if (!r.ok) throw new Error("setup");
    const c = await consumeOtp(store, "c", "000000");
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.error).toBe("wrong");
    expect(store._links[0].otpAttempts).toBe(1);
    expect(store._links[0].consumedAt).toBeNull(); // not consumed
  });

  it("locks out after MAX_OTP_ATTEMPTS wrong attempts", async () => {
    const r = await generateChallenge(store, "c");
    if (!r.ok) throw new Error("setup");
    for (let i = 0; i < MAX_OTP_ATTEMPTS; i++) {
      await consumeOtp(store, "c", "000000");
    }
    // Even the correct OTP shouldn't unlock once we're past the cap.
    const c = await consumeOtp(store, "c", r.otp);
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.error).toBe("locked");
  });

  it("rejects when the challenge is expired", async () => {
    const r = await generateChallenge(store, "c");
    if (!r.ok) throw new Error("setup");
    store._links[0].expiresAt = new Date(Date.now() - 1000);
    const c = await consumeOtp(store, "c", r.otp);
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.error).toBe("expired");
  });

  it("rejects when the challenge has already been consumed", async () => {
    const r = await generateChallenge(store, "c");
    if (!r.ok) throw new Error("setup");
    await consumeMagicLink(store, r.token);
    const c = await consumeOtp(store, "c", r.otp);
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.error).toBe("no_challenge"); // no UNCONSUMED challenge
  });
});

// ──────────────────────────────────────────────────────────────────
describe("createClientSession + validateClientSession", () => {
  let store: Fake;
  beforeEach(() => { store = makeStore(); });

  it("creates a 32-char base64url session token with a 30-day expiry", async () => {
    const before = Date.now();
    const s = await createClientSession(store, "client_abc", { userAgent: "iPhone" });
    expect(s.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const ttlMs = s.expiresAt.getTime() - before;
    expect(ttlMs).toBeGreaterThan((CLIENT_SESSION_TTL_DAYS - 1) * 24 * 60 * 60_000);
    expect(ttlMs).toBeLessThanOrEqual(CLIENT_SESSION_TTL_DAYS * 24 * 60 * 60_000 + 500);
    // Persisted as hash, not plaintext.
    expect(store._sessions[0].tokenHash).toBe(hashToken(s.token));
    expect(store._sessions[0].tokenHash).not.toBe(s.token);
  });

  it("returns clientId for a valid session", async () => {
    const s = await createClientSession(store, "client_abc");
    const v = await validateClientSession(store, s.token);
    expect(v).toEqual({ clientId: "client_abc" });
  });

  it("returns null for an unknown token", async () => {
    expect(await validateClientSession(store, "bogus")).toBeNull();
  });

  it("rejects an expired session", async () => {
    const s = await createClientSession(store, "c");
    store._sessions[0].expiresAt = new Date(Date.now() - 1000);
    expect(await validateClientSession(store, s.token)).toBeNull();
  });

  it("rejects a revoked session", async () => {
    const s = await createClientSession(store, "c");
    store._sessions[0].revokedAt = new Date();
    expect(await validateClientSession(store, s.token)).toBeNull();
  });

  it("sliding renewal: extends expiry when >50% of TTL has elapsed", async () => {
    const s = await createClientSession(store, "c");
    const originalExpiry = store._sessions[0].expiresAt.getTime();
    // Backdate lastUsedAt + createdAt so we're past the half-life.
    const halfTtlMs = (CLIENT_SESSION_TTL_DAYS / 2) * 24 * 60 * 60_000;
    store._sessions[0].createdAt = new Date(Date.now() - halfTtlMs - 1000);
    store._sessions[0].lastUsedAt = new Date(Date.now() - halfTtlMs - 1000);
    // Allow the wall clock to tick so the new "now" inside validate is
    // strictly later than the create. Without this, both Date.now() calls
    // can land on the same ms and the renewal arithmetic yields an equal
    // (not greater) expiry.
    await new Promise((r) => setTimeout(r, 5));
    await validateClientSession(store, s.token);
    expect(store._sessions[0].expiresAt.getTime()).toBeGreaterThan(originalExpiry);
  });

  it("sliding renewal: does NOT extend within the first half of TTL", async () => {
    const s = await createClientSession(store, "c");
    const originalExpiry = store._sessions[0].expiresAt.getTime();
    await validateClientSession(store, s.token);
    expect(store._sessions[0].expiresAt.getTime()).toBe(originalExpiry);
  });

  it("always updates lastUsedAt on a valid call", async () => {
    const s = await createClientSession(store, "c");
    const original = store._sessions[0].lastUsedAt.getTime();
    await new Promise((r) => setTimeout(r, 5));
    await validateClientSession(store, s.token);
    expect(store._sessions[0].lastUsedAt.getTime()).toBeGreaterThan(original);
  });
});

// ──────────────────────────────────────────────────────────────────
describe("revoke", () => {
  let store: Fake;
  beforeEach(() => { store = makeStore(); });

  it("revokeClientSession invalidates the session", async () => {
    const s = await createClientSession(store, "c");
    await revokeClientSession(store, s.token);
    expect(await validateClientSession(store, s.token)).toBeNull();
  });

  it("revokeAllSessionsForClient kills every active session", async () => {
    const a = await createClientSession(store, "c");
    const b = await createClientSession(store, "c");
    const other = await createClientSession(store, "different_client");
    const n = await revokeAllSessionsForClient(store, "c");
    expect(n).toBe(2);
    expect(await validateClientSession(store, a.token)).toBeNull();
    expect(await validateClientSession(store, b.token)).toBeNull();
    // Other client's session unaffected.
    expect(await validateClientSession(store, other.token)).not.toBeNull();
  });
});
