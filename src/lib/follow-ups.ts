// Auto-generated follow-up reminders. Runs opportunistically whenever the
// /follow-ups page loads — idempotent thanks to "doesn't already exist"
// guards. Swap this for a real cron (e.g. Vercel Cron) in production.

import { addDays, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCreditBalance } from "@/lib/credits";

export async function generateFollowUps(): Promise<{ created: number }> {
  const now = new Date();
  let created = 0;

  // 1. Missed counsellings (scheduledAt < now, not done)
  const missedCounsellings = await prisma.counselingSession.findMany({
    where: { doneAt: null, scheduledAt: { lt: now } },
    include: { client: { select: { assignedToId: true } } },
  });
  for (const c of missedCounsellings) {
    const exists = await prisma.followUp.findFirst({
      where: {
        clientId: c.clientId,
        reason: "MISSED_COUNSELING",
        status: { in: ["PENDING", "INTERESTED", "DELAYED"] },
        note: { contains: c.id },
      },
    });
    if (!exists) {
      await prisma.followUp.create({
        data: {
          clientId: c.clientId,
          reason: "MISSED_COUNSELING",
          status: "PENDING",
          dueAt: addDays(now, 1),
          note: `Counselling session ${c.id} missed — was scheduled ${c.scheduledAt.toISOString()}.`,
          assignedToId: c.client.assignedToId,
        },
      });
      created++;
    }
  }

  // 2. Missed visits
  const missedVisits = await prisma.visit.findMany({
    where: { visitedAt: null, scheduledAt: { lt: now } },
    include: { client: { select: { assignedToId: true } } },
  });
  for (const v of missedVisits) {
    const exists = await prisma.followUp.findFirst({
      where: {
        clientId: v.clientId,
        reason: "MISSED_VISIT",
        status: { in: ["PENDING", "INTERESTED", "DELAYED"] },
        note: { contains: v.id },
      },
    });
    if (!exists) {
      await prisma.followUp.create({
        data: {
          clientId: v.clientId,
          reason: "MISSED_VISIT",
          status: "PENDING",
          dueAt: addDays(now, 1),
          note: `Visit ${v.id} missed — was scheduled ${v.scheduledAt.toISOString()}.`,
          assignedToId: v.client.assignedToId,
        },
      });
      created++;
    }
  }

  // 3. Post-visit follow-up 7 days after first completed visit
  const sevenDaysAgo = subDays(now, 7);
  const completedVisits = await prisma.visit.findMany({
    where: {
      visitedAt: { lt: sevenDaysAgo, gt: subDays(now, 30) },
    },
    include: { client: { select: { assignedToId: true } } },
  });
  for (const v of completedVisits) {
    const exists = await prisma.followUp.findFirst({
      where: {
        clientId: v.clientId,
        reason: "POST_VISIT",
        note: { contains: v.id },
      },
    });
    if (!exists) {
      await prisma.followUp.create({
        data: {
          clientId: v.clientId,
          reason: "POST_VISIT",
          status: "PENDING",
          dueAt: now,
          note: `Post-visit check-in for visit ${v.id}.`,
          assignedToId: v.client.assignedToId,
        },
      });
      created++;
    }
  }

  // 4. Pending payments older than 2 days
  const stalePayments = await prisma.payment.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: subDays(now, 2) },
    },
    include: { client: { select: { assignedToId: true } } },
  });
  for (const p of stalePayments) {
    const recentReminder = await prisma.followUp.findFirst({
      where: {
        clientId: p.clientId,
        reason: "PAYMENT_REMINDER",
        createdAt: { gt: subDays(now, 3) },
      },
    });
    if (!recentReminder) {
      await prisma.followUp.create({
        data: {
          clientId: p.clientId,
          reason: "PAYMENT_REMINDER",
          status: "PENDING",
          dueAt: now,
          note: `Pending payment of ₹${p.amount} (${p.id}) from ${p.createdAt.toISOString().slice(0, 10)}.`,
          assignedToId: p.client.assignedToId,
        },
      });
      created++;
    }
  }

  // 5. Low-credit alert: recently active clients (healing in past 30d) at 0 balance
  const recentHealers = await prisma.healingSession.findMany({
    where: { date: { gt: subDays(now, 30) }, creditUsed: true },
    select: { clientId: true },
    distinct: ["clientId"],
  });
  for (const { clientId } of recentHealers) {
    const bal = await getCreditBalance(clientId);
    if (bal > 0) continue;
    const recent = await prisma.followUp.findFirst({
      where: {
        clientId,
        reason: "LOW_CREDITS",
        createdAt: { gt: subDays(now, 14) },
      },
    });
    if (recent) continue;
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { assignedToId: true },
    });
    await prisma.followUp.create({
      data: {
        clientId,
        reason: "LOW_CREDITS",
        status: "PENDING",
        dueAt: now,
        note: `Credit balance is 0 but client had healing in the past 30 days.`,
        assignedToId: client?.assignedToId,
      },
    });
    created++;
  }

  return { created };
}
