-- FINAL TEMPLATE SYNC
-- Body = professional content from doc
-- Name = CRM name (what code sends to Meta)
-- Variables = exactly what the CRM code passes (verified from source)
-- Buttons = CRM webhook-mapped button texts
--
-- Variable key per template noted in comments as: {{1}}=..., {{2}}=...

-- ════════════════════════════════════════════════════════════════════
-- LEAD NURTURING
-- ════════════════════════════════════════════════════════════════════

-- lead_welcome  |  {{1}}=FirstName  {{2}}=BrochureLink
-- Buttons (msg 1): Book FREE Counselling | Join Introduction Session | Join Weekly Meditation
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Thank you for contacting Life Energy Centre.

We understand that every person who reaches out to us has a unique story. Some are looking for relief from physical discomfort, others seek emotional balance, reduced stress, greater inner peace, or simply a healthier and happier way of living.

Our first priority is to understand your needs, not to recommend a service.

We therefore invite you to a complimentary personal counselling session, where one of our counsellors will listen to your concerns, answer your questions, and help you understand how healing, meditation, or learning Pranic Healing may support your well-being.

There is no obligation — just an opportunity to explore what feels right for you.

We have shared our introductory brochure here: {{2}}

Which option would you like to explore first?',
  "description" = 'Sent immediately when a new lead is created — message 1 of 2',
  "updatedAt" = NOW()
WHERE name = 'lead_welcome';

-- lead_followup_options  |  {{1}}=FirstName
-- Buttons (msg 2): Request Callback | Not Interested
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'More ways to connect with us, {{1}}:',
  "description" = 'Sent 2 seconds after lead_welcome — message 2 of 2',
  "updatedAt" = NOW()
WHERE name = 'lead_followup_options';

-- brochure_followup  |  {{1}}=FirstName
-- Buttons: Book FREE Counselling | Join Introduction Session | Talk to Counsellor
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

We hope you have had an opportunity to go through our brochure.

Many people discover Pranic Healing while searching for a natural way to manage stress, emotional challenges, or improve their overall well-being. Others simply become curious about how energy influences our health and happiness.

Reading about it is the first step. Experiencing it is often where real understanding begins.

If you would like to know more, we would be happy to guide you through a complimentary counselling session or an introductory programme designed especially for newcomers.

What would you like to discover next?',
  "description" = 'Manually sent after brochure is delivered to a lead',
  "updatedAt" = NOW()
WHERE name = 'brochure_followup';

-- lead_followup_48hr_1  |  {{1}}=FirstName
-- Buttons: Book FREE Counselling | Introduction Session | Weekly Meditation
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Life often keeps us busy, and it is easy to postpone taking care of ourselves.

This is simply a gentle reminder that we are here whenever you feel the time is right.

Whether you are looking for support with physical discomfort, emotional well-being, meditation, or simply wish to understand Pranic Healing better, our team will be happy to assist you.

There is no pressure to make a decision. Your well-being is a journey, not a race.

Whenever you are ready, we would be delighted to support you. Which option feels right for you today?',
  "description" = '48-hour follow-up after new lead — message 1 of 2',
  "updatedAt" = NOW()
WHERE name = 'lead_followup_48hr_1';

-- lead_followup_48hr_2  |  {{1}}=FirstName
-- Buttons: Callback
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'More options for {{1}}:',
  "description" = '48-hour follow-up after new lead — message 2 of 2',
  "updatedAt" = NOW()
WHERE name = 'lead_followup_48hr_2';

-- request_callback  |  {{1}}=FirstName
-- No buttons (text only)
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Thank you for requesting a callback.

One of our counsellors will contact you shortly to understand your concerns and answer your questions.

To help us prepare, you are welcome to reply with the topic you would like to discuss — whether it relates to healing, meditation, stress management, emotional well-being, or our courses.

We look forward to speaking with you.',
  "description" = 'Sent when a client requests a callback',
  "updatedAt" = NOW()
WHERE name = 'request_callback';

-- not_interested_response  |  {{1}}=FirstName
-- Buttons: Join Meditation | Learn More | Contact Us
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Thank you for taking the time to connect with Life Energy Centre.

We respect your decision and appreciate your honesty.

Should you ever wish to explore natural approaches to managing stress, improving emotional well-being, learning meditation, or understanding Pranic Healing, our doors will always remain open.

Sometimes the right opportunity comes at the right time. Whenever that time arrives, we would be honoured to welcome you.',
  "description" = 'Sent when a client selects Not Interested',
  "updatedAt" = NOW()
WHERE name = 'not_interested_response';

-- dormant_reactivation  |  {{1}}=FirstName  {{2}}=Day  {{3}}=Link
-- Buttons: Book Healing | Join Meditation | Talk to Counsellor
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

It has been a little while since we last connected, and we hope you are keeping well.

We often think of our clients as members of our extended wellness family, so we simply wanted to check in and let you know that we are here whenever you need us.

Whether you would like to continue healing, attend meditation, or simply reconnect with one of our counsellors, we would be delighted to hear from you again.

There is no expectation — just an open invitation whenever the time feels right for you.

This {{2}} we have a special session: {{3}}

Would you like to reconnect with us?',
  "description" = 'Sent when lead has been inactive for 30+ days',
  "updatedAt" = NOW()
