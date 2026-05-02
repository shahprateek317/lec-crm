// Helpers for counselling sessions and visits. Keep all create/complete
// logic here so it can be invoked from server actions and API routes with
// identical semantics.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { transitionStage } from "@/lib/pipeline";
import { getWhatsAppProvider } from "@/lib/providers/whatsapp";
import { pickHealer, pickCounsellor } from "@/lib/assignment";
import { format } from "date-fns";

// ── Counselling ─────────────────────────────────────────────────────────
export const counselingScheduleSchema = z.object({
  clientId: z.string().min(1),
  // Optional — when omitted, scheduleCounseling will auto-pick a counsellor
  // via pickCounsellor and throw if no match is found.
  counsellorId: z.string().optional(),
  scheduledAt: z.coerce.date(),
  byUserId: z.string().min(1),
});

export async function scheduleCounseling(input: z.infer<typeof counselingScheduleSchema>) {
  const parsed = counselingScheduleSchema.parse(input);

  // Auto-assignment fallback when counsellor wasn't picked manually.
  let counsellorId = parsed.counsellorId;
  if (!counsellorId) {
    const picked = await pickCounsellor(parsed.clientId, parsed.scheduledAt);
    if (!picked) {
      throw new Error("No counsellor matches this client right now. Please pick one manually or adjust their availability in Settings → Staff.");
    }
    counsellorId = picked.id;
  }

  const session = await prisma.counselingSession.create({
    data: {
      clientId: parsed.clientId,
      counsellorId,
      scheduledAt: parsed.scheduledAt,
    },
    include: { counsellor: true, client: true },
  });
  await transitionStage({
    clientId: parsed.clientId,
    toStage: "COUNSELING_SCHEDULED",
    byUserId: parsed.byUserId,
    note: `Counselling with ${session.counsellor.name} at ${format(parsed.scheduledAt, "dd MMM yyyy HH:mm")}`,
  });
  getWhatsAppProvider()
    .sendTemplate({
      clientId: parsed.clientId,
      phone: session.client.phone,
      templateName: "counseling_confirmation",
      variables: [
        session.client.name.split(" ")[0],
        format(parsed.scheduledAt, "dd MMM, HH:mm"),
        session.counsellor.name,
      ],
    })
    .catch((err) => console.error("[scheduling] counseling confirm WhatsApp failed", err));
  return session;
}

export const counselingCompleteSchema = z.object({
  sessionId: z.string().min(1),
  issueRefined: z.string().max(2000).optional(),
  severity: z.coerce.number().int().min(1).max(10).optional(),
  keyNotes: z.string().max(5000).optional(),
  byUserId: z.string().min(1),
});

export async function completeCounseling(input: z.infer<typeof counselingCompleteSchema>) {
  const parsed = counselingCompleteSchema.parse(input);
  const session = await prisma.counselingSession.update({
    where: { id: parsed.sessionId },
    data: {
      doneAt: new Date(),
      issueRefined: parsed.issueRefined,
      severity: parsed.severity,
      keyNotes: parsed.keyNotes,
    },
  });
  // Write refinement back to the client record too.
  await prisma.client.update({
    where: { id: session.clientId },
    data: {
      issueRefined: parsed.issueRefined,
      severity: parsed.severity,
    },
  });
  await transitionStage({
    clientId: session.clientId,
    toStage: "COUNSELING_DONE",
    byUserId: parsed.byUserId,
  });
  const client = await prisma.client.findUniqueOrThrow({ where: { id: session.clientId } });
  getWhatsAppProvider()
    .sendTemplate({
      clientId: client.id,
      phone: client.phone,
      templateName: "visit_invitation",
      variables: [client.name.split(" ")[0]],
    })
    .catch((err) => console.error("[scheduling] visit invitation WhatsApp failed", err));
  return session;
}

// ── Visits ─────────────────────────────────────────────────────────────
export const visitScheduleSchema = z.object({
  clientId: z.string().min(1),
  assignedHealerId: z.string().optional(),
  scheduledAt: z.coerce.date(),
  byUserId: z.string().min(1),
});

export async function scheduleVisit(input: z.infer<typeof visitScheduleSchema>) {
  const parsed = visitScheduleSchema.parse(input);

  // Auto-assignment: if the coordinator didn't pick a healer, run the
  // assignment engine. Returns null when no qualified healer is available
  // — in that case we still create the visit (unassigned) so the slot is
  // booked, and the coordinator can assign later.
  let assignedHealerId = parsed.assignedHealerId;
  if (!assignedHealerId) {
    const picked = await pickHealer(parsed.clientId, "IN_PERSON", parsed.scheduledAt);
    if (picked) assignedHealerId = picked.id;
  }

  const visit = await prisma.visit.create({
    data: {
      clientId: parsed.clientId,
      assignedHealerId,
      scheduledAt: parsed.scheduledAt,
    },
  });
  const client = await prisma.client.findUniqueOrThrow({ where: { id: parsed.clientId } });
  await transitionStage({
    clientId: parsed.clientId,
    toStage: "VISIT_SCHEDULED",
    byUserId: parsed.byUserId,
    note: `Visit at ${format(parsed.scheduledAt, "dd MMM yyyy HH:mm")}`,
  });
  getWhatsAppProvider()
    .sendTemplate({
      clientId: parsed.clientId,
      phone: client.phone,
      templateName: "visit_confirmation",
      variables: [format(parsed.scheduledAt, "dd MMM, HH:mm")],
    })
    .catch((err) => console.error("[scheduling] visit confirm WhatsApp failed", err));

  // Notify the assigned healer (if any). Their phone may be on the User
  // record; fall back to whatsappPhone if set.
  if (assignedHealerId) {
    const healer = await prisma.user.findUnique({
      where: { id: assignedHealerId },
      select: { name: true, phone: true, whatsappPhone: true },
    });
    const healerPhone = healer?.whatsappPhone ?? healer?.phone;
    if (healer && healerPhone) {
      getWhatsAppProvider()
        .sendTemplate({
          phone: healerPhone,
          templateName: "healer_assignment",
          variables: [
            healer.name.split(" ")[0],
            client.name,
            format(parsed.scheduledAt, "dd MMM, HH:mm"),
          ],
        })
        .catch((err) => console.error("[scheduling] healer_assignment WhatsApp failed", err));
    }
  }
  return visit;
}

export const visitCompleteSchema = z.object({
  visitId: z.string().min(1),
  initialFeedback: z.string().max(5000).optional(),
  notes: z.string().max(5000).optional(),
  byUserId: z.string().min(1),
});

export async function completeVisit(input: z.infer<typeof visitCompleteSchema>) {
  const parsed = visitCompleteSchema.parse(input);
  const visit = await prisma.visit.update({
    where: { id: parsed.visitId },
    data: {
      visitedAt: new Date(),
      initialFeedback: parsed.initialFeedback,
      notes: parsed.notes,
    },
  });
  await transitionStage({
    clientId: visit.clientId,
    toStage: "VISIT_DONE",
    byUserId: parsed.byUserId,
  });
  return visit;
}
