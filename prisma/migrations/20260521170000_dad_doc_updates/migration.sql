-- Migration: changes from dad's "Update the existing Healing" doc, May 2026.
--   1. Add QUALITY_CONTROLLER role (new audit/quality role)
--   2. Drop CounsellorProfile.canOffer99Program (₹99 program retired)
--   3. Client.referrerClientId (FK to another Client) + healingCreditsEarned
--   4. New ReferralReason enum + ReferralReward table for the rewards engine

-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'QUALITY_CONTROLLER';

-- AlterTable: drop the ₹99 toggle (data discarded — was a demo-only flag).
ALTER TABLE "CounsellorProfile" DROP COLUMN IF EXISTS "canOffer99Program";

-- AlterTable: programmatic referrer link + earned-credits balance.
ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "referrerClientId"     TEXT,
  ADD COLUMN IF NOT EXISTS "healingCreditsEarned" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Client_referrerClientId_idx" ON "Client"("referrerClientId");

ALTER TABLE "Client"
  ADD CONSTRAINT "Client_referrerClientId_fkey"
  FOREIGN KEY ("referrerClientId") REFERENCES "Client"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ReferralReason" AS ENUM ('CENTRE_VISIT', 'PACKAGE_PURCHASE', 'COURSE_ENROLMENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReferralReward" (
    "id"              TEXT NOT NULL,
    "referrerId"      TEXT NOT NULL,
    "refereeId"       TEXT NOT NULL,
    "reason"          "ReferralReason" NOT NULL,
    "sessionsAwarded" INTEGER NOT NULL DEFAULT 1,
    "note"            TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReferralReward_referrerId_idx" ON "ReferralReward"("referrerId");
CREATE INDEX IF NOT EXISTS "ReferralReward_refereeId_idx" ON "ReferralReward"("refereeId");
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralReward_referrerId_refereeId_reason_key"
  ON "ReferralReward"("referrerId", "refereeId", "reason");

ALTER TABLE "ReferralReward"
  ADD CONSTRAINT "ReferralReward_referrerId_fkey"
  FOREIGN KEY ("referrerId") REFERENCES "Client"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReferralReward"
  ADD CONSTRAINT "ReferralReward_refereeId_fkey"
  FOREIGN KEY ("refereeId") REFERENCES "Client"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
