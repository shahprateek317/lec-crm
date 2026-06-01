// Seed script — idempotent. Safe to re-run.
// Creates: admin user, initial staff, credit packages, WhatsApp templates,
// and the Pranic Healing course catalog with prerequisite chains.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import type { Role } from "@prisma/client";

// Inline version of encryptForStorage from src/lib/crypto.ts.
// The seed runs via tsx in the Docker runner stage where src/ is not present,
// so we can't import from the app source. Algorithm is identical: AES-256-GCM,
// key = SHA-256(AUTH_SECRET), format = base64(iv||ciphertext||tag).
function seedEncrypt(plaintext: string): string {
  const authSecret = process.env.AUTH_SECRET ?? "";
  const key = crypto.createHash("sha256").update(authSecret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString("base64");
}

const prisma = new PrismaClient();

const ROLE_PREFIX: Record<Role, string> = {
  SUPER_ADMIN: "LEC-SA", ADMIN: "LEC-A", COORDINATOR: "LEC-X",
  COUNSELLOR: "LEC-C", SENIOR_COUNSELLOR: "LEC-CS",
  HEALER: "LEC-H", SENIOR_HEALER: "LEC-HS",
  QUALITY_CONTROLLER: "LEC-Q",
  ACCOUNTS: "LEC-F", MARKETING_MANAGER: "LEC-M", VIEWER: "LEC-V",
};

async function ensureCode(userId: string, role: Role): Promise<void> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { employeeCode: true } });
  if (u?.employeeCode) return;
  const count = await prisma.user.count({ where: { role } });
  await prisma.user.update({
    where: { id: userId },
    data: { employeeCode: `${ROLE_PREFIX[role]}${String(count).padStart(3, "0")}` },
  });
}

