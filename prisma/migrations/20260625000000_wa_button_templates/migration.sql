-- Update lead_welcome template body to reflect it now has quick reply buttons
-- (buttons themselves are configured in Meta dashboard, not in this table)
UPDATE "WhatsAppTemplate"
SET "bodyTemplate" = 'Dear {{1}}, thank you for reaching out to Life Energy Centre! We have shared our brochure: {{2}}

Please let us know how you would like to proceed 👇',
    "updatedAt" = NOW()
WHERE name = 'lead_welcome';

-- Insert lead_followup_options template (2nd message: Call + Not Interested buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'lead_followup_options',
  'UTILITY',
  'en',
  'You can also choose one of these options:',
  'Second options message sent after lead_welcome — covers Call Back and Not Interested',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (name) DO NOTHING;