WHERE name = 'dormant_reactivation';

-- need_more_time_1  |  {{1}}=FirstName
-- Buttons: Join Weekly Meditation | Talk to Counsellor | Contact Me Later
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Thank you for sharing your thoughts with us.

We completely understand. Choosing a wellness programme is a personal decision, and it is important that you feel comfortable and well informed.

There is absolutely no pressure to decide immediately.

Whenever you feel ready, we will be happy to guide you and answer any questions you may have.

Meanwhile, you are always welcome to join our weekly guided meditation sessions, where you can experience relaxation and positive energy at your own pace.

How would you like to continue?',
  "description" = 'Sent when client needs more time — message 1 of 2',
  "updatedAt" = NOW()
WHERE name = 'need_more_time_1';

-- need_more_time_2  |  {{1}}=FirstName
-- Buttons: Close for Now
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'More options for {{1}}:',
  "description" = 'Sent when client needs more time — message 2 of 2',
  "updatedAt" = NOW()
WHERE name = 'need_more_time_2';

-- ════════════════════════════════════════════════════════════════════
-- COUNSELLING
-- ════════════════════════════════════════════════════════════════════

-- counseling_confirmation  |  {{1}}=FirstName  {{2}}=DateTime  {{3}}=CounsellorName  {{4}}=MeetLink
-- (template name in code is session_join_link — same template)
-- Buttons: View Location | Contact Centre | Reschedule
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Your complimentary counselling session has been successfully scheduled.

📅 Date & Time: {{2}}
👤 Counsellor: {{3}}

During this session, our counsellor will take the time to understand your concerns, answer your questions, and guide you towards the most appropriate next step based on your individual needs.

We encourage you to come with an open mind and feel free to ask anything.

Click the link to join your session: {{4}}

We look forward to meeting you.',
  "description" = 'Sent when counselling is booked — includes meeting link',
  "updatedAt" = NOW()
WHERE name = 'session_join_link';

-- counseling_reminder_1d  |  {{1}}=FirstName  {{2}}=DateTime  {{3}}=CounsellorName
-- Buttons: View Location | Reschedule | Contact Centre
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

This is a friendly reminder about your complimentary counselling session with us.

📅 Date & Time: {{2}}
👤 Counsellor: {{3}}

Our counsellor has reserved this time especially for you so that we can understand your concerns, answer your questions, and help you explore the most suitable path for your wellness journey.

If your plans change, please let us know — we will be happy to arrange another convenient time.',
  "description" = 'Reminder sent 24 hours before counselling session',
  "updatedAt" = NOW()
WHERE name = 'counseling_reminder_1d';

-- counsellor_session_assigned  |  {{1}}=CounsellorFirstName  {{2}}=ClientName  {{3}}=DateTime  {{4}}=MeetLink
-- Internal — sent to counsellor only
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

A counselling session has been assigned to you.

👤 Client: {{2}}
📅 Date & Time: {{3}}

Join here: {{4}}

Please be ready a few minutes before the session begins.

— Life Energy Centre',
  "description" = 'Sent to counsellor when a session is assigned',
  "updatedAt" = NOW()
WHERE name = 'counsellor_session_assigned';

-- counselling_followup_1  |  {{1}}=FirstName
-- Buttons: Book Centre Visit | Join Introduction Session | Join Meditation
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

It was a pleasure meeting you today.

Thank you for taking the time to share your concerns with us. We hope the discussion gave you greater clarity and confidence about the possibilities ahead.

Many people tell us that the best way to understand Pranic Healing is to experience it personally.

We would therefore be delighted to invite you for a complimentary healing session at our centre, where you can experience healing and guided meditation in a calm and supportive environment.

Every person''s journey is unique. Based on today''s discussion, we would be happy to support whichever path feels right for you.

How would you like to continue your wellness journey?',
  "description" = 'Sent after counselling is completed — message 1 of 2',
  "updatedAt" = NOW()
WHERE name = 'counselling_followup_1';

-- counselling_followup_2  |  {{1}}=FirstName
-- Buttons: Request Callback | Not Interested
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'More options for {{1}}:',
  "description" = 'Sent after counselling is completed — message 2 of 2',
  "updatedAt" = NOW()
WHERE name = 'counselling_followup_2';

-- ════════════════════════════════════════════════════════════════════
-- INTRODUCTION SESSION
-- ════════════════════════════════════════════════════════════════════

-- intro_session_invitation  |  {{1}}=FirstName  {{2}}=DateTime  {{3}}=JoinLink
-- Buttons: Register Now | Request Callback | Join Meditation Instead
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Have you ever wondered how your energy influences your physical, emotional, and mental well-being?

Our FREE Introduction Session has been specially designed to answer these questions in a simple and practical way.

You will learn:
• What Pranic Healing is
• How it complements a healthy lifestyle
• The role of meditation in everyday life
• How anyone can learn simple techniques for self-care

📅 Date & Time: {{2}}
🔗 Join here: {{3}}

Whether you are simply curious or actively looking for a natural wellness approach, you are most welcome to join us.

Understanding is the beginning of transformation.

Would you like to reserve your place?',
  "description" = 'Invitation to Introduction to Pranic Healing group session',
  "updatedAt" = NOW()
WHERE name = 'intro_session_invitation';

