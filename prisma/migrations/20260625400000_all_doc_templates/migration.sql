-- All 50 document templates — inserts missing ones; existing names are skipped (ON CONFLICT DO NOTHING).
-- Template names in CRM DB must match exactly what is entered in Meta WhatsApp Manager.

-- ── ENQUIRY & LEAD NURTURING ──────────────────────────────────────────────────

-- T2: brochure_followup (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'brochure_followup', 'MARKETING', 'en',
'Namaste {{1}} 🙏

We hope you have had an opportunity to go through our brochure.

Many people discover Pranic Healing while searching for a natural way to manage stress, emotional challenges, or improve their overall well-being. Others simply become curious about how energy influences our health and happiness.

Reading about it is the first step. Experiencing it is often where real understanding begins.

If you would like to know more, we would be happy to guide you through a complimentary counselling session or an introductory programme designed especially for newcomers.

What would you like to discover next?',
'Sent after brochure is delivered to lead', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T3: lead_followup_48hr — message 1 of 2 (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'lead_followup_48hr_1', 'MARKETING', 'en',
'Namaste {{1}} 🙏

Life often keeps us busy, and it is easy to postpone taking care of ourselves.

This is simply a gentle reminder that we are here whenever you feel the time is right.

Whether you are looking for support with physical discomfort, emotional well-being, meditation, or simply wish to understand Pranic Healing better, our team will be happy to assist you.

There is no pressure to make a decision. Your well-being is a journey, not a race.

Whenever you are ready, we would be delighted to support you. Which option feels right for you today?',
'48-hour follow-up after new lead — message 1 of 2', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T3: lead_followup_48hr — message 2 of 2 (1 button)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'lead_followup_48hr_2', 'MARKETING', 'en',
'More options for {{1}}:',
'48-hour follow-up after new lead — message 2 of 2', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T9: not_interested_response (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'not_interested_response', 'MARKETING', 'en',
'Namaste {{1}} 🙏

Thank you for taking the time to connect with Life Energy Centre.

We respect your decision and appreciate your honesty.

Should you ever wish to explore natural approaches to managing stress, improving emotional well-being, learning meditation, or understanding Pranic Healing, our doors will always remain open.

Sometimes the right opportunity comes at the right time. Whenever that time arrives, we would be honoured to welcome you.',
'Sent when client selects Not Interested', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- ── INTRODUCTION SESSION ──────────────────────────────────────────────────────

-- T12: intro_session_reminder (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'intro_session_reminder', 'UTILITY', 'en',
'Namaste {{1}} 🙏

Just a friendly reminder about your FREE Introduction to Pranic Healing session.

📅 Date: {{2}}
🕐 Time: {{3}}
📍 Venue: {{4}}

This session is designed to help you understand how Pranic Healing and meditation can support physical, emotional, and mental well-being. Feel free to bring your questions — our team will be happy to answer them.

We are looking forward to meeting you and sharing this experience together. If your plans change, simply let us know.',
'Reminder 24 hours before Introduction Session', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- ── MEDITATION ────────────────────────────────────────────────────────────────

-- T14: meditation_invitation (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'meditation_invitation', 'MARKETING', 'en',
'Namaste {{1}} 🙏

In the midst of our busy lives, taking even one hour for yourself can make a meaningful difference.

We warmly invite you to our FREE Weekly Guided Meditation, where you will experience deep relaxation, inner peace, and positive energy in a supportive group environment.

Whether you have attended before or this is your first time, you are always welcome.

Peace begins with a single quiet moment. We would be delighted to share that moment with you.',
'Invitation to Weekly Guided Meditation', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T15: meditation_registration_confirmation (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'meditation_registration_confirmation', 'UTILITY', 'en',
'Namaste {{1}} 🙏

Thank you for registering for our Weekly Meditation.

📅 Date: {{2}}
🕐 Time: {{3}}

We are delighted that you will be joining us.

Please arrive a few minutes early so you can settle in comfortably before the meditation begins.

We look forward to sharing a peaceful and uplifting experience with you.',
'Sent after meditation session registration', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- ── HEALING SESSIONS ─────────────────────────────────────────────────────────

-- T23: paid_healing_invitation — message 1 of 2 (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'paid_healing_invitation_1', 'UTILITY', 'en',
'Namaste {{1}} 🙏

We hope your first healing experience was meaningful.

For many people, a single session provides relaxation and clarity. Others find that regular healing sessions help them maintain balance and support their overall well-being over time.

If you feel the experience was beneficial, we would be happy to continue supporting you through individual healing sessions tailored to your needs.

There is no pressure — only an open invitation to continue whenever you feel ready.

How would you like to proceed?',
'Sent after first free healing is completed — message 1 of 2', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T23: paid_healing_invitation — message 2 of 2 (1 button)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'paid_healing_invitation_2', 'UTILITY', 'en',
'More options for {{1}}:',
'Sent after first free healing — message 2 of 2', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T24: next_healing_reminder (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'next_healing_reminder', 'UTILITY', 'en',
'Namaste {{1}} 🙏

We hope you are doing well.

Based on your previous healing plan, it may be a good time to schedule your next session.

Regular healing allows your counsellor and healer to monitor your progress and recommend appropriate guidance as your journey continues.

Small, consistent steps often bring meaningful long-term results.

Would you like to schedule your next session?',
'Sent when next healing session is due', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T28: healing_progress_check — message 1 of 2 (3 buttons — feedback ratings)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'healing_progress_check_1', 'UTILITY', 'en',
'Namaste {{1}} 🙏

It has been a few days since your recent healing session, and we wanted to check in with you.

How have you been feeling?

Your feedback helps us understand your progress and recommend the most appropriate next steps.

Even small changes can provide valuable insights into your healing journey.

How would you describe your progress so far?',
'Progress check 7 days after healing — message 1 of 2', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T28: healing_progress_check — message 2 of 2 (1 button)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'healing_progress_check_2', 'UTILITY', 'en',
'Would you like to speak with someone, {{1}}?',
'Progress check 7 days after healing — message 2 of 2', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T29: package_renewal (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'package_renewal', 'UTILITY', 'en',
'Namaste {{1}} 🙏

You have almost completed your current healing package.

We hope these sessions have been valuable and supportive.

If you feel continued healing would benefit you, we would be delighted to help you plan the next phase of your wellness journey.

The decision is always yours, and we will be happy to guide you based on your individual progress.',
'Sent when 1 session remaining in package', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- ── OPERATIONAL ──────────────────────────────────────────────────────────────

-- T41: appointment_rescheduled (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'appointment_rescheduled', 'UTILITY', 'en',
'Namaste {{1}} 🙏

Your appointment has been successfully rescheduled.

📅 New Date: {{2}}
🕐 Time: {{3}}

We appreciate your update and look forward to welcoming you at the revised schedule.

Life can be busy, and flexibility is part of every journey. We will be here to welcome you at your convenience.',
'Sent when any appointment is rescheduled', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T42: missed_appointment (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'missed_appointment', 'UTILITY', 'en',
'Namaste {{1}} 🙏

We noticed that you could not attend your scheduled appointment today.

We hope everything is well.

If you would still like to meet us, we would be happy to arrange another convenient time.

Sometimes a small delay is simply part of the journey. Whenever you are ready, we will be delighted to welcome you.',
'Sent when client misses a scheduled appointment', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T43: payment_received (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'payment_received', 'UTILITY', 'en',
'Namaste {{1}} 🙏

Thank you.

We have successfully received your payment of ₹{{2}}.

Your payment has been recorded and the corresponding service or package has been activated.

A receipt has been generated and is available in your client portal.

Thank you for placing your trust in us. We look forward to continuing to support your wellness journey.',
'Sent after payment is received', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- ── COURSES ──────────────────────────────────────────────────────────────────

-- T31: basic_course_information — message 1 of 2 (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'basic_course_information_1', 'MARKETING', 'en',
'Namaste {{1}} 🙏

Many people first experience Pranic Healing through counselling or healing sessions. Over time, some decide to learn these simple techniques so they can support their own well-being and help their loved ones.

Our Basic Pranic Healing Course is designed for complete beginners and combines practical learning with guided exercises.

During the course, you will discover:
• The principles of the energy body and chakras
• Simple energy cleansing and energising techniques
• Self-care practices for everyday life
• How to support family members through basic energy techniques

Learning is a journey of self-discovery. We would be delighted to help you take this next step whenever you feel ready.

Would you like to know more?',
'Course information sent after client clicks Learn About the Course — message 1 of 2', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T31: basic_course_information — message 2 of 2 (1 button)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'basic_course_information_2', 'MARKETING', 'en',
'More options for {{1}}:',
'Course information — message 2 of 2', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T32: course_registration_confirmation (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'course_registration_confirmation', 'UTILITY', 'en',
'Namaste {{1}} 🙏

Congratulations on registering for the Basic Pranic Healing Course.

We are delighted to welcome you into the Life Energy Centre learning community.

📅 Course Date: {{2}}
📍 Venue: {{3}}

A few days before the course, we will send you everything you need to know to make your learning experience smooth and enjoyable.

We look forward to learning and growing together.',
'Sent after course registration is confirmed', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T33: course_reminder (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'course_reminder', 'UTILITY', 'en',
'Namaste {{1}} 🙏

Your Basic Pranic Healing Course is just around the corner.

We hope you are looking forward to this new learning experience.

Please arrive about 15 minutes early to complete the registration process comfortably.

If you have any questions before the course, we are always happy to help.

Every new skill begins with curiosity. We cannot wait to welcome you.',
'Sent 2 days before the Basic Course', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T34: welcome_student (2 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'welcome_student', 'UTILITY', 'en',
'Welcome, {{1}}!

Today marks the beginning of a wonderful learning journey.

We hope this course inspires you to understand yourself better, cultivate inner balance, and apply practical techniques in your daily life.

Remember — every expert once started as a beginner.

Our instructors and team are here to support you throughout the programme.

Enjoy the journey and make the most of every session.',
'Sent on the first day of the Basic Course', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T35: course_completion (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'course_completion', 'UTILITY', 'en',
'Namaste {{1}} 🙏

Congratulations on successfully completing the Basic Pranic Healing Course.

We hope the knowledge and practical exercises you learned will continue to support your own well-being and that of your family.

Learning does not end here — it grows through regular practice and continued participation in meditation and future learning opportunities.

May this be the beginning of a lifelong journey of learning and service.',
'Sent after client completes the Basic Pranic Healing Course', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T36: weekly_student_meditation (2 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'weekly_student_meditation', 'MARKETING', 'en',
'Namaste {{1}} 🙏

Regular meditation is one of the simplest ways to reinforce what you have learned and maintain inner balance.

We warmly invite you to join this week''s meditation session and reconnect with the positive energy of our learning community.

Growth happens through consistent practice. We would love to have you with us.',
'Weekly meditation reminder for Basic Course students', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T37: advanced_course_invitation (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'advanced_course_invitation', 'MARKETING', 'en',
'Namaste {{1}} 🙏

As you continue practising what you have learned, you may wish to deepen your understanding through the next level of Pranic Healing training.

Our advanced programmes build upon the strong foundation you have already developed and introduce new concepts and practical applications.

There is no rush — continue whenever you feel the time is right.

Learning is a lifelong journey, and every step opens new possibilities.',
'Invitation to Advanced Pranic Healing Course for eligible students', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- ── COMMUNITY & RETENTION ────────────────────────────────────────────────────

-- T38: referral_invitation (2 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'referral_invitation', 'MARKETING', 'en',
'Namaste {{1}} 🙏

If your experience with Life Energy Centre has been meaningful, perhaps someone close to you may also benefit from our counselling, healing, meditation, or courses.

Referrals are one of the greatest compliments we can receive, and we sincerely appreciate your trust.

Thank you for helping us share wellness and positivity with others.',
'Invitation to refer a friend — sent to satisfied clients', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T39: birthday_greetings (2 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'birthday_greetings', 'MARKETING', 'en',
'Happy Birthday, {{1}}!

On this special day, everyone at Life Energy Centre wishes you good health, happiness, peace, and continued growth.

May the coming year bring you abundant energy, meaningful experiences, and many reasons to smile.

Thank you for being a part of our wellness family.

Have a wonderful celebration!',
'Birthday greeting sent to clients on their birthday', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T40: festival_greetings (2 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'festival_greetings', 'MARKETING', 'en',
'Warm Festival Greetings, {{1}}!

On behalf of the entire team at Life Energy Centre, we wish you and your family joy, peace, harmony, and good health.

May this festive season bring renewed energy, meaningful relationships, and happiness into your life.

Thank you for being a valued member of our community.

Wishing you a wonderful celebration!',
'Festival greeting sent during major holidays', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T45: monthly_wellness_checkin — message 1 of 2 (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'monthly_wellness_checkin_1', 'MARKETING', 'en',
'Namaste {{1}} 🙏

We hope you are keeping well.

It has been a little while since we last connected, so we simply wanted to check in.

How have you been feeling lately?

Even if you do not need a healing session right now, you are always welcome to join our meditation sessions or speak with one of our counsellors.

Your well-being matters to us, and we are always here whenever you need us.',
'Monthly wellness check-in — message 1 of 2', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T45: monthly_wellness_checkin — message 2 of 2 (1 button)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'monthly_wellness_checkin_2', 'MARKETING', 'en',
'We are here for you, {{1}}:',
'Monthly wellness check-in — message 2 of 2', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T46: google_review_request (2 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'google_review_request', 'MARKETING', 'en',
'Namaste {{1}} 🙏

Thank you for sharing your positive experience with us.

If you feel comfortable, we would be grateful if you could share your experience through a Google Review.

Your review may encourage someone else who is looking for support to take the first step towards better well-being.

Thank you for helping us spread positivity and hope.',
'Sent after positive feedback received — requesting Google Review', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T47: welcome_back (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'welcome_back', 'MARKETING', 'en',
'Namaste {{1}} 🙏

Welcome back!

It is wonderful to reconnect with you. We hope you have been keeping well.

Our team will be happy to understand what has changed since your last visit and guide you on the next suitable step for your current needs.

Every new beginning is simply a continuation of your journey. We are delighted to welcome you again.',
'Sent when a client returns after a long gap', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T48: student_anniversary (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'student_anniversary', 'MARKETING', 'en',
'Congratulations {{1}}!

Today marks one year since you completed your Basic Pranic Healing Course.

We hope the knowledge and practices you have learned continue to enrich your life and the lives of those around you.

Thank you for remaining a valued member of our learning community.

Learning grows stronger through regular practice and continued connection. We would love to stay connected with you.',
'Sent 1 year after Basic Course completion', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T49: volunteer_invitation (2 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'volunteer_invitation', 'MARKETING', 'en',
'Namaste {{1}} 🙏

Many students find joy in giving back by supporting meditation sessions, courses, or community activities.

If you would like to volunteer your time and energy, we would be delighted to welcome you.

Volunteering is a wonderful opportunity to continue learning while serving others.

If this resonates with you, we would love to hear from you.',
'Invitation to volunteer — sent to eligible students', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- T50: special_event_invitation (3 buttons)
INSERT INTO "WhatsAppTemplate" (id, name, category, language, "bodyTemplate", description, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'special_event_invitation', 'UTILITY', 'en',
'Namaste {{1}} 🙏

We are delighted to invite you to our upcoming special event at Life Energy Centre.

Whether it is a meditation programme, wellness talk, healing camp, or community celebration, we would love to have you join us.

📅 Date: {{2}}
🕐 Time: {{3}}
📍 Venue: {{4}}

Every gathering is an opportunity to learn, connect, and grow together. We hope you will be able to join us.',
'Invitation to a special event at the centre', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
