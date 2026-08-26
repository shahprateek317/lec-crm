INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'client_portal_welcome',
  'UTILITY',
  'en',
  'Namaste {{1}} 🙏

Your personal wellness portal is now ready on the Life Energy Centre app.

View your healing sessions, credits, and progress anytime:
👉 crm.lifeenergycentre.in/me

To sign in, simply enter your WhatsApp number and use the OTP we send you — no password needed.

— Life Energy Centre',
  NOW(),
  NOW()
)
ON CONFLICT (name) DO NOTHING;