-- intro_session_reminder  |  {{1}}=FirstName  {{2}}=Date  {{3}}=Time  {{4}}=Venue
-- Buttons: View Location | Reschedule | Contact Centre
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Just a friendly reminder about your FREE Introduction to Pranic Healing session.

📅 Date: {{2}}
🕐 Time: {{3}}
📍 Venue: {{4}}

This session is designed to help you understand how Pranic Healing and meditation can support physical, emotional, and mental well-being. Feel free to bring your questions — our team will be happy to answer them.

We are looking forward to meeting you and sharing this experience together. If your plans change, simply let us know.',
  "description" = 'Reminder sent 24 hours before Introduction Session',
  "updatedAt" = NOW()
WHERE name = 'intro_session_reminder';

-- pranic_group_followup_1  |  {{1}}=FirstName  {{2}}=SessionDate
-- Buttons: Book FREE Healing | Join Weekly Meditation | Talk to Counsellor
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Thank you for joining today''s Introduction Session on {{2}}.

We hope it helped you understand the principles of Pranic Healing and how balancing your energy can support a healthier and more peaceful life.

Knowledge creates awareness. Experience creates understanding.

We would love to welcome you for a complimentary healing session, where you can personally experience Pranic Healing in a calm and supportive environment.

Which experience feels like the right next step for you?',
  "description" = 'Thank-you after Pranic Intro Group — message 1 of 2',
  "updatedAt" = NOW()
WHERE name = 'pranic_group_followup_1';

-- pranic_group_followup_2  |  {{1}}=FirstName
-- Buttons: Need More Time | Not Interested
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'More options for {{1}}:',
  "description" = 'Thank-you after Pranic Intro Group — message 2 of 2',
  "updatedAt" = NOW()
WHERE name = 'pranic_group_followup_2';

-- ════════════════════════════════════════════════════════════════════
-- MEDITATION
-- ════════════════════════════════════════════════════════════════════

-- meditation_invitation  |  {{1}}=FirstName
-- Buttons: Reserve My Seat | Book Centre Visit | Request Callback
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

In the midst of our busy lives, taking even one hour for yourself can make a meaningful difference.

We warmly invite you to our FREE Weekly Guided Meditation, where you will experience deep relaxation, inner peace, and positive energy in a supportive group environment.

Whether you have attended before or this is your first time, you are always welcome.

Peace begins with a single quiet moment. We would be delighted to share that moment with you.',
  "description" = 'Invitation to Weekly Guided Meditation',
  "updatedAt" = NOW()
WHERE name = 'meditation_invitation';

-- meditation_registration_confirmation  |  {{1}}=FirstName  {{2}}=Date  {{3}}=Time
-- Buttons: View Location | Reschedule | Contact Centre
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Thank you for registering for our Weekly Meditation.

📅 Date: {{2}}
🕐 Time: {{3}}

We are delighted that you will be joining us.

Please arrive a few minutes early so you can settle in comfortably before the meditation begins.

We look forward to sharing a peaceful and uplifting experience with you.',
  "description" = 'Sent after meditation session registration',
  "updatedAt" = NOW()
WHERE name = 'meditation_registration_confirmation';

-- meditation_followup_1  |  {{1}}=FirstName  {{2}}=SessionDate
-- Buttons: Book FREE Healing | Join Introduction Again | Talk to Counsellor
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Thank you for joining today''s meditation on {{2}}.

We hope you experienced a sense of calm, relaxation, and renewed positive energy.

Many participants tell us that meditation becomes even more meaningful when combined with Pranic Healing, as both practices complement each other beautifully.

If today''s experience inspired you, we would be delighted to help you take the next step.

How can we continue supporting your well-being?',
  "description" = 'Thank-you after Meditation Group — message 1 of 2',
  "updatedAt" = NOW()
WHERE name = 'meditation_followup_1';

-- meditation_followup_2  |  {{1}}=FirstName
-- Buttons: Request Callback | Exit Meditation Group
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'More options for {{1}}:',
  "description" = 'Thank-you after Meditation Group — message 2 of 2',
  "updatedAt" = NOW()
WHERE name = 'meditation_followup_2';

-- ════════════════════════════════════════════════════════════════════
-- CENTRE VISIT
-- ════════════════════════════════════════════════════════════════════

-- visit_confirmation  |  {{1}}=ClientName  {{2}}=DateTime
-- (code fixed: scheduling.ts now passes [client.name, format(scheduledAt)])
-- Buttons: View Location | Reschedule | Contact Centre
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Your visit to Life Energy Centre has been confirmed for {{2}}.

During your visit you will:
✔ Meet our counsellor
✔ Experience a complimentary healing session
✔ Participate in guided meditation
✔ Receive guidance on suitable next steps

📍 Address: Pecon Tower, 2nd Floor, behind Tata Medical Centre, New Town, Kolkata

Our team will ensure that your visit is comfortable, relaxed, and meaningful.

If there is anything you would like to know before your visit, please feel free to contact us.',
  "description" = 'Sent when a centre visit is booked — {{1}}=ClientName {{2}}=DateTime',
  "updatedAt" = NOW()
WHERE name = 'visit_confirmation';

-- visit_reminder_1d  |  {{1}}=DateTime
-- (code passes only DateTime for visit reminder as well)
-- Buttons: Directions | Reschedule | Contact Centre
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste 🙏

