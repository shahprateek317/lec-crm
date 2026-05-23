-- Phase 1a foundation migration.
--
-- Adds the schema for:
--   • Document          — polymorphic file storage (healer certs, medical docs)
--   • WhatsAppThread    — per-client triage state for the coordinator inbox
--   • QualityNote       — per-session QC audit (append-only)
--   • Notification      — in-app feed for staff
--   • AuditLog          — who-accessed-what (DPDP-2025 + insider-risk)
--   • ClientMagicLink   — passwordless auth: hashed token + hashed OTP
--   • ClientSession     — client portal session (hashed cookie value)
--   • Client.deletedAt  — DPDP-2025 soft-delete window
--
-- Plus: HealerCertificate gets a `documentId` FK (nullable, allowing the
-- existing metadata-only rows to coexist with future file-attached ones)
-- and loses its old inline file columns (no rows reference them yet).
--
-- All CREATE / ALTER statements use IF [NOT] EXISTS where Postgres supports
-- it, so the migration is idempotent if re-run by accident.

-- ── Enums ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "DocumentKind" AS ENUM ('HEALER_CERT', 'MEDICAL_REPORT', 'PROFILE_PHOTO', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'UPLOADED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ThreadStatus" AS ENUM ('OPEN', 'SNOOZED', 'RESOLVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "QualityRating" AS ENUM ('POOR', 'FAIR', 'GOOD', 'VERY_GOOD', 'EXCELLENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationKind" AS ENUM (
    'NEW_INBOUND_MESSAGE',
    'NEW_HEALING_ASSIGNMENT',
    'SESSION_REMINDER_1H',
    'CLIENT_DID_NOT_CONFIRM_START',
    'QC_FLAGGED_SESSION',
    'CERT_VERIFIED',
    'REFERRAL_REWARD_GRANTED',
    'PAYMENT_RECEIVED',
    'COURSE_ENROLMENT',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AuditAction" AS ENUM (
    'DOCUMENT_VIEWED',
    'DOCUMENT_DOWNLOADED',
    'CLIENT_DATA_EXPORTED',
    'CLIENT_SOFT_DELETED',
    'CLIENT_HARD_DELETED',
    'WHATSAPP_THREAD_OPENED',
    'HEALING_SESSION_VIEWED',
    'USER_CREATED',
    'USER_DISABLED',
    'USER_ROLE_CHANGED',
    'SETTING_CHANGED',
    'CERT_VERIFIED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LinkConsumeMethod" AS ENUM ('OTP', 'LINK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Client.deletedAt ──────────────────────────────────────────────────
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Client_deletedAt_idx" ON "Client"("deletedAt");

-- ── Document ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Document" (
  "id"            TEXT PRIMARY KEY,
  "kind"          "DocumentKind" NOT NULL,
  "ownerUserId"   TEXT,
  "ownerClientId" TEXT,
  "storageKey"    TEXT NOT NULL UNIQUE,
  "filename"      TEXT NOT NULL,
  "contentType"   TEXT NOT NULL,
  "sizeBytes"     INTEGER,
  "status"        "DocumentStatus" NOT NULL DEFAULT 'PENDING',
  "uploadedById"  TEXT,
  "uploadedAt"    TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Polymorphic ownership invariant: exactly one owner FK is set.
  CONSTRAINT "Document_one_owner"
    CHECK (("ownerUserId" IS NOT NULL)::int + ("ownerClientId" IS NOT NULL)::int = 1),
  CONSTRAINT "Document_ownerUserId_fkey"   FOREIGN KEY ("ownerUserId")   REFERENCES "User"("id")   ON DELETE CASCADE,
  CONSTRAINT "Document_ownerClientId_fkey" FOREIGN KEY ("ownerClientId") REFERENCES "Client"("id") ON DELETE CASCADE,
  CONSTRAINT "Document_uploadedById_fkey"  FOREIGN KEY ("uploadedById")  REFERENCES "User"("id")   ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "Document_ownerUserId_idx"   ON "Document"("ownerUserId");
CREATE INDEX IF NOT EXISTS "Document_ownerClientId_idx" ON "Document"("ownerClientId");
CREATE INDEX IF NOT EXISTS "Document_kind_createdAt_idx" ON "Document"("kind", "createdAt");

-- ── HealerCertificate refactor ────────────────────────────────────────
-- Drop the inline file-storage columns (no rows reference them — upload UI
-- never shipped). Add a nullable FK into Document.
ALTER TABLE "HealerCertificate" DROP COLUMN IF EXISTS "storageKey";
ALTER TABLE "HealerCertificate" DROP COLUMN IF EXISTS "contentType";
ALTER TABLE "HealerCertificate" DROP COLUMN IF EXISTS "fileSize";
ALTER TABLE "HealerCertificate" ADD COLUMN IF NOT EXISTS "documentId" TEXT;

DO $$ BEGIN
  ALTER TABLE "HealerCertificate"
    ADD CONSTRAINT "HealerCertificate_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "HealerCertificate_documentId_key" ON "HealerCertificate"("documentId");

-- ── WhatsAppThread ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WhatsAppThread" (
  "id"             TEXT PRIMARY KEY,
  "clientId"       TEXT NOT NULL UNIQUE,
  "status"         "ThreadStatus" NOT NULL DEFAULT 'OPEN',
  "assigneeId"     TEXT,
  "snoozeUntil"    TIMESTAMP(3),
  "escalated"      BOOLEAN NOT NULL DEFAULT FALSE,
  "resolvedAt"     TIMESTAMP(3),
  "resolvedById"   TEXT,
  "lastInboundAt"  TIMESTAMP(3),
  "lastOutboundAt" TIMESTAMP(3),
  "unreadCount"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WhatsAppThread_clientId_fkey"     FOREIGN KEY ("clientId")     REFERENCES "Client"("id") ON DELETE CASCADE,
  CONSTRAINT "WhatsAppThread_assigneeId_fkey"   FOREIGN KEY ("assigneeId")   REFERENCES "User"("id")   ON DELETE SET NULL,
  CONSTRAINT "WhatsAppThread_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id")   ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "WhatsAppThread_status_assigneeId_idx"    ON "WhatsAppThread"("status", "assigneeId");
CREATE INDEX IF NOT EXISTS "WhatsAppThread_status_lastInboundAt_idx" ON "WhatsAppThread"("status", "lastInboundAt");
CREATE INDEX IF NOT EXISTS "WhatsAppThread_snoozeUntil_idx"          ON "WhatsAppThread"("snoozeUntil");

-- ── QualityNote ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "QualityNote" (
  "id"                     TEXT PRIMARY KEY,
  "sessionId"              TEXT NOT NULL,
  "authorId"               TEXT NOT NULL,
  "rating"                 "QualityRating",
  "note"                   TEXT NOT NULL,
  "needsHealerAttention"   BOOLEAN NOT NULL DEFAULT FALSE,
  "escalated"              BOOLEAN NOT NULL DEFAULT FALSE,
  "acknowledgedByHealerAt" TIMESTAMP(3),
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QualityNote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "HealingSession"("id") ON DELETE CASCADE,
  CONSTRAINT "QualityNote_authorId_fkey"  FOREIGN KEY ("authorId")  REFERENCES "User"("id")
);

CREATE INDEX IF NOT EXISTS "QualityNote_sessionId_idx"           ON "QualityNote"("sessionId");
CREATE INDEX IF NOT EXISTS "QualityNote_authorId_createdAt_idx"  ON "QualityNote"("authorId", "createdAt");

-- ── Notification ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Notification" (
  "id"          TEXT PRIMARY KEY,
  "recipientId" TEXT NOT NULL,
  "kind"        "NotificationKind" NOT NULL,
  "title"       TEXT NOT NULL,
  "body"        TEXT,
  "href"        TEXT,
  "readAt"      TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Notification_recipientId_readAt_idx"    ON "Notification"("recipientId", "readAt");
CREATE INDEX IF NOT EXISTS "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt");

