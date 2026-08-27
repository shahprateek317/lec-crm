-- Migration: polymorphic AuditLog actor
--
-- Adds actorType (default "User") and actorClientId (nullable FK to Client)
-- so that client-portal actions and cron runs can be logged without a
-- synthetic User proxy. Makes actorId nullable for Client/System actors.
--
-- Backfill: all existing rows keep their actorId and get actorType = 'User'
-- via the column DEFAULT — no explicit UPDATE needed.

-- 1. Add actorType with default (existing rows auto-populated)
ALTER TABLE "AuditLog" ADD COLUMN "actorType" TEXT NOT NULL DEFAULT 'User';

-- 2. Add nullable clientId FK
ALTER TABLE "AuditLog" ADD COLUMN "actorClientId" TEXT;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorClientId_fkey"
  FOREIGN KEY ("actorClientId") REFERENCES "Client"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Make actorId nullable (client and system actors have no User row)
ALTER TABLE "AuditLog" ALTER COLUMN "actorId" DROP NOT NULL;

-- 4. Index the new column
CREATE INDEX "AuditLog_actorClientId_at_idx" ON "AuditLog"("actorClientId", "at");