This is a gentle reminder about your visit to Life Energy Centre tomorrow at {{1}}.

Please try to arrive about 10 minutes early so you can begin your visit comfortably and without any rush.

📍 Pecon Tower, 2nd Floor, behind Tata Medical Centre, New Town, Kolkata

We are looking forward to meeting you personally. Safe travels, and we will see you soon.',
  "description" = 'Reminder sent 24 hours before centre visit — {{1}}=DateTime',
  "updatedAt" = NOW()
WHERE name = 'visit_reminder_1d';

-- visit_followup_1  |  {{1}}=FirstName
-- Buttons: Continue Healing | Healing Packages | Learn Pranic Healing
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

It was truly a pleasure welcoming you today.

We hope your visit gave you an opportunity to experience the peaceful environment of our centre and the calming effects of your complimentary healing session.

Many people describe this first experience as the beginning of a new perspective on their well-being.

There is no pressure to decide today. Take your time. Whenever you feel ready, we will be happy to walk alongside you on the next step of your wellness journey.

Which option feels right for you at this stage?',
  "description" = 'Sent after centre visit is completed — message 1 of 2',
  "updatedAt" = NOW()
WHERE name = 'visit_followup_1';

-- visit_followup_2  |  {{1}}=FirstName
-- Buttons: Talk to Counsellor | Not Interested
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'More options for {{1}}:',
  "description" = 'Sent after centre visit is completed — message 2 of 2',
  "updatedAt" = NOW()
WHERE name = 'visit_followup_2';

-- ════════════════════════════════════════════════════════════════════
-- HEALING SESSIONS — OPERATIONAL (internal, no doc content needed)
-- ════════════════════════════════════════════════════════════════════

-- healing_session_confirmed  |  {{1}}=FirstName  {{2}}=DateTime  {{3}}=HealerName
-- In-person healing — sent to client
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Your healing session has been confirmed.

📅 Date & Time: {{2}}
👤 Healer: {{3}}
📍 Life Energy Centre, New Town, Kolkata

Please arrive 5 minutes early. We look forward to welcoming you.

— Life Energy Centre',
  "description" = 'In-person healing confirmation sent to client — {{1}}=Name {{2}}=DateTime {{3}}=HealerName',
  "updatedAt" = NOW()
WHERE name = 'healing_session_confirmed';

-- healing_session_link  |  {{1}}=FirstName  {{2}}=DateTime  {{3}}=HealerName  {{4}}=MeetLink
-- Distant healing — sent to client
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Your distant healing session has been confirmed.

📅 Date & Time: {{2}}
👤 Healer: {{3}}

Please be in a quiet, comfortable space at the scheduled time.

Join here: {{4}}

— Life Energy Centre',
  "description" = 'Distant healing confirmation sent to client — {{1}}=Name {{2}}=DateTime {{3}}=HealerName {{4}}=MeetLink',
  "updatedAt" = NOW()
WHERE name = 'healing_session_link';

-- healer_healing_assigned  |  {{1}}=HealerFirstName  {{2}}=ClientName  {{3}}=DateTime
-- In-person — sent to healer
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

You have an in-person healing session assigned.

👤 Client: {{2}}
📅 Date & Time: {{3}}
📍 Life Energy Centre, New Town, Kolkata

Please be ready on time.

— Life Energy Centre',
  "description" = 'In-person healing assigned — sent to healer — {{1}}=HealerName {{2}}=ClientName {{3}}=DateTime',
  "updatedAt" = NOW()
WHERE name = 'healer_healing_assigned';

-- healer_healing_link  |  {{1}}=HealerFirstName  {{2}}=ClientName  {{3}}=DateTime  {{4}}=MeetLink
-- Distant — sent to healer
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

You have a distant healing session assigned.

👤 Client: {{2}}
📅 Date & Time: {{3}}

Join here: {{4}}

— Life Energy Centre',
  "description" = 'Distant healing assigned — sent to healer — {{1}}=HealerName {{2}}=ClientName {{3}}=DateTime {{4}}=MeetLink',
  "updatedAt" = NOW()
WHERE name = 'healer_healing_link';

-- healing_reminder_1h  |  {{1}}=FirstName  {{2}}=HealerName  {{3}}=Time  {{4}}=SessionType
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

A gentle reminder — your healing session with {{2}} begins in about an hour at {{3}} ({{4}}).

Please be settled and quiet a few minutes before we begin.

— Life Energy Centre',
  "description" = 'Sent 1 hour before healing session — {{1}}=Name {{2}}=HealerName {{3}}=Time {{4}}=SessionType',
  "updatedAt" = NOW()
WHERE name = 'healing_reminder_1h';

-- healer_assignment  |  {{1}}=HealerFirstName  {{2}}=ClientName  {{3}}=DateTime
-- General healer notification (used for session assignments in some flows)
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

A new session has been assigned to you.

👤 Client: {{2}}
📅 Date & Time: {{3}}

Please confirm you are available.

— Life Energy Centre',
  "description" = 'General healer session assignment notification — {{1}}=HealerName {{2}}=ClientName {{3}}=DateTime',
  "updatedAt" = NOW()
WHERE name = 'healer_assignment';

-- session_check_in_start  |  {{1}}=FirstName  {{2}}=HealerName  {{3}}=ConfirmURL
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Your healing session with {{2}} has begun.

