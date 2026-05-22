-- Migration: session check-in/out (dad's "OTP at start/end", reimagined as
-- one-tap WhatsApp confirmation) + healer-uploaded certifications.

-- ── HealingSession check-in / check-out columns ──────────────────────────
-- startedAt / endedAt = when the HEALER marked it (their claim).
-- clientConfirmedStartAt / clientConfirmedEndAt = when the CLIENT tapped
-- the confirmation link in WhatsApp (proof). Tokens are single-use URLs.
ALTER TABLE "HealingSession"
  ADD COLUMN IF NOT EXISTS "startedAt"              TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "startCheckInToken"      TEXT,
  ADD COLUMN IF NOT EXISTS "clientConfirmedStartAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endedAt"                TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endCheckInToken"        TEXT,
  ADD COLUMN IF NOT EXISTS "clientConfirmedEndAt"   TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "HealingSession_startCheckInToken_key" ON "HealingSession"("startCheckInToken");
CREATE UNIQUE INDEX IF NOT EXISTS "HealingSession_endCheckInToken_key"   ON "HealingSession"("endCheckInToken");

-- ── HealerCertificate (self-service uploads) ─────────────────────────────
CREATE TABLE IF NOT EXISTS "HealerCertificate" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "storageKey"   TEXT NOT NULL,
    "contentType"  TEXT NOT NULL,
    "fileSize"     INTEGER NOT NULL,
    "issuingBody"  TEXT,
    "issuedAt"     TIMESTAMP(3),
    "expiresAt"    TIMESTAMP(3),
    "verifiedAt"   TIMESTAMP(3),
    "verifiedById" TEXT,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealerCertificate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HealerCertificate_userId_idx" ON "HealerCertificate"("userId");

ALTER TABLE "HealerCertificate"
  ADD CONSTRAINT "HealerCertificate_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HealerCertificate"
  ADD CONSTRAINT "HealerCertificate_verifiedById_fkey"
  FOREIGN KEY ("verifiedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
