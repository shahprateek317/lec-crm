-- Migration: TOTP backup codes
--
-- Adds UserBackupCode table for single-use recovery codes generated at
-- TOTP enrollment. Codes stored as SHA-256 hashes; plaintext displayed once.

CREATE TABLE "UserBackupCode" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "codeHash"  TEXT NOT NULL,
    "usedAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBackupCode_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UserBackupCode"
    ADD CONSTRAINT "UserBackupCode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "UserBackupCode_userId_usedAt_idx" ON "UserBackupCode"("userId", "usedAt");
