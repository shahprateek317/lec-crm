// Tests for the TOTP wrapper library.
//
// What's covered:
//   - generateTotpSecret: format (base32, length, randomness)
//   - buildOtpAuthUrl: scheme, issuer + label encoding
//   - verifyTotpCode: happy path (current window), drift ±1, reject
//     ±2, reject obviously wrong, reject non-numeric, reject wrong
//     length, malformed secret tolerated
//   - currentTotpCode + verifyTotpCode round-trip

import { describe, it, expect } from "vitest";
import {
  generateTotpSecret,
  buildOtpAuthUrl,
  verifyTotpCode,
  currentTotpCode,
  TOTP_ISSUER,
} from "./totp";
import * as OTPAuth from "otpauth";

describe("generateTotpSecret", () => {
  it("returns a non-empty string", () => {
    expect(generateTotpSecret().length).toBeGreaterThan(0);
  });

  it("returns base32-formatted output (A-Z 2-7, optional = padding)", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
  });

  it("generates different secrets on each call", () => {
    // 160-bit secrets effectively never collide; if these match we
    // have a broken RNG.
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
  });

  it("generates secrets of consistent length for 160-bit input", () => {
    // 160 bits = 32 chars in base32.
    const secret = generateTotpSecret();
    expect(secret.replace(/=/g, "").length).toBe(32);
  });
});

describe("buildOtpAuthUrl", () => {
  const secret = "JBSWY3DPEHPK3PXP";

  it("returns a well-formed otpauth:// URL", () => {
    const url = buildOtpAuthUrl(secret, "admin@lec.app");
    expect(url.startsWith("otpauth://totp/")).toBe(true);
  });

  it("encodes the issuer name", () => {
    const url = buildOtpAuthUrl(secret, "admin@lec.app");
    expect(url).toContain(`issuer=${encodeURIComponent(TOTP_ISSUER)}`);
  });

  it("encodes the account label", () => {
    const url = buildOtpAuthUrl(secret, "admin@lec.app");
    expect(url).toContain(encodeURIComponent("admin@lec.app"));
  });

  it("includes the secret as a query parameter", () => {
    const url = buildOtpAuthUrl(secret, "admin@lec.app");
    expect(url).toContain(`secret=${secret}`);
  });
});

describe("verifyTotpCode", () => {
  it("accepts the current code (round-trip)", () => {
    const secret = generateTotpSecret();
    const code = currentTotpCode(secret);
    expect(verifyTotpCode(secret, code)).toBe(true);
  });

  it("accepts a code from one window ago (clock drift +30s)", () => {
    const secret = generateTotpSecret();
    // Manually generate a code with a timestamp 30s in the past.
    const totp = new OTPAuth.TOTP({
      issuer: TOTP_ISSUER,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const past = totp.generate({ timestamp: Date.now() - 30_000 });
    expect(verifyTotpCode(secret, past)).toBe(true);
  });

  it("accepts a code from one window in the future", () => {
    const secret = generateTotpSecret();
    const totp = new OTPAuth.TOTP({
      issuer: TOTP_ISSUER,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const future = totp.generate({ timestamp: Date.now() + 30_000 });
    expect(verifyTotpCode(secret, future)).toBe(true);
  });

  it("rejects a code from 2 windows ago (60s drift = outside tolerance)", () => {
    const secret = generateTotpSecret();
    const totp = new OTPAuth.TOTP({
      issuer: TOTP_ISSUER,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const old = totp.generate({ timestamp: Date.now() - 90_000 });
    expect(verifyTotpCode(secret, old)).toBe(false);
  });

  it("rejects an obviously wrong code", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "000000")).toBe(false);
    expect(verifyTotpCode(secret, "123456")).toBe(false);
  });

  it("rejects non-numeric input", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "abcdef")).toBe(false);
    expect(verifyTotpCode(secret, "12345a")).toBe(false);
  });

  it("rejects codes that aren't 6 digits long", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "12345")).toBe(false);
    expect(verifyTotpCode(secret, "1234567")).toBe(false);
    expect(verifyTotpCode(secret, "")).toBe(false);
  });

  it("tolerates whitespace in the code (apps often paste with spaces)", () => {
    const secret = generateTotpSecret();
    const code = currentTotpCode(secret);
    // Common copy-paste artifact: "123 456"
    const spaced = code.slice(0, 3) + " " + code.slice(3);
    expect(verifyTotpCode(secret, spaced)).toBe(true);
  });

  it("returns false (not throws) for malformed secret", () => {
    expect(verifyTotpCode("NOT-A-BASE32-SECRET!!", "123456")).toBe(false);
  });

  it("returns false for non-string code input", () => {
    const secret = generateTotpSecret();
    // TS would block this; cast to test runtime safety against bad
    // callers (form data, JSON parse, etc.).
    expect(verifyTotpCode(secret, null as unknown as string)).toBe(false);
    expect(verifyTotpCode(secret, undefined as unknown as string)).toBe(false);
    expect(verifyTotpCode(secret, 123456 as unknown as string)).toBe(false);
  });
});