Please confirm by tapping the link below — this helps us keep accurate session records:

{{3}}

Thank you 🌸
— Life Energy Centre',
  "description" = 'Sent when healer starts session — client must tap link to confirm — {{1}}=Name {{2}}=HealerName {{3}}=ConfirmURL',
  "updatedAt" = NOW()
WHERE name = 'session_check_in_start';

-- session_check_in_end  |  {{1}}=FirstName  {{2}}=HealerName  {{3}}=StartTime  {{4}}=ConfirmURL
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Your healing session with {{2}} (started {{3}}) has now ended.

Please confirm by tapping the link below:

{{4}}

We will send your healing summary shortly. 🙏
— Life Energy Centre',
  "description" = 'Sent when healer ends session — client confirms end — {{1}}=Name {{2}}=HealerName {{3}}=StartTime {{4}}=ConfirmURL',
  "updatedAt" = NOW()
WHERE name = 'session_check_in_end';

-- ════════════════════════════════════════════════════════════════════
-- HEALING SUMMARY & FEEDBACK
-- ════════════════════════════════════════════════════════════════════

-- healing_summary_1  |  {{1}}=FirstName  {{2}}=SessionDate
-- Buttons: View Healing Summary | Give Feedback | Book Next Healing
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

We hope you are feeling relaxed and comfortable after your healing session on {{2}}.

Your Healing Summary is now ready. It includes a simple overview of your session, the areas that were worked on, and recommendations to help you continue your wellness journey.

Every session is a step forward, and your observations over the next few days are equally important.

Take a few moments to review your summary, and let us know how you are feeling. Your feedback helps us support you better.

What would you like to do next?',
  "description" = 'Auto-sent after client confirms session end — message 1 of 2 — {{1}}=FirstName {{2}}=SessionDate',
  "updatedAt" = NOW()
WHERE name = 'healing_summary_1';

-- healing_summary_2  |  {{1}}=FirstName
-- Buttons: Join Meditation Group | Learn Pranic Healing | Contact Counsellor
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'More ways to deepen your healing journey, {{1}}:',
  "description" = 'Auto-sent after client confirms session end — message 2 of 2 — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'healing_summary_2';

-- feedback_request_1  |  {{1}}=FirstName
-- Buttons: Excellent | Good | Average
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

We hope you have had some time to observe how you are feeling after your recent healing session.

Every person''s experience is unique, and your feedback helps us understand your progress and improve our services.

Your response will also assist your counsellor and healer in recommending the most suitable next steps for you.

Your experience matters to us. How would you rate your experience?',
  "description" = 'Feedback request after healing — rating buttons — message 1 of 2 — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'feedback_request_1';

-- feedback_request_2  |  {{1}}=FirstName
-- Buttons: Needs Attention
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Thank you for sharing, {{1}}. One more option:',
  "description" = 'Feedback request after healing — message 2 of 2 — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'feedback_request_2';

-- paid_healing_invitation_1  |  {{1}}=FirstName
-- Buttons: Book Next Healing | Explore Healing Packages | Talk to Counsellor
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

We hope your first healing experience was meaningful.

For many people, a single session provides relaxation and clarity. Others find that regular healing sessions help them maintain balance and support their overall well-being over time.

If you feel the experience was beneficial, we would be happy to continue supporting you through individual healing sessions tailored to your needs.

There is no pressure — only an open invitation to continue whenever you feel ready.

How would you like to proceed?',
  "description" = 'Sent after first free healing is completed — message 1 of 2 — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'paid_healing_invitation_1';

-- paid_healing_invitation_2  |  {{1}}=FirstName
-- Buttons: Join Meditation
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'More options for {{1}}:',
  "description" = 'Sent after first free healing is completed — message 2 of 2 — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'paid_healing_invitation_2';

-- next_healing_reminder  |  {{1}}=FirstName
-- Buttons: Book Next Healing | Request Callback | Remind Me Later
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

We hope you are doing well.

Based on your previous healing plan, it may be a good time to schedule your next session.

Regular healing allows your counsellor and healer to monitor your progress and recommend appropriate guidance as your journey continues.

Small, consistent steps often bring meaningful long-term results.

Would you like to schedule your next session?',
  "description" = 'Sent when next healing session is due — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'next_healing_reminder';

-- healing_progress_check_1  |  {{1}}=FirstName
-- Buttons: Feeling Better | Slight Improvement | No Significant Change
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

It has been a few days since your recent healing session, and we wanted to check in with you.

How have you been feeling?

Your feedback helps us understand your progress and recommend the most appropriate next steps.

Even small changes can provide valuable insights into your healing journey.

How would you describe your progress so far?',
  "description" = 'Progress check 7 days after healing — message 1 of 2 — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'healing_progress_check_1';

-- healing_progress_check_2  |  {{1}}=FirstName
-- Buttons: I'd Like to Discuss
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Would you like to speak with someone, {{1}}?',
  "description" = 'Progress check 7 days after healing — message 2 of 2 — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'healing_progress_check_2';

-- ════════════════════════════════════════════════════════════════════
-- PACKAGES & PAYMENTS
-- ════════════════════════════════════════════════════════════════════

