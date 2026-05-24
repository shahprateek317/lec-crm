-- Add DOCUMENT_DELETED to the AuditAction enum.
-- Mid-review fix: deleteDocument() now requires an actorId and writes an
-- audit-log entry. Required for DPDP defensibility — destructive ops on
-- medical reports / healer certs cannot be invisible.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_DELETED';

-- WhatsAppMessage.providerMessageId — make it unique so the webhook
-- can upsert by it (idempotent Meta retries). Multiple NULLs are still
-- allowed in Postgres unique constraints, so locally-created rows that
-- never went through Meta remain valid.
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppMessage_providerMessageId_key"
  ON "WhatsAppMessage"("providerMessageId");

