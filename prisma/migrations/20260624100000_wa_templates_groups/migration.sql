-- Insert WhatsApp templates for group thank-you messages
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES
  (
    gen_random_uuid(),
    'pranic_group_thankyou',
    'UTILITY',
    'en',
    'Dear {{1}}, thank you for attending the Introduction to Pranic Healing session on {{2}}. We hope it was insightful! Our coordinators will follow up with you soon. 🙏',
    'Sent after attending Pranic Healing intro group session',
    true,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'meditation_thankyou',
    'UTILITY',
    'en',
    'Dear {{1}}, thank you for joining the Meditation session on {{2}}. Regular meditation brings peace and clarity. See you at the next session! 🙏',
    'Sent after attending meditation group session',
    true,
    NOW(),
    NOW()
  )
ON CONFLICT (name) DO NOTHING;