-- package_offer  |  {{1}}=FirstName
-- Buttons: View Packages | Talk to Counsellor | Book Single Healing
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Many clients choose healing packages because they provide continuity and convenience while supporting a structured healing journey.

Packages are designed for those who wish to continue regular healing sessions over a period of time.

Your counsellor can help you decide whether a package is appropriate for your individual needs.

We are here to help you choose what is right for you — not simply the largest package.

Which option would you like to explore?',
  "description" = 'Sent manually to offer healing packages — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'package_offer';

-- package_client_1  |  {{1}}=FirstName
-- Auto-sent after payment confirmed — Buttons: Book Next Session | Join Meditation | Join Course
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Thank you for choosing a healing package.

We are honoured to continue supporting your wellness journey.

Your package has been activated successfully.

As a package client you have priority access to our healers. Your counsellor and healer will work with you to ensure each session contributes meaningfully to your overall well-being.

Every healing session is an opportunity to move one step closer to greater balance and harmony.

What would you like to do next?',
  "description" = 'Auto-sent after package payment confirmed — message 1 of 2 — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'package_client_1';

-- package_client_2  |  {{1}}=FirstName
-- Buttons: Renew Package | Request Callback
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'More options for {{1}}:',
  "description" = 'Auto-sent after package payment confirmed — message 2 of 2 — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'package_client_2';

-- low_credits  |  {{1}}=FirstName  {{2}}=RemainingBalance
-- Buttons: Book Next Healing | View Healing Summary | Contact Counsellor
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

We hope you found today''s session beneficial.

Your healing package has been updated.

Remaining Sessions: {{2}}

Whenever you are ready, you may schedule your next appointment at a time convenient for you.

Consistency often plays an important role in any wellness journey. We are here whenever you need us.',
  "description" = 'Sent after healing when credits are running low — {{1}}=FirstName {{2}}=RemainingBalance',
  "updatedAt" = NOW()
WHERE name = 'low_credits';

-- package_renewal  |  {{1}}=FirstName
-- Buttons: Renew Package | Talk to Counsellor | Book Single Healing
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

You have almost completed your current healing package.

We hope these sessions have been valuable and supportive.

If you feel continued healing would benefit you, we would be delighted to help you plan the next phase of your wellness journey.

The decision is always yours, and we will be happy to guide you based on your individual progress.',
  "description" = 'Sent when 1 session remaining in package — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'package_renewal';

-- payment_link  |  {{1}}=FirstName  {{2}}=PackageName  {{3}}=Amount  {{4}}=Credits  {{5}}=PaymentURL
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Here is your secure payment link for the {{2}} package.

Amount: ₹{{3}} ({{4}} healing credits)

Complete your payment here: {{5}}

You will receive a confirmation once payment is complete.

— Life Energy Centre',
  "description" = 'Sent when payment link is generated — {{1}}=Name {{2}}=PackageName {{3}}=Amount {{4}}=Credits {{5}}=PaymentURL',
  "updatedAt" = NOW()
WHERE name = 'payment_link';

-- payment_received  |  {{1}}=FirstName  {{2}}=Amount
-- Buttons: View Receipt | Book Session | Contact Centre
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Thank you.

We have successfully received your payment of ₹{{2}}.

Your payment has been recorded and the corresponding service or package has been activated.

A receipt has been generated and is available in your client portal.

Thank you for placing your trust in us. We look forward to continuing to support your wellness journey.',
  "description" = 'Sent after payment is received — {{1}}=FirstName {{2}}=Amount',
  "updatedAt" = NOW()
WHERE name = 'payment_received';

-- appointment_rescheduled  |  {{1}}=FirstName  {{2}}=NewDate  {{3}}=Time
-- Buttons: View Location | Change Again | Contact Centre
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Your appointment has been successfully rescheduled.

📅 New Date: {{2}}
🕐 Time: {{3}}

We appreciate your update and look forward to welcoming you at the revised schedule.

Life can be busy, and flexibility is part of every journey. We will be here to welcome you at your convenience.',
  "description" = 'Sent when any appointment is rescheduled — {{1}}=FirstName {{2}}=NewDate {{3}}=Time',
  "updatedAt" = NOW()
WHERE name = 'appointment_rescheduled';

-- missed_appointment  |  {{1}}=FirstName
-- Buttons: Reschedule | Request Callback | Join Meditation
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

We noticed that you could not attend your scheduled appointment today.

We hope everything is well.

If you would still like to meet us, we would be happy to arrange another convenient time.

Sometimes a small delay is simply part of the journey. Whenever you are ready, we will be delighted to welcome you.',
  "description" = 'Sent when client misses a scheduled appointment — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'missed_appointment';

-- ════════════════════════════════════════════════════════════════════
-- COURSES
-- ════════════════════════════════════════════════════════════════════

-- course_promotion  |  {{1}}=FirstName
-- Buttons: Learn About the Course | Reserve My Seat | Talk to Counsellor
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Over the past few sessions, you have experienced Pranic Healing personally.

Many clients reach a stage where they wish to understand the principles behind the healing process and learn simple techniques they can apply for themselves and their families.

Our Basic Pranic Healing Course is designed for complete beginners and focuses on practical learning in a simple and structured way.

Learning Pranic Healing is not about becoming a healer — it is about empowering yourself with knowledge and practical skills that can support your daily life.

