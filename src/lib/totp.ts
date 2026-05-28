// TOTP wrapper — thin facade over `otpauth` so the rest of the app
// has one place to change if we ever swap libraries.
//
// We use the standard RFC 6238 defaults that Google Authenticator,
// Authy, 1Password, Microsoft Authenticator, and Apple's built-in
// codes all support out of the box:
//   - 6-digit codes
//   - 30-second period
//   - SHA-1 hash
//   - Verification window of ±1 step (clock drift tolerance, 90s
//     total acceptance window centered on current time)
//
// Why ±1 not ±2: tighter window = smaller brute-force surface for a
// stolen-secret attacker. 30 seconds either side covers normal client
// clock drift; anything worse means the user should fix their device
// clock.
//
// Secrets are stored AES-256-GCM encrypted at rest via lib/crypto.ts;
// this module never touches storage — it just generates / verifies
// in memory.

import * as OTPAuth from "otpauth";

// Hard-coded so every code we ever issue lines up with every code we
// ever verify. Don't make these configurable — config drift is a
// nasty footgun in 2FA.
const DIGITS = 6;
const PERIOD = 30;
const ALGORITHM = "SHA1";
const WINDOW = 1;

// Issuer label shown in the authenticator app (Google Auth UI: "LEC
// CRM (admin@lec.app)"). Keep ASCII so the URI encodes cleanly.
export const TOTP_ISSUER = "LEC CRM";

/** Generate a fresh base32 secret suitable for storing & encoding. */
export function generateTotpSecret(): string {
  // 20 bytes = 160 bits = RFC 6238's recommended secret length.
  // Secret.base32 is the canonical encoding all authenticator apps
  // accept.
  return new OTPAuth.Secret({ size: 20 }).base32;
}

/**
 * Compose an otpauth:// URL that authenticator apps can consume
 * directly (via QR code or paste). Includes the issuer + account
 * label so the user can tell their LEC entry apart from other
 * accounts in the same app.
 */
export function buildOtpAuthUrl(secret: string, account: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label: account,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.toString();
}

/**
 * Verify a 6-digit code against a base32 secret. Returns true if the
 * code matches the current 30s window or one window on either side.
 * Returns false on malformed inputs — never throws, so callers can
 * treat it as a boolean predicate.
 */
export function verifyTotpCode(secret: string, code: string): boolean {
  if (typeof code !== "string") return false;
  const normalized = code.trim().replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;

  try {
    const totp = new OTPAuth.TOTP({
      issuer: TOTP_ISSUER,
      algorithm: ALGORITHM,
      digits: DIGITS,
      period: PERIOD,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    // `validate` returns null on mismatch, or the delta (0 / ±1) on
    // match. We accept anything inside the configured window.
    const delta = totp.validate({ token: normalized, window: WINDOW });
    return delta !== null;
  } catch {
    // Malformed secret, etc. Treat as failure rather than 500.
    return false;
  }
}

/**
 * Generate the current 6-digit code for a secret. Test-only — never
 * call from production code (the whole point is the client device
 * produces this). Useful for unit tests + admin debug tooling.
 */
export function currentTotpCode(secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.generate();
}
