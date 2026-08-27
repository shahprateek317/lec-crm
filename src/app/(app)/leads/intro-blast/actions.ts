"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import { getWhatsAppProvider } from "@/lib/providers/whatsapp";

// Returns the date of the last intro_session_invitation batch sent,
// or null if none ever sent.
async function lastIntroBatchSentAt(): Promise<Date | null> {
  const template = await prisma.whatsAppTemplate.findUnique({
    where: { name: "intro_session_invitation" },
    select: { id: true },
  });
  if (!template) return null;

  const last = await prisma.whatsAppMessage.findFirst({
    where: { templateId: template.id, direction: "OUTBOUND" },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });
  return last?.sentAt ?? null;
}

export type IntroCandidate = {
  id: string;
  name: string;
  phone: string;
  reason: "intro_interest" | "new_enquiry";
};

// Query all clients who qualify for the next intro session blast.
// Group 1 — sent a button reply containing "introduction" since last blast.
// Group 2 — active leads with no outbound WhatsApp messages at all.
export async function getIntroCandidates(): Promise<IntroCandidate[]> {
  await requireSession();

  const since = await lastIntroBatchSentAt();

  // Group 1: inbound button replies with "introduction" in body since last blast
  const introMessages = await prisma.whatsAppMessage.findMany({
    where: {
      direction: "INBOUND",
      body: { contains: "introduction", mode: "insensitive" },
      ...(since ? { sentAt: { gt: since } } : {}),
      clientId: { not: null },
    },
    select: { clientId: true },
    distinct: ["clientId"],
  });

  // Also include clients whose nextAction is INTRO_PRANIC_HEALING_GROUP
  // (covers button presses that may not have a "introduction" literal in body)
  const introActionClients = await prisma.client.findMany({
    where: {
      nextAction: "INTRO_PRANIC_HEALING_GROUP",
      leadStatus: "ACTIVE",
    },
    select: { id: true, name: true, phone: true },
  });

  const group1Ids = new Set<string>([
    ...introMessages.map((m) => m.clientId as string),
    ...introActionClients.map((c) => c.id),
  ]);

  // Group 2: active clients with no outbound messages at all
  const noOutboundClients = await prisma.client.findMany({
    where: {
      leadStatus: "ACTIVE",
      id: { notIn: [...group1Ids] },
      whatsappMessages: { none: { direction: "OUTBOUND" } },
    },
    select: { id: true, name: true, phone: true },
  });

  // Resolve names/phones for group 1
  const group1Clients = group1Ids.size > 0
    ? await prisma.client.findMany({
        where: { id: { in: [...group1Ids] }, leadStatus: "ACTIVE" },
        select: { id: true, name: true, phone: true },
      })
    : [];

  const candidates: IntroCandidate[] = [
    ...group1Clients.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      reason: "intro_interest" as const,
    })),
    ...noOutboundClients.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      reason: "new_enquiry" as const,
    })),
  ];

  return candidates;
}

export type SendIntroBlastResult = {
  sent: number;
  failed: number;
  errors: string[];
};

export async function sendIntroBlastAction(
  formData: FormData
): Promise<SendIntroBlastResult> {
  await requireSession();

  const scheduledAt = String(formData.get("scheduledAt") ?? "").trim();
  if (!scheduledAt) throw new Error("Please enter the session date & time.");

  const zoomLink = await getSetting(SETTING_KEYS.zoomIntroLink);
  if (!zoomLink) throw new Error("Zoom intro link not configured. Go to Settings → WhatsApp to add it.");

  const candidates = await getIntroCandidates();
  if (candidates.length === 0) throw new Error("No qualifying clients found.");

  const wp = getWhatsAppProvider();
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      await wp.sendTemplate({
        clientId: candidate.id,
        phone: candidate.phone,
        templateName: "intro_session_invitation",
        variables: [
          candidate.name.split(" ")[0],
          scheduledAt,
          zoomLink,
        ],
      });
      sent++;
    } catch (err) {
      failed++;
      errors.push(`${candidate.name}: ${(err as Error).message}`);
    }
  }

  revalidatePath("/leads/intro-blast");
  return { sent, failed, errors };
}
