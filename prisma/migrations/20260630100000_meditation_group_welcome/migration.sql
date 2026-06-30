-- Add meditation_group_welcome template
-- Sent to new joinees when added to the meditation group (auto or manual)

INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'meditation_group_welcome',
  'UTILITY',
  'en',
  'Namaste {{1}} 🙏

Welcome to the Life Energy Centre Weekly Meditation Group.

You will receive the session Zoom link, schedule, and any updates directly through our WhatsApp group each week.

We look forward to meditating together with you.

Warm regards,
Life Energy Centre 🌿',
  'Sent when client is added to the meditation group — {{1}}=FirstName',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (name) DO NOTHING;
