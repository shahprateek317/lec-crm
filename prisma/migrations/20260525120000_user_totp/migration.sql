-- Phase 2c — TOTP 2FA for staff users.
--
-- Two columns:
--   totpSecret       AES-256-GCM encrypted base32 secret (via @/lib/crypto).
--                    Plaintext never persisted.
--   totpEnabledAt    Set when the user verifies their first code. Before
--                    this is set, the secret exists but isn't checked at
--                    sign-in — covers the enrollment-in-progress state.
--
-- State machine:
--   no secret, no enabledAt        →  TOTP off
--   secret set, no enabledAt       →  pending enrollment (must verify code)
--   secret set + enabledAt         →  TOTP active; sign-in requires code
--   no secret + enabledAt          →  invalid; never reached
--
-- We don't store backup codes yet. Recovery if a user loses their
-- authenticator is "admin resets it from /settings/users/[id]" — same
-- recovery path as a forgotten password. Backup codes can land in
-- Phase 2d after Papa's tested the basic enrollment.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "totpSecret"    TEXT,
  ADD COLUMN IF NOT EXISTS "totpEnabledAt" TIMESTAMP(3);