async function main() {
  console.log("Seeding Life Energy Centre CRM…");

  // ── Staff ────────────────────────────────────────────────────────────
  // Mobile-friendly credentials for the demo. Short email, no symbols in
  // password. Password is the same across all four so it's easy to remember;
  // roles are differentiated by the email only.
  const staff: Array<{ email: string; name: string; role: "ADMIN" | "COORDINATOR" | "COUNSELLOR" | "HEALER" | "QUALITY_CONTROLLER"; password: string }> = [
    { email: "admin@lec.app",       name: "Admin",              role: "ADMIN",              password: "demo1234" },
    { email: "coordinator@lec.app", name: "Coordinator",        role: "COORDINATOR",        password: "demo1234" },
    { email: "counsellor@lec.app",  name: "Counsellor",         role: "COUNSELLOR",         password: "demo1234" },
    { email: "healer@lec.app",      name: "Healer",             role: "HEALER",             password: "demo1234" },
    { email: "quality@lec.app",     name: "Quality Controller", role: "QUALITY_CONTROLLER", password: "demo1234" },
  ];
  // Fixed TOTP secret used by the demo admin account (admin@lec.app).
  // Smoke scripts generate the live code from this secret with Node crypto
  // so they can sign in as admin without a real phone.
  // NEVER use this secret in production — it is committed to the repo.
  const DEMO_ADMIN_TOTP_SECRET = "LECCRMADMINDEMOSEC";

  for (const s of staff) {
    const passwordHash = await bcrypt.hash(s.password, 10);
    // Pre-enroll TOTP for admin roles so the TOTP enforcement gate doesn't
    // block demo sign-in. The smoke tests generate codes from DEMO_ADMIN_TOTP_SECRET.
    const isAdmin = (s.role as string) === "ADMIN" || (s.role as string) === "SUPER_ADMIN";
    const totpData = isAdmin
      ? {
          totpSecret: seedEncrypt(DEMO_ADMIN_TOTP_SECRET),
          totpEnabledAt: new Date("2026-01-01T00:00:00.000Z"),
        }
      : {};
    const u = await prisma.user.upsert({
      where: { email: s.email },
      update: { name: s.name, role: s.role, active: true, ...totpData },
      create: { email: s.email, name: s.name, role: s.role, active: true, passwordHash, ...totpData },
    });
    await ensureCode(u.id, u.role);
  }
  console.log(`  ✓ ${staff.length} staff accounts (with employee codes)`);

  // Disable legacy seed accounts from earlier iterations so the demo is
  // clean. Don't delete — preserves any history that might reference them.
  await prisma.user.updateMany({
    where: {
      email: {
        in: [
          "admin@lifeenergycentre.local",
          "coordinator@lifeenergycentre.local",
          "counsellor@lifeenergycentre.local",
          "healer@lifeenergycentre.local",
        ],
      },
    },
    data: { active: false },
  });

  // ── Sample role profiles ─────────────────────────────────────────────
  // Populate the new role-specific profile rows so admin sees realistic
  // defaults instead of empty forms.
  const accountsByEmail = new Map((await prisma.user.findMany()).map(u => [u.email, u]));

  const healer = accountsByEmail.get("healer@lec.app") ?? accountsByEmail.get("healer@lifeenergycentre.local");
  if (healer) {
    await prisma.healerProfile.upsert({
      where: { userId: healer.id },
      create: {
        userId: healer.id,
        experienceYears: 6,
        phLevels: ["BPH", "APH", "PSYCHOTHERAPY"],
        languages: ["English", "Bengali", "Hindi"],
        acceptsInPerson: true,
        acceptsDistant: true,
        preferredTimeBands: ["MORNING", "EVENING"],
        availableDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
        availabilitySlots: [
          "MON:MORNING", "MON:EVENING",
          "TUE:MORNING", "TUE:EVENING",
          "WED:MORNING", "WED:EVENING",
          "THU:MORNING", "THU:EVENING",
          "FRI:MORNING", "FRI:EVENING",
          "SAT:MORNING", "SAT:AFTERNOON", "SAT:EVENING",
        ],
        maxHealingsPerDay: 6,
        canVisitCentre: true,
        homeVisitPossible: false,
        acceptsDemoFree: true,
        acceptsNewLeads: true,
        focusAreas: ["Stress", "Back pain", "Anxiety", "Sleep"],
        // Per dad's revised pricing: paid sessions ₹500, demos are free for the
        // client (we still pay the healer their revenue share separately).
        perSessionCharge: 500,
        demoSessionCharge: 0,
        revenueSharePercent: 60,
        paymentMode: "UPI",
        acceptsChildCases: true,
        acceptsElderlyCases: true,
        weekendAvailable: true,
        groupHealingAvailable: false,
      },
      update: {},
    });
  }

  const counsellor = accountsByEmail.get("counsellor@lec.app") ?? accountsByEmail.get("counsellor@lifeenergycentre.local");
  if (counsellor) {
    await prisma.counsellorProfile.upsert({
      where: { userId: counsellor.id },
      create: {
        userId: counsellor.id,
        experienceYears: 4,
        languages: ["English", "Bengali", "Hindi"],
        specializations: ["Stress", "Anxiety", "Emotional healing", "Spiritual guidance"],
        acceptsOnline: true,
        acceptsOffline: true,
        preferredTimeBands: ["MORNING", "AFTERNOON"],
        availabilitySlots: [
          "MON:MORNING", "MON:AFTERNOON",
          "TUE:MORNING", "TUE:AFTERNOON",
          "WED:MORNING", "WED:AFTERNOON",
          "THU:MORNING", "THU:AFTERNOON",
          "FRI:MORNING", "FRI:AFTERNOON",
        ],
        maxSessionsPerDay: 5,
        canCloseLead: false,
        canAssignVisit: true,
        incentiveEligible: true,
      },
      update: {},
    });
  }

  const coordinator = accountsByEmail.get("coordinator@lec.app") ?? accountsByEmail.get("coordinator@lifeenergycentre.local");
  if (coordinator) {
    await prisma.coordinatorProfile.upsert({
      where: { userId: coordinator.id },
      create: {
        userId: coordinator.id,
        handlesLeads: true,
        handlesFollowUp: true,
        handlesWhatsAppGroups: true,
        handlesPaymentFollowUp: true,
        handlesScheduling: true,
        maxCallsPerDay: 40,
        shiftTiming: "10:00 – 18:00",
        languages: ["English", "Bengali", "Hindi"],
      },
      update: {},
    });
  }

  const admin = accountsByEmail.get("admin@lec.app") ?? accountsByEmail.get("admin@lifeenergycentre.local");
  if (admin) {
    await prisma.adminProfile.upsert({
      where: { userId: admin.id },
      create: { userId: admin.id, isSuperAdmin: true },
      update: {},
    });
  }
  console.log(`  ✓ role profiles populated for demo staff`);

  // ── Credit packages ──────────────────────────────────────────────────
  // Dad's revised pricing model (May 2026):
  //   • Single Healing  — ₹500 / session    (1 credit)
  //   • Mini package    — ₹500 = 2 sessions (effectively half-price)
  //   • Standard pack   — ₹1000 = 4 sessions
  //   • Extended pack   — ₹2000 = 8 sessions (best per-session value)
  // The ₹99 introductory program has been retired completely — replaced by
  // free demo sessions to motivate the centre visit, per the new business flow.
  const packages = [
    { name: "Single Healing", amount: 500,  credits: 1, sortOrder: 0 },
    { name: "Mini Pack",      amount: 500,  credits: 2, sortOrder: 1 },
    { name: "Standard Pack",  amount: 1000, credits: 4, sortOrder: 2 },
    { name: "Extended Pack",  amount: 2000, credits: 8, sortOrder: 3 },
  ];
  // Deactivate any prior packages we've renamed so the old IDs don't reappear.
  await prisma.creditPackage.updateMany({
    where: { id: { in: ["pkg_₹99 program", "pkg_starter", "pkg_standard", "pkg_extended"] } },
    data: { active: false },
  });
  for (const p of packages) {
    const id = `pkg_${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
    await prisma.creditPackage.upsert({
      where: { id },
      update: { name: p.name, amount: p.amount, credits: p.credits, sortOrder: p.sortOrder, active: true },
      create: { id, name: p.name, amount: p.amount, credits: p.credits, sortOrder: p.sortOrder, active: true },
    });
  }
  console.log(`  ✓ ${packages.length} credit packages (₹99 program retired)`);

  // ── WhatsApp templates ───────────────────────────────────────────────
  // Bodies follow Meta's {{1}}, {{2}} placeholder convention and match the
  // template names that would be submitted to Meta for approval.
  // Updated May 2026 to mirror dad's revised lead-nurture flow:
  //   Lead → brochure + visit invitation → intro session → free demo healing →
  //   centre visit → free healing → paid healing → courses → referrals.
  const templates = [
    {
      name: "lead_welcome",
      category: "UTILITY",
      description: "Initial welcome with brochure and centre-visit invitation.",
      bodyTemplate:
        "Namaste {{1}} 🙏\n\nThank you for reaching out to Life Energy Centre.\n\nWe'd love to invite you for a *free centre visit* at Pecon Tower, New Town — where you can experience a complimentary Pranic Healing session, learn about our courses, and meet our team.\n\nDownload our brochure here: {{2}}\n\nReply with a date & time that suits you, and our coordinator will confirm. 🙏\n\n— Life Energy Centre",
    },
    {
      name: "intro_session_invitation",
      category: "UTILITY",
      description: "Sent if the lead doesn't respond to the welcome — invites them to a free online introductory session + meditation.",
      bodyTemplate:
        "Namaste {{1}} 🙏\n\nWe noticed you haven't been able to visit yet. Would you like to join our *free online introductory session* on Pranic Healing? It includes a guided meditation and a short Q&A.\n\nNext session: {{2}}\nJoin link: {{3}}\n\nNo obligation — come, experience, decide. 🙏\n\n— Life Energy Centre",
    },
    {
      name: "demo_healing_offer",
      category: "UTILITY",
      description: "Sent if the lead still hasn't engaged — offers a free demo distant healing session.",
      bodyTemplate:
        "Namaste {{1}} 🙏\n\nWe'd like to offer you a *free demo healing session* — done remotely (distant healing), no need to travel. You'll likely feel the difference within a day.\n\nReply with a convenient 30-minute window and we'll schedule a healer to send healing energy at that time.\n\n— Life Energy Centre",
    },
    {
      name: "counseling_confirmation",
      category: "UTILITY",
      description: "Counselling session booked — confirmation.",
      bodyTemplate:
        "Namaste {{1}} 🙏\n\nYour online counselling session is confirmed for {{2}} with {{3}}. Please keep a quiet space ready. The coordinator will share the link shortly.\n\n— Life Energy Centre",
    },
    {
      name: "counseling_reminder_1d",
      category: "UTILITY",
      description: "1-day reminder before counselling.",
      bodyTemplate:
        "Gentle reminder: your online counselling with {{2}} is tomorrow at {{1}}. We look forward to meeting you. 🙏\n\n— Life Energy Centre",
    },
    {
      name: "counseling_reminder_1h",
      category: "UTILITY",
      description: "1-hour reminder before counselling.",
      bodyTemplate:
        "Your online counselling begins in 1 hour. Please settle into a quiet space. 🙏\n\n— Life Energy Centre",
    },
    {
      name: "visit_invitation",
      category: "UTILITY",
      description: "Post-counselling invitation to book a centre visit.",
      bodyTemplate:
        "Namaste {{1}} 🙏\n\nThank you for the counselling session. We'd like to invite you to visit us at Pecon Tower, New Town for a healing session. Please share a date & time that suits you and we'll confirm.\n\n— Life Energy Centre",
    },
    {
      name: "visit_confirmation",
      category: "UTILITY",
      description: "Visit scheduled — confirmation.",
      bodyTemplate:
        "Your visit to Life Energy Centre is confirmed for {{1}}. Address: Pecon Tower, 2nd Floor, behind Tata Medical Centre, New Town, Kolkata. 🙏",
    },
    {
      name: "visit_reminder_1d",
      category: "UTILITY",
      description: "1-day reminder before visit.",
      bodyTemplate:
        "Gentle reminder: your visit to Life Energy Centre is tomorrow at {{1}}. See you soon. 🙏",
    },
    {
      name: "payment_link",
      category: "UTILITY",
      description: "Payment link for a healing credit package.",
      bodyTemplate:
        "Namaste {{1}} 🙏\n\nHere is your secure payment link for the {{2}} package (₹{{3}} — {{4}} healing credits):\n{{5}}\n\nYou'll receive a confirmation once payment is complete.\n\n— Life Energy Centre",
    },
    {
      name: "low_credits",
      category: "UTILITY",
      description: "Alert when credits are low or zero.",
      bodyTemplate:
        "Namaste {{1}} 🙏\n\nYour healing credit balance is {{2}}. To continue sessions, please top up via one of our packages. Reply to this message and we'll share a payment link.\n\n— Life Energy Centre",
    },
    {
      name: "healer_assignment",
      category: "UTILITY",
      description: "Sent to a healer when a client session is auto-assigned to them.",
      bodyTemplate:
        "Namaste {{1}} 🙏\n\nA new session has been assigned to you:\n\n*Client:* {{2}}\n*When:* {{3}}\n\nPlease confirm you can take it. — Life Energy Centre",
    },
    {
      name: "feedback_request",
      category: "UTILITY",
      description: "Request feedback after a healing session.",
      bodyTemplate:
        "Namaste {{1}} 🙏\n\nHow are you feeling after today's healing session? Please share any changes — energy, pain levels, sleep, mood — however small. Your feedback helps us support you better.\n\n— Life Energy Centre",
    },
    {
      name: "package_offer",
      category: "MARKETING",
      description: "Soft pitch for a healing package after a demo or first paid session.",
      bodyTemplate:
        "Namaste {{1}} 🙏\n\nGlad you found value in your recent healing session. To continue the journey, we offer healing packages:\n\n• *Single* — ₹500 / session\n• *Mini Pack* — ₹500 = 2 sessions\n• *Standard* — ₹1000 = 4 sessions\n• *Extended* — ₹2000 = 8 sessions\n\nReply with your choice and we'll send a secure payment link.\n\n— Life Energy Centre",
    },
    {
      name: "course_promotion",
      category: "MARKETING",
      description: "Promotes the Basic Pranic Healing course after a few healing sessions.",
      bodyTemplate:
        "Namaste {{1}} 🙏\n\nMany of our clients ask: *can I learn to heal myself and my family?* — yes, and the journey starts with the *Basic Pranic Healing* course.\n\n• 2-day weekend workshop\n• Certified by MCKS\n• Lifelong technique you can practise at home\n\nNext batch: {{2}}\nFee: ₹{{3}} (paid healing credits adjustable)\n\nReply *YES* to reserve a seat.\n\n— Life Energy Centre",
    },
    {
      name: "dormant_reactivation",
      category: "MARKETING",
      description: "Periodic touchpoint for cold/dormant leads — meditation invite, video, or event.",
      bodyTemplate:
        "Namaste {{1}} 🙏\n\nIt's been a while — we hope you're well. We're hosting a free guided meditation this {{2}}. A short break from the day, with collective healing energy. 🌸\n\nJoin link: {{3}}\n\n— Life Energy Centre",
    },
    {
      name: "referral_thank_you",
      category: "UTILITY",
      description: "Sent to a client when their referral books a centre visit or buys a package — confirms the free healing credit awarded.",
      bodyTemplate:
        "Namaste {{1}} 🙏\n\nThank you for referring {{2}} to us — they've just {{3}}, and we've added *1 free healing credit* to your account as a small token of our gratitude.\n\nYour total earned credits: {{4}}\n\n— Life Energy Centre",
    },
    {
      name: "session_check_in_start",
      category: "UTILITY",
      description: "One-tap session-start confirmation — sent when the healer marks the session as begun.",
      bodyTemplate:
        "Namaste {{1}} 🙏\n\nYour healing session with {{2}} has begun. Please confirm by tapping the link below — this helps us keep accurate session records:\n\n{{3}}\n\nThank you 🌸\n— Life Energy Centre",
    },
    {
      name: "session_check_in_end",
      category: "UTILITY",
      description: "One-tap session-end confirmation — sent when the healer marks the session as ended.",
      bodyTemplate:
        "Namaste {{1}} 🙏\n\nYour healing session with {{2}} ({{3}} – now) has ended. Please confirm by tapping the link below:\n\n{{4}}\n\nWe'll send a short feedback request next. 🙏\n— Life Energy Centre",
    },
    {
      // Phase 1b — passwordless client portal auth.
      // {{1}} client first name, {{2}} 6-digit OTP, {{3}} magic-link URL
      name: "client_magic_link",
      category: "AUTHENTICATION",
      description: "Passwordless sign-in to the client portal — OTP + tap-to-sign-in link, expires in 15 minutes.",
      bodyTemplate:
        "Namaste {{1}} 🙏\n\nYour Life Energy Centre sign-in code is:\n\n*{{2}}*\n\nOr tap to sign in instantly:\n{{3}}\n\nThis code is valid for 15 minutes. If you didn't request this, ignore this message.",
    },
    {
      // Phase 2b — pre-session reminder cron.
      // {{1}} client first name, {{2}} healer name, {{3}} session time (e.g. "5:30 PM"),
      // {{4}} mode label ("in person at the centre" or "distant healing")
      name: "healing_reminder_1h",
      category: "UTILITY",
      description: "1-hour reminder before a scheduled healing session.",
      bodyTemplate:
        "Namaste {{1}} 🙏\n\nA gentle reminder — your healing session with {{2}} starts in about an hour at {{3}} ({{4}}).\n\nPlease be settled and quiet a few minutes before we begin.\n\n— Life Energy Centre",
    },
  ];
  for (const t of templates) {
    await prisma.whatsAppTemplate.upsert({
      where: { name: t.name },
      update: { category: t.category, bodyTemplate: t.bodyTemplate, description: t.description, active: true },
      create: { name: t.name, category: t.category, bodyTemplate: t.bodyTemplate, description: t.description, active: true, language: "en" },
    });
  }
  console.log(`  ✓ ${templates.length} WhatsApp templates`);

  // ── Courses & prerequisites ──────────────────────────────────────────
  // Standard Pranic Healing curriculum (MCKS-affiliated). Fees are indicative —
  // Admin can adjust in the UI later.
  const courses: Array<{ slug: string; name: string; description: string; fee: number; hours: number; sortOrder: number; prereqs: string[] }> = [
    { slug: "bph",   name: "Basic Pranic Healing",                 description: "Foundation course — energy anatomy, basic sweeping & energising.", fee: 8000,  hours: 20, sortOrder: 1,  prereqs: [] },
    { slug: "aph",   name: "Advanced Pranic Healing",              description: "Colour pranic healing and advanced techniques.",                   fee: 9000,  hours: 16, sortOrder: 2,  prereqs: ["bph"] },
    { slug: "ppsy",  name: "Pranic Psychotherapy",                 description: "Energetic treatment of emotional/mental conditions.",              fee: 9000,  hours: 16, sortOrder: 3,  prereqs: ["aph"] },
    { slug: "pcry",  name: "Pranic Crystal Healing",               description: "Working with crystals to amplify pranic healing.",                 fee: 9000,  hours: 16, sortOrder: 4,  prereqs: ["aph"] },
    { slug: "ppsd",  name: "Practical Psychic Self Defence",       description: "Protecting self and space energetically.",                         fee: 7000,  hours: 14, sortOrder: 5,  prereqs: ["bph"] },
    { slug: "pwl",   name: "Pranic Weight Loss & Body Sculpting",  description: "Pranic techniques for body re-shaping.",                           fee: 7000,  hours: 12, sortOrder: 6,  prereqs: ["aph"] },
    { slug: "arh",   name: "Arhatic Yoga (Preparatory)",           description: "Spiritual practices — meditation on twin hearts and more.",         fee: 12000, hours: 24, sortOrder: 7,  prereqs: ["aph", "ppsy"] },
    { slug: "shb",   name: "Superbrain Yoga",                      description: "Standalone practice for cognitive vitality.",                       fee: 3500,  hours: 4,  sortOrder: 8,  prereqs: [] },
    { slug: "kriya", name: "Kriyashakti (Material Manifestation)", description: "Prosperity-series practice. Requires Basic PH.",                   fee: 9000,  hours: 12, sortOrder: 9,  prereqs: ["bph"] },
    { slug: "fs",    name: "Pranic Feng Shui",                     description: "Energetic space design.",                                          fee: 9000,  hours: 12, sortOrder: 10, prereqs: ["bph"] },
  ];
  for (const c of courses) {
    await prisma.course.upsert({
      where: { name: c.name },
      update: { description: c.description, fee: c.fee, durationHours: c.hours, sortOrder: c.sortOrder, active: true },
      create: { name: c.name, description: c.description, fee: c.fee, durationHours: c.hours, sortOrder: c.sortOrder, active: true },
    });
  }
  const allCourses = await prisma.course.findMany();
  const courseIdBySlug = new Map<string, string>();
  for (const c of courses) {
    const dbCourse = allCourses.find((x) => x.name === c.name);
    if (dbCourse) courseIdBySlug.set(c.slug, dbCourse.id);
  }
  await prisma.coursePrerequisite.deleteMany();
  for (const c of courses) {
    const courseId = courseIdBySlug.get(c.slug);
    if (!courseId) continue;
    for (const p of c.prereqs) {
      const prereqId = courseIdBySlug.get(p);
      if (!prereqId) continue;
      await prisma.coursePrerequisite.create({
        data: { courseId, prerequisiteId: prereqId },
      });
    }
  }
  console.log(`  ✓ ${courses.length} courses with prerequisite graph`);

  console.log("Seed complete.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
