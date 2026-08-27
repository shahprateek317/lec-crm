-- Remove all stub "_2" second-message templates and lead_followup_options.
-- The _1 templates already have 3 buttons each (Meta max) — no content is lost.
-- Code updated to send a single template per stage (followup-wa.ts).

DELETE FROM "WhatsAppTemplate" WHERE name IN (
  'counselling_followup_2',
  'pranic_group_followup_2',
  'visit_followup_2',
  'healing_summary_2',
  'package_client_2',
  'feedback_request_2',
  'paid_healing_invitation_2',
  'lead_followup_48hr_2',
  'healing_progress_check_2',
  'lead_followup_options'
);
