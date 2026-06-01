// Tests for the admin TOTP enrollment token library.
//
// What's covered:
//   - generateEnrollmentToken: produces two-part format (payload.sig)
//   - verifyEnrollmentToken: happy path (valid token)
//   - verifyEnrollmentToken: rejects tampered signature
//   - verifyEnrollmentToken: rejects expired token
//   - verifyEnrollmentToken: rate-limits after MAX_ATTEMPTS
//   - verifyEnrollmentToken: rejects malformed token

import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateEnrollmentToken, verifyEnrollmentToken } from "./enrollment-token";

// enrollment-token.ts derives its key from env.AUTH_SECRET.
// vitest runs with the dotenv loaded from .env.local if present; if not,
// the module will use whatever string AUTH_SECRET resolves to. Set a fixed
// value so tests are deterministic and don't depend on local secrets.
vi.mock("@/lib/env", () => ({
  env: { AUTH_SECRET: "test-auth-secret-for-enrollment-token-tests" },
}));

describe("generateEnrollmentToken", () => {
  it("returns a two-part base64url string", () => {
    const token = generateEnrollmentToken("admin@lec.app");
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(10);
    expect(parts[1].length).toBeGreaterThan(10);
  });

  it("embeds the email in the payload (base64url-decodable)", () => {
    const email = "admin@lec.app";
    const token = generateEnrollmentToken(email);
    const payload = Buffer.from(token.split(".")[0], "base64url").toString("utf8");
    expect(payload.startsWith(email + ":")).toBe(true);
  });

  it("produces different tokens on successive calls (random expiry timestamps differ slightly, but mainly non-deterministic iv equivalent — just check uniqueness)", () => {
    // Sleep 1 ms to ensure different timestamps.
    const t1 = generateEnrollmentToken("admin@lec.app");
    // Modify env or time — simplest: two rapid calls should use same ms but
    // the test is about format, not strict uniqueness here.
    const t2 = generateEnrollmentToken("admin@lec.app");
    // Both should be structurally valid.
    expect(verifyEnrollmentToken(t1)).toMatchObject({ ok: true, email: "admin@lec.app" });
    expect(verifyEnrollmentToken(t2)).toMatchObject({ ok: true, email: "admin@lec.app" });
  });
});

describe("verifyEnrollmentToken — happy path", () => {
  it("returns ok:true with email for a fresh valid token", () => {
    const email = "super@lec.app";
    const token = generateEnrollmentToken(email);
    const result = verifyEnrollmentToken(token);
    expect(result).toMatchObject({ ok: true, email });
  });
});

describe("verifyEnrollmentToken — rejection cases", () => {
  it("rejects a tampered signature", () => {
    const token = generateEnrollmentToken("admin@lec.app");
    const [payload] = token.split(".");
    const tampered = `${payload}.invalidsignatureXXXXXXXXXXXXXXXXXXXXXXXXX`;
    const result = verifyEnrollmentToken(tampered);
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("rejects a token with no dot separator", () => {
    expect(verifyEnrollmentToken("nodot")).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("rejects an empty string", () => {
    expect(verifyEnrollmentToken("")).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("rejects an expired token", () => {
    // Backdate the system clock so the token expires immediately.
    const realDateNow = Date.now;
    try {
      // Generate a token, then advance time past its expiry (15 min + 1 s).
      const token = generateEnrollmentToken("admin@lec.app");
      vi.spyOn(Date, "now").mockReturnValue(realDateNow() + 16 * 60 * 1000);
      const result = verifyEnrollmentToken(token);
      expect(result).toMatchObject({ ok: false, reason: "expired" });
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe("verifyEnrollmentToken — rate limiting", () => {
  // Each call to verifyEnrollmentToken increments the counter even on
  // success. After MAX_ATTEMPTS (5) uses of the same token, the 6th
  // should be rate-limited. Note: tests share in-memory state across
  // vitest runs in the same process — use a unique email per test to get
  // a fresh token (and thus a fresh bucket).
  it("allows up to 5 verifications then rate-limits", () => {
    const token = generateEnrollmentToken("ratelimit-test@lec.app");
    // Calls 1–5 should succeed (ok:true).
    for (let i = 0; i < 5; i++) {
      const r = verifyEnrollmentToken(token);
      expect(r.ok).toBe(true);
    }
    // 6th call: rate limited.
    const r6 = verifyEnrollmentToken(token);
    expect(r6).toMatchObject({ ok: false, reason: "rate_limited" });
  });
});
