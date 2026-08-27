-- ── Update existing templates to AIDA format with new button texts ───────────

-- lead_welcome (New Lead)
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Dear {{1}}, are you looking for natural relief from your health challenges?

At Life Energy Centre, we use Pranic Healing — a proven, no-touch energy healing technique that has helped hundreds in Kolkata recover from stress, anxiety, and physical and emotional conditions.

We have shared our introductory brochure: {{2}}

How would you like to begin your healing journey?',
  "updatedAt" = NOW()
WHERE name = 'lead_welcome';

-- lead_followup_options (New Lead — message 2)
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'More ways to connect with us, {{1}}:',
  "updatedAt" = NOW()
WHERE name = 'lead_followup_options';

-- counselling_followup_1 (Counselling Completed — message 1)
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Dear {{1}}, thank you for your counselling session at Life Energy Centre today! 🙏

Based on our discussion, the next step in your healing journey is a hands-on experience at our centre — a chakra scan, a personalised demo healing, and a guided meditation — all free of charge.

What would you like to do next?',
  "updatedAt" = NOW()
WHERE name = 'counselling_followup_1';

-- counselling_followup_2 (Counselling Completed — message 2)
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'More options for {{1}}:',
  "updatedAt" = NOW()
WHERE name = 'counselling_followup_2';

-- visit_followup_1 (Centre Visit Completed — message 1)
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Dear {{1}}, thank you for experiencing Pranic Healing at Life Energy Centre today! 🙏

We hope you felt the positive energy shifts during your session. Regular healing accelerates recovery and restores balance to your body, mind and spirit.

Take the next step in your healing journey:',
  "updatedAt" = NOW()
WHERE name = 'visit_followup_1';

-- visit_followup_2 (Centre Visit Completed — message 2)
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'More options for {{1}}:',
  "updatedAt" = NOW()
WHERE name = 'visit_followup_2';

-- dormant_reactivation — add AIDA body (buttons will be added in Meta)
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏 We have been thinking about you!

It has been a while since your last visit. Many clients experience setbacks when they pause — but healing can restart anytime.

This {{2}} we have a special session just for reconnecting. Join us: {{3}}

We are here for you. 🌸',
  "updatedAt" = NOW()
WHERE name = 'dormant_reactivation';

-- ── New templates ─────────────────────────────────────────────────────────────

-- Healing Summary — message 1
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'healing_summary_1',
  'UTILITY', 'en',
  'Dear {{1}}, your healing session on {{2}} is now complete. 🙏

Consistent healing sessions create lasting transformation — each session builds on the last to restore your natural energy flow and vitality.

Your feedback matters to us:',
  'Sent after healing session ends — message 1 of 2',
  true, NOW(), NOW()
)
ON CONFLICT (name) DO NOTHING;

-- Healing Summary — message 2
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'healing_summary_2',
  'UTILITY', 'en',
  'More ways to deepen your healing journey, {{1}}:',
  'Sent after healing session ends — message 2 of 2',
  true, NOW(), NOW()
)
ON CONFLICT (name) DO NOTHING;

-- Package Client — message 1
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'package_client_1',
  'UTILITY', 'en',
  'Namaste {{1}} 🙏 Thank you for investing in your health and well-being!

As a package client you have priority access to our healers. Regular sessions bring cumulative benefits — the more consistent you are, the faster your recovery.

What would you like to do next?',
  'Sent after package purchase — message 1 of 2',
  true, NOW(), NOW()
)
ON CONFLICT (name) DO NOTHING;

-- Package Client — message 2
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'package_client_2',
  'UTILITY', 'en',
  'More options for {{1}}:',
  'Sent after package purchase — message 2 of 2',
  true, NOW(), NOW()
)
ON CONFLICT (name) DO NOTHING;
