-- Phase 2b — pre-session reminder cron.
--
-- HealingSession.reminderSentAt is set the first time the nightly cron
-- (api/cron/send-session-reminders) successfully fires a 1-hour reminder
-- WhatsApp template. The cron dedupes on this column being NULL, so it
-- can run as often as we like without double-pinging clients.
--
-- The column stays NULL forever for sessions where the reminder window
-- has passed and the cron didn't fire (the centre creates a session
-- starting in <1h, etc.) — that's correct: we never want to send a
-- reminder "after the fact" in the next run.

ALTER TABLE "HealingSession"
  ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);

-- Partial index covers the cron's hot query:
--   WHERE date BETWEEN now+55m AND now+65m AND reminderSentAt IS NULL
-- The full table is large but the predicate column shrinks the index.
CREATE INDEX IF NOT EXISTS "HealingSession_reminder_window_idx"
  ON "HealingSession" ("date")
  WHERE "reminderSentAt" IS NULL;