Whenever you feel ready, we would be delighted to introduce you to this learning journey.

Would you like to know more?',
  "description" = 'Course invitation sent after multiple healing sessions — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'course_promotion';

-- basic_course_information_1  |  {{1}}=FirstName
-- Buttons: Course Details | Reserve My Seat | Talk to Counsellor
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Many people first experience Pranic Healing through counselling or healing sessions. Over time, some decide to learn these simple techniques so they can support their own well-being and help their loved ones.

Our Basic Pranic Healing Course is designed for complete beginners and combines practical learning with guided exercises.

During the course, you will discover:
• The principles of the energy body and chakras
• Simple energy cleansing and energising techniques
• Self-care practices for everyday life
• How to support family members through basic energy techniques

Learning is a journey of self-discovery. We would be delighted to help you take this next step whenever you feel ready.

Would you like to know more?',
  "description" = 'Course details sent after client clicks Learn About the Course — message 1 of 2 — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'basic_course_information_1';

-- basic_course_information_2  |  {{1}}=FirstName
-- Buttons: Join Meditation First
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'More options for {{1}}:',
  "description" = 'Course details — message 2 of 2 — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'basic_course_information_2';

-- course_registration_confirmation  |  {{1}}=FirstName  {{2}}=Date  {{3}}=Venue
-- Buttons: View Location | Course Information | Contact Centre
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Congratulations on registering for the Basic Pranic Healing Course.

We are delighted to welcome you into the Life Energy Centre learning community.

📅 Course Date: {{2}}
📍 Venue: {{3}}

A few days before the course, we will send you everything you need to know to make your learning experience smooth and enjoyable.

We look forward to learning and growing together.',
  "description" = 'Sent after course registration is confirmed — {{1}}=FirstName {{2}}=Date {{3}}=Venue',
  "updatedAt" = NOW()
WHERE name = 'course_registration_confirmation';

-- course_reminder  |  {{1}}=FirstName
-- Buttons: View Location | Contact Centre | Reschedule
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Your Basic Pranic Healing Course is just around the corner.

We hope you are looking forward to this new learning experience.

Please arrive about 15 minutes early to complete the registration process comfortably.

If you have any questions before the course, we are always happy to help.

Every new skill begins with curiosity. We cannot wait to welcome you.',
  "description" = 'Sent 2 days before the Basic Course — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'course_reminder';

-- welcome_student  |  {{1}}=FirstName
-- Buttons: Course Schedule | Contact Coordinator
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Welcome, {{1}}!

Today marks the beginning of a wonderful learning journey.

We hope this course inspires you to understand yourself better, cultivate inner balance, and apply practical techniques in your daily life.

Remember — every expert once started as a beginner.

Our instructors and team are here to support you throughout the programme.

Enjoy the journey and make the most of every session.',
  "description" = 'Sent on the first day of the Basic Course — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'welcome_student';

-- course_completion  |  {{1}}=FirstName
-- Buttons: Join Weekly Meditation | Explore Advanced Courses | Talk to Instructor
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Congratulations on successfully completing the Basic Pranic Healing Course.

We hope the knowledge and practical exercises you learned will continue to support your own well-being and that of your family.

Learning does not end here — it grows through regular practice and continued participation in meditation and future learning opportunities.

May this be the beginning of a lifelong journey of learning and service.',
  "description" = 'Sent after client completes the Basic Pranic Healing Course — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'course_completion';

-- weekly_student_meditation  |  {{1}}=FirstName
-- Buttons: Reserve My Seat | View Schedule
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Regular meditation is one of the simplest ways to reinforce what you have learned and maintain inner balance.

We warmly invite you to join this week''s meditation session and reconnect with the positive energy of our learning community.

Growth happens through consistent practice. We would love to have you with us.',
  "description" = 'Weekly meditation reminder for Basic Course students — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'weekly_student_meditation';

-- advanced_course_invitation  |  {{1}}=FirstName
-- Buttons: Course Details | Reserve Seat | Talk to Instructor
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

As you continue practising what you have learned, you may wish to deepen your understanding through the next level of Pranic Healing training.

Our advanced programmes build upon the strong foundation you have already developed and introduce new concepts and practical applications.

There is no rush — continue whenever you feel the time is right.

Learning is a lifelong journey, and every step opens new possibilities.',
  "description" = 'Invitation to Advanced Pranic Healing Course for eligible students — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'advanced_course_invitation';

-- ════════════════════════════════════════════════════════════════════
-- COMMUNITY & RETENTION
-- ════════════════════════════════════════════════════════════════════

-- referral_invitation  |  {{1}}=FirstName
-- Buttons: Refer a Friend | Contact Us
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

If your experience with Life Energy Centre has been meaningful, perhaps someone close to you may also benefit from our counselling, healing, meditation, or courses.

Referrals are one of the greatest compliments we can receive, and we sincerely appreciate your trust.

Thank you for helping us share wellness and positivity with others.',
  "description" = 'Invitation to refer a friend — sent to satisfied clients — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'referral_invitation';

-- referral_thank_you  |  {{1}}=FirstName  {{2}}=ReferredName  {{3}}=Milestone  {{4}}=Balance
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Thank you for referring {{2}} to us — they have just {{3}}, and we have added 1 free healing credit to your account as a small token of our gratitude.

Your total earned credits: {{4}}

