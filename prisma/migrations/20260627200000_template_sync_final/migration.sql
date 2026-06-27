-- Final template sync:
--   1. DELETE the 12 templates removed from Meta (wrongly re-added earlier)
--   2. UPDATE 7 templates to match revised Meta submissions

-- ── 1. DELETE 12 removed templates ──────────────────────────────────────────
DELETE FROM "WhatsAppTemplate" WHERE name IN (
  'advanced_course_invitation',
  'basic_course_information_2',
  'brochure_followup',
  'counseling_meeting_link',
  'meditation_followup_1',
  'meditation_followup_2',
  'meditation_invitation',
  'meditation_registration_confirmation',
  'meditation_thankyou',
  'monthly_wellness_checkin_2',
  'need_more_time_2',
  'weekly_student_meditation'
);

-- ── 2. UPDATE 7 revised templates ───────────────────────────────────────────

-- intro_session_reminder: {{4}} is now Join Link, not Venue
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Just a friendly reminder about your FREE Introduction to Pranic Healing session.

📅 Date: {{2}}
🕐 Time: {{3}}
🔗 Join here: {{4}}

This session is designed to help you understand how Pranic Healing and meditation can support physical, emotional, and mental well-being. Feel free to bring your questions — our team will be happy to answer them.

We are looking forward to meeting you and sharing this experience together. If your plans change, simply let us know.',
  "description" = 'Reminder sent 24 hours before Introduction Session — {{1}}=FirstName {{2}}=Date {{3}}=Time {{4}}=JoinLink',
  "updatedAt" = NOW()
WHERE name = 'intro_session_reminder';

-- healing_summary_1: now has {{3}} = summary URL
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

We hope you are feeling relaxed and comfortable after your healing session on {{2}}.

Your Healing Summary is now ready. It includes a simple overview of your session, the areas that were worked on, and recommendations to help you continue your wellness journey.

Every session is a step forward, and your observations over the next few days are equally important.

Tap the link below to view your summary and let us know how you are feeling:
{{3}}

Your feedback helps us support you better.',
  "description" = 'Auto-sent after client confirms session end — msg 1 of 2 — {{1}}=FirstName {{2}}=SessionDate {{3}}=SummaryURL',
  "updatedAt" = NOW()
WHERE name = 'healing_summary_1';

-- monthly_wellness_checkin_1: buttons changed to Book Healing / Join Meditation / Talk to Counsellor
UPDATE "WhatsAppTemplate" SET
  "description" = 'Monthly wellness check-in — msg 1 of 2 — Buttons: Book Healing / Join Meditation / Talk to Counsellor — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'monthly_wellness_checkin_1';

-- google_review_request: Button 1 changed to URL button (Visit Website → Google review link)
UPDATE "WhatsAppTemplate" SET
  "description" = 'Sent after positive feedback — Button: Visit Website (Google Review URL) — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'google_review_request';

-- referral_invitation: Button 1 changed to URL button (Visit Website → /me/refer)
UPDATE "WhatsAppTemplate" SET
  "description" = 'Invitation to refer a friend — Button: Visit Website (/me/refer) — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'referral_invitation';

-- basic_course_information_1: buttons now Reserve Seat / Talk to Counsellor / Join Meditation First
UPDATE "WhatsAppTemplate" SET
  "description" = 'Course details msg 1 of 2 — Buttons: Reserve Seat / Talk to Counsellor / Join Meditation First — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'basic_course_information_1';

-- course_promotion: Button 2 is now "Reserve Seat (Course)" instead of "Reserve My Seat"
UPDATE "WhatsAppTemplate" SET
  "description" = 'Course invitation after healing sessions — Buttons: Learn About the Course / Reserve Seat (Course) / Talk to Counsellor — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'course_promotion';
