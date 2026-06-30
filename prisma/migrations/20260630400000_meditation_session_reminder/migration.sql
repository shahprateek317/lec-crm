INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'meditation_session_reminder',
  'UTILITY',
  'en',
  'Namaste {{1}} 🙏

Your weekly meditation session is scheduled for {{2}} at {{3}}.

Join here: {{4}}

We look forward to meditating with you.',
  NOW(),
  NOW()
)
ON CONFLICT (name) DO NOTHING;
