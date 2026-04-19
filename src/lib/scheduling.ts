// Helpers for counselling sessions and visits. Keep all create/complete
// logic here so it can be invoked from server actions and API routes with
// identical semantics.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { transitionStage } from "@/lib/pipeline";
import { getWhatsAppProvider } from "@/lib/providers/whatsapp";
import { format } from "date-fns";

// ── Counselling ─────────────────────────────────────────────────────────
export const counselingScheduleSchema = z.object({
  clientId: z.string().min(1),
  counsellorId: z.string().min(1),
  scheduledAt: z.coerce.date(),
  byUserId: z.string().min(1),
});

export async function scheduleCounseling(input: z.infer<typeof counselingScheduleSchema>) {
  const parsed = counselingScheduleSchema.parse(input);
  const session = await prisma.counselingSession.create({
    data: {
      clientId: parsed.clientId,
      counsellorId: parsed.counsellorId,
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
  const visit = await prisma.visit.create({
    data: {
      clientId: parsed.clientId,
      assignedHealerId: parsed.assignedHealerId,
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
