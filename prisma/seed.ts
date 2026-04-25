// Seed script — idempotent. Safe to re-run.
// Creates: admin user, initial staff, credit packages, WhatsApp templates,
// and the Pranic Healing course catalog with prerequisite chains.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

const prisma = new PrismaClient();

const ROLE_PREFIX: Record<Role, string> = {
  SUPER_ADMIN: "LEC-SA", ADMIN: "LEC-A", COORDINATOR: "LEC-X",
  COUNSELLOR: "LEC-C", SENIOR_COUNSELLOR: "LEC-CS",
  HEALER: "LEC-H", SENIOR_HEALER: "LEC-HS",
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
  const staff: Array<{ email: string; name: string; role: "ADMIN" | "COORDINATOR" | "COUNSELLOR" | "HEALER"; password: string }> = [
    { email: "admin@lec.app",       name: "Admin",       role: "ADMIN",       password: "demo1234" },
    { email: "coordinator@lec.app", name: "Coordinator", role: "COORDINATOR", password: "demo1234" },
    { email: "counsellor@lec.app",  name: "Counsellor",  role: "COUNSELLOR",  password: "demo1234" },
    { email: "healer@lec.app",      name: "Healer",      role: "HEALER",      password: "demo1234" },
  ];
  for (const s of staff) {
    const passwordHash = await bcrypt.hash(s.password, 10);
    const u = await prisma.user.upsert({
      where: { email: s.email },
      update: { name: s.name, role: s.role, active: true },
      create: { email: s.email, name: s.name, role: s.role, active: true, passwordHash },
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
        perSessionCharge: 500,
        demoSessionCharge: 99,
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
        canOffer99Program: true,
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
  const packages = [
    { name: "₹99 Program", amount: 99,   credits: 1, sortOrder: 0 },
    { name: "Starter",     amount: 500,  credits: 2, sortOrder: 1 },
    { name: "Standard",    amount: 1000, credits: 4, sortOrder: 2 },
    { name: "Extended",    amount: 2000, credits: 8, sortOrder: 3 },
  ];
  for (const p of packages) {
    await prisma.creditPackage.upsert({
      where: { id: `pkg_${p.name.toLowerCase()}` },
      update: { amount: p.amount, credits: p.credits, sortOrder: p.sortOrder, active: true },
      create: { id: `pkg_${p.name.toLowerCase()}`, name: p.name, amount: p.amount, credits: p.credits, sortOrder: p.sortOrder, active: true },
    });
  }
  console.log(`  ✓ ${packages.length} credit packages`);

  // ── WhatsApp templates ───────────────────────────────────────────────
  // Bodies follow Meta's {{1}}, {{2}} placeholder convention and match the
  // template names that would be submitted to Meta for approval.
  const templates = [
    {
      name: "lead_welcome",
      category: "UTILITY",
      description: "Sent right after a new enquiry is captured.",
      bodyTemplate:
        "Namaste {{1}} 🙏\n\nThank you for reaching out to Life Energy Centre. We've received your enquiry and a coordinator will call you shortly to schedule an online counselling session.\n\n— Life Energy Centre, New Town, Kolkata",
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
      name: "feedback_request",
      category: "UTILITY",
      description: "Request feedback after a healing session.",
      bodyTemplate:
        "Namaste {{1}} 🙏\n\nHow are you feeling after today's healing session? Please share any changes — energy, pain levels, sleep, mood — however small. Your feedback helps us support you better.\n\n— Life Energy Centre",
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
