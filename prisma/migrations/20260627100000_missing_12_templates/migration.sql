-- Add 12 templates that were in the Word reference doc and submitted to Meta
-- but were missing from the CRM database.

INSERT INTO "WhatsAppTemplate" (name, "bodyTemplate", description, "createdAt", "updatedAt")
VALUES

-- 1. advanced_course_invitation
('advanced_course_invitation',
 'Namaste {{1}} 🙏

As you continue practising what you have learned, you may wish to deepen your understanding through the next level of Pranic Healing training.

Our advanced programmes build upon the strong foundation you have already developed and introduce new concepts and practical applications.

There is no rush — continue whenever you feel the time is right.

Learning is a lifelong journey, and every step opens new possibilities.',
 'Invitation to Advanced Pranic Healing Course for eligible students — {{1}}=FirstName',
 NOW(), NOW()),

-- 2. basic_course_information_2
('basic_course_information_2',
 'More options for {{1}}:',
 'Course details — message 2 of 2 — {{1}}=FirstName',
 NOW(), NOW()),

-- 3. brochure_followup
('brochure_followup',
 'Namaste {{1}} 🙏

We hope you have had an opportunity to go through our brochure.

Many people discover Pranic Healing while searching for a natural way to manage stress, emotional challenges, or improve their overall well-being. Others simply become curious about how energy influences our health and happiness.

Reading about it is the first step. Experiencing it is often where real understanding begins.

If you would like to know more, we would be happy to guide you through a complimentary counselling session or an introductory programme designed especially for newcomers.

What would you like to discover next?',
 'Manually sent after brochure is delivered to a lead — {{1}}=FirstName',
 NOW(), NOW()),

-- 4. counseling_meeting_link
('counseling_meeting_link',
 'Namaste {{1}} 🙏

Your online counselling session is confirmed for {{2}} with {{3}}.

Click the button below to join. Please keep a quiet space ready.

— Life Energy Centre',
 'Counselling confirmation with CTA button to join meeting link — {{1}}=Name {{2}}=DateTime {{3}}=CounsellorName',
 NOW(), NOW()),

-- 5. meditation_followup_1
('meditation_followup_1',
 'Namaste {{1}} 🙏

Thank you for joining today''s meditation on {{2}}.

We hope you experienced a sense of calm, relaxation, and renewed positive energy.

Many participants tell us that meditation becomes even more meaningful when combined with Pranic Healing, as both practices complement each other beautifully.

If today''s experience inspired you, we would be delighted to help you take the next step.

How can we continue supporting your well-being?',
 'Thank-you after Meditation Group — message 1 of 2 — {{1}}=FirstName {{2}}=SessionDate',
 NOW(), NOW()),

-- 6. meditation_followup_2
('meditation_followup_2',
 'More options for {{1}}:',
 'Thank-you after Meditation Group — message 2 of 2 — {{1}}=FirstName',
 NOW(), NOW()),

-- 7. meditation_invitation
('meditation_invitation',
 'Namaste {{1}} 🙏

In the midst of our busy lives, taking even one hour for yourself can make a meaningful difference.

We warmly invite you to our FREE Weekly Guided Meditation, where you will experience deep relaxation, inner peace, and positive energy in a supportive group environment.

Whether you have attended before or this is your first time, you are always welcome.

Peace begins with a single quiet moment. We would be delighted to share that moment with you.',
 'Invitation to Weekly Guided Meditation — {{1}}=FirstName',
 NOW(), NOW()),

-- 8. meditation_registration_confirmation
('meditation_registration_confirmation',
 'Namaste {{1}} 🙏

Thank you for registering for our Weekly Meditation.

📅 Date: {{2}}
🕐 Time: {{3}}

We are delighted that you will be joining us.

Please arrive a few minutes early so you can settle in comfortably before the meditation begins.

We look forward to sharing a peaceful and uplifting experience with you.',
 'Sent after meditation session registration — {{1}}=FirstName {{2}}=Date {{3}}=Time',
 NOW(), NOW()),

-- 9. meditation_thankyou
('meditation_thankyou',
 'Dear {{1}}, thank you for joining the Meditation session on {{2}}. Regular meditation brings peace and clarity. See you at the next session! 🙏',
 'Quick thank-you sent immediately after attending a meditation session — {{1}}=FirstName {{2}}=SessionDate',
 NOW(), NOW()),

-- 10. monthly_wellness_checkin_2
('monthly_wellness_checkin_2',
 'We are here for you, {{1}}:',
 'Monthly wellness check-in — message 2 of 2 — {{1}}=FirstName',
 NOW(), NOW()),

-- 11. need_more_time_2
('need_more_time_2',
 'More options for {{1}}:',
 'Sent when client needs more time — message 2 of 2 — {{1}}=FirstName',
 NOW(), NOW()),

-- 12. weekly_student_meditation
('weekly_student_meditation',
 'Namaste {{1}} 🙏

Regular meditation is one of the simplest ways to reinforce what you have learned and maintain inner balance.

We warmly invite you to join this week''s meditation session and reconnect with the positive energy of our learning community.

Growth happens through consistent practice. We would love to have you with us.',
 'Weekly meditation reminder for Basic Course students — {{1}}=FirstName',
 NOW(), NOW())

ON CONFLICT (name) DO NOTHING;
