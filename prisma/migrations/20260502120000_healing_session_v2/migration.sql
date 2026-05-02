-- Healing session v2 — adds structured before/after chakra states,
-- cleansing & energising actions, server-computed improvement score, and
-- session-type classification (Demo / Paid / Follow-up).
-- Backwards-compatible: existing rows default to PAID + empty arrays + 0.

-- CreateEnum
CREATE TYPE "HealingSessionType" AS ENUM ('DEMO', 'PAID', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "CleansingAction" AS ENUM ('GENERAL', 'TARGET_CHAKRA', 'DEEP', 'PSYCHOLOGICAL');

-- CreateEnum
CREATE TYPE "EnergisingAction" AS ENUM ('GENERAL', 'SPECIFIC_CHAKRA', 'HIGH_POWER');

-- AlterTable
ALTER TABLE "HealingSession" ADD COLUMN "sessionType" "HealingSessionType" NOT NULL DEFAULT 'PAID';
ALTER TABLE "HealingSession" ADD COLUMN "chakraStatesBefore" JSONB;
ALTER TABLE "HealingSession" ADD COLUMN "chakraStatesAfter" JSONB;
ALTER TABLE "HealingSession" ADD COLUMN "cleansingActions" "CleansingAction"[] DEFAULT ARRAY[]::"CleansingAction"[];
ALTER TABLE "HealingSession" ADD COLUMN "energisingActions" "EnergisingAction"[] DEFAULT ARRAY[]::"EnergisingAction"[];
ALTER TABLE "HealingSession" ADD COLUMN "improvementScore" INTEGER NOT NULL DEFAULT 0;