Thank you for being part of our wellness family.

— Life Energy Centre',
  "description" = 'Sent to referrer when referred client reaches a milestone — {{1}}=Name {{2}}=ReferredName {{3}}=Milestone {{4}}=Balance',
  "updatedAt" = NOW()
WHERE name = 'referral_thank_you';

-- birthday_greetings  |  {{1}}=FirstName
-- Buttons: Join Meditation | Book Healing
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Happy Birthday, {{1}}! 🎂

On this special day, everyone at Life Energy Centre wishes you good health, happiness, peace, and continued growth.

May the coming year bring you abundant energy, meaningful experiences, and many reasons to smile.

Thank you for being a part of our wellness family.

Have a wonderful celebration!',
  "description" = 'Birthday greeting sent on client''s birthday — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'birthday_greetings';

-- festival_greetings  |  {{1}}=FirstName
-- Buttons: Join Meditation | Upcoming Events
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Warm Festival Greetings, {{1}}! 🌸

On behalf of the entire team at Life Energy Centre, we wish you and your family joy, peace, harmony, and good health.

May this festive season bring renewed energy, meaningful relationships, and happiness into your life.

Thank you for being a valued member of our community.

Wishing you a wonderful celebration!',
  "description" = 'Festival greeting sent during major holidays — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'festival_greetings';

-- monthly_wellness_checkin_1  |  {{1}}=FirstName
-- Buttons: I'm Doing Well | Book Healing | Join Meditation
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

We hope you are keeping well.

It has been a little while since we last connected, so we simply wanted to check in.

How have you been feeling lately?

Even if you do not need a healing session right now, you are always welcome to join our meditation sessions or speak with one of our counsellors.

Your well-being matters to us, and we are always here whenever you need us.',
  "description" = 'Monthly wellness check-in — message 1 of 2 — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'monthly_wellness_checkin_1';

-- monthly_wellness_checkin_2  |  {{1}}=FirstName
-- Buttons: Talk to Counsellor
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'We are here for you, {{1}}:',
  "description" = 'Monthly wellness check-in — message 2 of 2 — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'monthly_wellness_checkin_2';

-- google_review_request  |  {{1}}=FirstName
-- Buttons: Write Review | Contact Us
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Thank you for sharing your positive experience with us.

If you feel comfortable, we would be grateful if you could share your experience through a Google Review.

Your review may encourage someone else who is looking for support to take the first step towards better well-being.

Thank you for helping us spread positivity and hope.',
  "description" = 'Sent after positive feedback — requesting Google Review — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'google_review_request';

-- welcome_back  |  {{1}}=FirstName
-- Buttons: Book Healing | Talk to Counsellor | Join Meditation
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Welcome back!

It is wonderful to reconnect with you. We hope you have been keeping well.

Our team will be happy to understand what has changed since your last visit and guide you on the next suitable step for your current needs.

Every new beginning is simply a continuation of your journey. We are delighted to welcome you again.',
  "description" = 'Sent when a client returns after a long gap — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'welcome_back';

-- student_anniversary  |  {{1}}=FirstName
-- Buttons: Join Meditation | Advanced Course | Contact Instructor
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Congratulations {{1}}! 🎉

Today marks one year since you completed your Basic Pranic Healing Course.

We hope the knowledge and practices you have learned continue to enrich your life and the lives of those around you.

Thank you for remaining a valued member of our learning community.

Learning grows stronger through regular practice and continued connection. We would love to stay connected with you.',
  "description" = 'Sent 1 year after Basic Course completion — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'student_anniversary';

-- volunteer_invitation  |  {{1}}=FirstName
-- Buttons: I'm Interested | Learn More
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

Many students find joy in giving back by supporting meditation sessions, courses, or community activities.

If you would like to volunteer your time and energy, we would be delighted to welcome you.

Volunteering is a wonderful opportunity to continue learning while serving others.

If this resonates with you, we would love to hear from you.',
  "description" = 'Invitation to volunteer — sent to eligible students — {{1}}=FirstName',
  "updatedAt" = NOW()
WHERE name = 'volunteer_invitation';

-- special_event_invitation  |  {{1}}=FirstName  {{2}}=Date  {{3}}=Time  {{4}}=Venue
-- Buttons: Reserve My Seat | View Location | Contact Centre
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = 'Namaste {{1}} 🙏

We are delighted to invite you to our upcoming special event at Life Energy Centre.

Whether it is a meditation programme, wellness talk, healing camp, or community celebration, we would love to have you join us.

📅 Date: {{2}}
🕐 Time: {{3}}
📍 Venue: {{4}}

Every gathering is an opportunity to learn, connect, and grow together. We hope you will be able to join us.',
  "description" = 'Invitation to a special event — {{1}}=FirstName {{2}}=Date {{3}}=Time {{4}}=Venue',
  "updatedAt" = NOW()
WHERE name = 'special_event_invitation';

-- client_magic_link  |  {{1}}=OTP
UPDATE "WhatsAppTemplate" SET
  "bodyTemplate" = '{{1}} is your Life Energy Centre verification code. For your security, do not share this code with anyone.

Expires in 15 minutes.',
  "description" = 'OTP sent when client logs into the portal — {{1}}=OTP',
  "updatedAt" = NOW()
WHERE name = 'client_magic_link';