-- ── AuditLog ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id"         TEXT PRIMARY KEY,
  "actorId"    TEXT NOT NULL,
  "action"     "AuditAction" NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId"   TEXT NOT NULL,
  "meta"       JSONB,
  "ip"         TEXT,
  "at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_actorId_at_idx"                ON "AuditLog"("actorId", "at");
CREATE INDEX IF NOT EXISTS "AuditLog_targetType_targetId_at_idx"    ON "AuditLog"("targetType", "targetId", "at");
CREATE INDEX IF NOT EXISTS "AuditLog_action_at_idx"                 ON "AuditLog"("action", "at");

-- ── ClientMagicLink ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ClientMagicLink" (
  "id"          TEXT PRIMARY KEY,
  "tokenHash"   TEXT NOT NULL UNIQUE,
  "otpHash"     TEXT NOT NULL,
  "otpAttempts" INTEGER NOT NULL DEFAULT 0,
  "clientId"    TEXT NOT NULL,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "consumedAt"  TIMESTAMP(3),
  "consumedVia" "LinkConsumeMethod",
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requestIp"   TEXT,
  CONSTRAINT "ClientMagicLink_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ClientMagicLink_clientId_createdAt_idx" ON "ClientMagicLink"("clientId", "createdAt");
CREATE INDEX IF NOT EXISTS "ClientMagicLink_expiresAt_idx"          ON "ClientMagicLink"("expiresAt");

-- ── ClientSession ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ClientSession" (
  "id"         TEXT PRIMARY KEY,
  "tokenHash"  TEXT NOT NULL UNIQUE,
  "clientId"   TEXT NOT NULL,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userAgent"  TEXT,
  "revokedAt"  TIMESTAMP(3),
  CONSTRAINT "ClientSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ClientSession_clientId_idx" ON "ClientSession"("clientId");
CREATE INDEX IF NOT EXISTS "ClientSession_expiresAt_idx" ON "ClientSession"("expiresAt");
