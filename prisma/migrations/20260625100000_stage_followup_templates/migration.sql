-- ── Counselling follow-up buttons (6 options across 2 messages) ──────────────
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES
(
  gen_random_uuid(),
  'counselling_followup_1',
  'UTILITY', 'en',
  'Dear {{1}}, thank you for your counselling session at Life Energy Centre today! 🙏

To continue your healing journey, please choose your next step:',
  'Sent after counselling — message 1 of 2 (Centre Visit, Pranic Demo, Meditation)',
  true, NOW(), NOW()
),
(
  gen_random_uuid(),
  'counselling_followup_2',
  'UTILITY', 'en',
  'More options for {{1}}:',
  'Sent after counselling — message 2 of 2 (Distant Demo, Telecall, Not Interested)',
  true, NOW(), NOW()
),

-- ── Pranic Intro Group follow-up buttons ──────────────────────────────────────
(
  gen_random_uuid(),
  'pranic_group_followup_1',
  'UTILITY', 'en',
  'Dear {{1}}, thank you for attending the Introduction to Pranic Healing session on {{2}}! 🙏

We hope it was enlightening. What would you like to do next?',
  'Sent after pranic group session — message 1 of 2 (Centre Visit, Meditation, Counselling)',
  true, NOW(), NOW()
),
(
  gen_random_uuid(),
  'pranic_group_followup_2',
  'UTILITY', 'en',
  'More options for {{1}}:',
  'Sent after pranic group session — message 2 of 2 (Telecall, Not Interested)',
  true, NOW(), NOW()
),

-- ── Meditation Group follow-up buttons ───────────────────────────────────────
(
  gen_random_uuid(),
  'meditation_followup_1',
  'UTILITY', 'en',
  'Dear {{1}}, thank you for joining the Meditation session on {{2}}! 🧘

Regular meditation brings peace and clarity. What would you like to explore next?',
  'Sent after meditation session — message 1 of 2 (Centre Visit, Counselling, Pranic Healing)',
  true, NOW(), NOW()
),
(
  gen_random_uuid(),
  'meditation_followup_2',
  'UTILITY', 'en',
  'More options for {{1}}:',
  'Sent after meditation session — message 2 of 2 (Telecall, Exit Group)',
  true, NOW(), NOW()
),

-- ── Centre Visit follow-up buttons ───────────────────────────────────────────
(
  gen_random_uuid(),
  'visit_followup_1',
  'UTILITY', 'en',
  'Dear {{1}}, thank you for visiting Life Energy Centre! We hope the session was helpful. 🙏

Based on your experience, what would you like to do next?',
  'Sent after centre visit — message 1 of 2 (Further Demo, Paid Healing, Meditation)',
  true, NOW(), NOW()
),
(
  gen_random_uuid(),
  'visit_followup_2',
  'UTILITY', 'en',
  'More options for {{1}}:',
  'Sent after centre visit — message 2 of 2 (Telecall, Not Interested, Courses)',
  true, NOW(), NOW()
)
ON CONFLICT (name) DO NOTHING;

-- Deprecate old visit_followup (manual checkbox version — replaced by button pair)
UPDATE "WhatsAppTemplate" SET active = false, "updatedAt" = NOW()
WHERE name = 'visit_followup';

-- Deprecate visit_invitation (replaced by counselling_followup_1/2)
UPDATE "WhatsAppTemplate" SET active = false, "updatedAt" = NOW()
WHERE name = 'visit_invitation';

-- Deprecate old pranic/meditation thank-you (replaced by followup pairs)
UPDATE "WhatsAppTemplate" SET active = false, "updatedAt" = NOW()
WHERE name IN ('pranic_group_thankyou', 'meditation_thankyou');
