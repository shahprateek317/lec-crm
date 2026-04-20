// Seeds realistic-looking demo data to make the dashboard meaningful at first
// glance. Every record is prefixed [Demo] so it's obvious to real users.
// Safe to run multiple times (upsert by phone).

import { PrismaClient } from "@prisma/client";
import { subDays, subHours } from "date-fns";

const prisma = new PrismaClient();

const DEMO_CLIENTS = [
  {
    name: "[Demo] Ramesh Kumar",
    phone: "+919000001001",
    age: 52, area: "Salt Lake",
    issue: "Chronic lower back pain since 2 years",
    issueDuration: "2 years",
    stage: "NEW" as const,
    source: "FACEBOOK" as const,
    daysAgo: 0,
  },
  {
    name: "[Demo] Priya Sen",
    phone: "+919000001002",
    age: 38, area: "New Town",
    issue: "Anxiety and sleep disturbance",
    issueDuration: "6 months",
    stage: "CONTACTED" as const,
    source: "INSTAGRAM" as const,
    daysAgo: 1,
  },
  {
    name: "[Demo] Arjun Banerjee",
    phone: "+919000001003",
    age: 45, area: "Park Street",
    issue: "Stress-related migraines",
    issueDuration: "1 year",
    stage: "COUNSELING_SCHEDULED" as const,
    source: "REFERRAL" as const,
    daysAgo: 2,
  },
  {
    name: "[Demo] Meera Dasgupta",
    phone: "+919000001004",
    age: 60, area: "Dum Dum",
    issue: "Post-surgery recovery, knee joint",
    issueDuration: "3 months",
    stage: "VISIT_SCHEDULED" as const,
    source: "WHATSAPP" as const,
    daysAgo: 4,
  },
  {
    name: "[Demo] Sanjay Roy",
    phone: "+919000001005",
    age: 48, area: "Howrah",
    issue: "Type-2 diabetes management",
    issueDuration: "5 years",
    stage: "HEALING_ACTIVE" as const,
    source: "REFERRAL" as const,
    daysAgo: 14,
    severity: 6,
    issueRefined: "Type-2 diabetes with fatigue; stabilised HbA1c at 7.2",
  },
  {
    name: "[Demo] Kavita Iyer",
    phone: "+919000001006",
    age: 35, area: "New Town",
    issue: "Thyroid imbalance and low energy",
    issueDuration: "1.5 years",
    stage: "CONVERTED" as const,
    source: "INSTAGRAM" as const,
    daysAgo: 30,
    severity: 5,
    issueRefined: "Hypothyroid, improving energy, completed basic healing series",
  },
  {
    name: "[Demo] Rahul Gupta",
    phone: "+919000001007",
    age: 29, area: "Garia",
    issue: "Shoulder pain after accident",
    issueDuration: "4 months",
    stage: "ON_HOLD" as const,
    source: "MANUAL" as const,
    daysAgo: 10,
  },
  {
    name: "[Demo] Anjali Mehra",
    phone: "+919000001008",
    age: 42, area: "Ballygunge",
    issue: "Emotional healing after loss",
    issueDuration: "8 months",
    stage: "VISIT_DONE" as const,
    source: "REFERRAL" as const,
    daysAgo: 7,
    severity: 7,
  },
];

