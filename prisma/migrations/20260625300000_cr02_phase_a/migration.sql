-- CR-02 Phase A: Journey Reason field + new WA templates

-- ── Journey Reason ─────────────────────────────────────────────────────────────
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "journeyReason" TEXT;

-- ── New WhatsApp templates ──────────────────────────────────────────────────────

-- Need More Time — message 1
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'need_more_time_1',
  'UTILITY', 'en',
  'Namaste {{1}} 🙏

Thank you for sharing your thoughts with us.

We completely understand that every wellness journey begins at the right time. There is absolutely no pressure — whenever you feel ready, we will be here to guide you.

How would you like to continue?',
  'Sent when client needs more time — message 1 of 2',
  true, NOW(), NOW()
)
ON CONFLICT (name) DO NOTHING;

-- Need More Time — message 2
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'need_more_time_2',
  'UTILITY', 'en',
  'More options for {{1}}:',
  'Sent when client needs more time — message 2 of 2',
  true, NOW(), NOW()
)
ON CONFLICT (name) DO NOTHING;

-- Request Callback
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'request_callback',
  'UTILITY', 'en',
  'Namaste {{1}} 🙏

Thank you for requesting a callback.

One of our counsellors will contact you shortly to understand your concerns and answer your questions.

You may also reply with the topic you would like to discuss — for example: stress, physical pain, meditation, healing, or courses.

We look forward to speaking with you. 🌸

— Life Energy Centre',
  'Sent when client requests a callback',
  true, NOW(), NOW()
)
ON CONFLICT (name) DO NOTHING;

-- Feedback Request — message 1 (rating buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'feedback_request_1',
  'UTILITY', 'en',
  'Namaste {{1}} 🙏

Thank you for visiting Life Energy Centre.

Your feedback helps us continuously improve our services and support your healing journey better.

How would you rate your experience?',
  'Sent after visit / healing — feedback rating, message 1 of 2',
  true, NOW(), NOW()
)
ON CONFLICT (name) DO NOTHING;

-- Feedback Request — message 2 (next step after feedback)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'feedback_request_2',
  'UTILITY', 'en',
  'Thank you for your feedback, {{1}}! 🙏

Is there anything else you would like to do?',
  'Sent after feedback — next step options, message 2 of 2',
  true, NOW(), NOW()
)
ON CONFLICT (name) DO NOTHING;