async function main() {
  console.log("Seeding demo data…");

  const [coordinator, counsellor, healer] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "coordinator@lifeenergycentre.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "counsellor@lifeenergycentre.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "healer@lifeenergycentre.local" } }),
  ]);

  for (const d of DEMO_CLIENTS) {
    const createdAt = subDays(new Date(), d.daysAgo);
    const client = await prisma.client.upsert({
      where: { phone: d.phone },
      update: {},
      create: {
        name: d.name,
        phone: d.phone,
        age: d.age,
        area: d.area,
        issue: d.issue,
        issueDuration: d.issueDuration,
        issueRefined: d.issueRefined,
        severity: d.severity,
        source: d.source,
        stage: d.stage,
        assignedToId: coordinator.id,
        createdAt,
        convertedAt: d.stage === "CONVERTED" ? subDays(new Date(), 2) : null,
        stageTransitions: {
          create: { toStage: d.stage, note: "Demo seed", at: createdAt },
        },
      },
    });

    // Stage-specific extras
    if (d.stage === "COUNSELING_SCHEDULED" || d.stage === "VISIT_SCHEDULED") {
      const existing = await prisma.counselingSession.findFirst({ where: { clientId: client.id } });
      if (!existing) {
        await prisma.counselingSession.create({
          data: {
            clientId: client.id,
            counsellorId: counsellor.id,
            scheduledAt: d.stage === "COUNSELING_SCHEDULED"
              ? subHours(new Date(), -24)
              : subDays(new Date(), 2),
            doneAt: d.stage === "VISIT_SCHEDULED" ? subDays(new Date(), 2) : null,
            keyNotes: d.stage === "VISIT_SCHEDULED" ? "Open to healing sessions; booking a visit." : undefined,
          },
        });
      }
    }

    if (d.stage === "VISIT_SCHEDULED") {
      const existingVisit = await prisma.visit.findFirst({ where: { clientId: client.id } });
      if (!existingVisit) {
        await prisma.visit.create({
          data: {
            clientId: client.id,
            assignedHealerId: healer.id,
            scheduledAt: subHours(new Date(), -48),
          },
        });
      }
    }

    if (d.stage === "VISIT_DONE" || d.stage === "HEALING_ACTIVE" || d.stage === "CONVERTED") {
      const existingVisit = await prisma.visit.findFirst({ where: { clientId: client.id, visitedAt: { not: null } } });
      if (!existingVisit) {
        await prisma.visit.create({
          data: {
            clientId: client.id,
            assignedHealerId: healer.id,
            scheduledAt: subDays(new Date(), 6),
            visitedAt: subDays(new Date(), 6),
            initialFeedback: "Felt lighter and calmer after session.",
          },
        });
      }
    }

    if (d.stage === "HEALING_ACTIVE" || d.stage === "CONVERTED") {
      // Create a paid payment + credits + some healing sessions
      const priorPayment = await prisma.payment.findFirst({ where: { clientId: client.id, status: "PAID" } });
      if (!priorPayment) {
        const pkg = await prisma.creditPackage.findFirst({ where: { credits: 8 } });
        const payment = await prisma.payment.create({
          data: {
            clientId: client.id,
            packageId: pkg?.id,
            amount: 2000,
            creditsGranted: 8,
            status: "PAID",
            provider: "MANUAL",
            paidAt: subDays(new Date(), 12),
            notes: "Demo: 8-credit package",
          },
        });
        await prisma.creditLedgerEntry.create({
          data: {
            clientId: client.id,
            delta: 8,
            balanceAfter: 8,
            reason: "Package purchase",
            paymentId: payment.id,
            at: subDays(new Date(), 12),
          },
        });
        // Log some healing sessions
        let balance = 8;
        for (let i = 0; i < 5; i++) {
          const session = await prisma.healingSession.create({
            data: {
              clientId: client.id,
              healerId: healer.id,
              mode: i % 2 === 0 ? "IN_PERSON" : "DISTANT",
              date: subDays(new Date(), 11 - i * 2),
              chakras: ["HEART", "SOLAR_PLEXUS_FRONT", "SOLAR_PLEXUS_BACK"],
              process: "General sweeping + localised",
              durationMinutes: 30 + i * 5,
              remarks: "Energy visibly brighter; client reports reduced tension.",
              creditUsed: true,
            },
          });
          balance--;
          await prisma.creditLedgerEntry.create({
            data: {
              clientId: client.id,
              delta: -1,
              balanceAfter: balance,
              reason: "Healing session",
              healingSessionId: session.id,
              at: session.date,
            },
          });
        }
      }
    }

    if (d.stage === "HEALING_ACTIVE") {
      // Distant healing group + a couple of updates
      const existingGroup = await prisma.distantHealingGroup.findUnique({ where: { clientId: client.id } });
      if (!existingGroup) {
        const g = await prisma.distantHealingGroup.create({
          data: {
            clientId: client.id,
            whatsappGroupName: `Healing – ${d.name.replace("[Demo] ", "")}`,
            problemAreas: "Pancreas, solar plexus region, general vitality",
            active: true,
          },
        });
        await prisma.healerUpdate.create({
          data: {
            distantGroupId: g.id,
            healerId: healer.id,
            chakras: ["SOLAR_PLEXUS_FRONT", "NAVEL", "MENG_MEIN"],
            process: "Localised sweeping with blue-violet prana",
            durationMinutes: 25,
            remarks: "Pancreas region visibly clearer today.",
            date: subHours(new Date(), -18),
            postedToWhatsAppAt: subHours(new Date(), -18),
          },
        });
        await prisma.clientFeedback.create({
          data: {
            clientId: client.id,
            content: "Felt much calmer this morning. Slept 7 hours straight — first time in months.",
            rating: 5,
            submittedAt: subHours(new Date(), -16),
          },
        });
      }
    }

    if (d.stage === "CONVERTED") {
      const bph = await prisma.course.findFirst({ where: { name: { startsWith: "Basic Pranic" } } });
      if (bph) {
        const existing = await prisma.enrollment.findUnique({
          where: { clientId_courseId: { clientId: client.id, courseId: bph.id } },
        });
        if (!existing) {
          await prisma.enrollment.create({
            data: {
              clientId: client.id,
              courseId: bph.id,
              status: "COMPLETED",
              feePaid: 8000,
              enrolledAt: subDays(new Date(), 20),
              completedAt: subDays(new Date(), 5),
            },
          });
        }
      }
    }
  }

  // A pending payment on the visit-done client so /payments has something to act on
  const anjali = await prisma.client.findUnique({ where: { phone: "+919000001008" } });
  if (anjali) {
    const pending = await prisma.payment.findFirst({ where: { clientId: anjali.id, status: "PENDING" } });
    if (!pending) {
      await prisma.payment.create({
        data: {
          clientId: anjali.id,
          amount: 1000,
          creditsGranted: 4,
          status: "PENDING",
          providerPaymentLinkUrl: `/dev/pay/demo-anjali-pending`,
          providerPaymentLinkId: "demo-anjali-pending",
          notes: "Demo: 4-credit package payment link sent",
          createdAt: subDays(new Date(), 3),
        },
      });
    }
  }

  console.log(`Demo seeded: ${DEMO_CLIENTS.length} sample clients with varied pipeline states.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
