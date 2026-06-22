"use server";

// Coordinator inbox — server actions.
//
// Thread state mutations (assign, snooze, resolve, escalate, reopen) all
// live here, plus the two reply paths: template and free-text. Free-text
// is gated by the customer-care window (24h since the most recent inbound)
// — the page UI hides the input outside the window, but we re-check
// server-side to defend against a stale client.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { addMinutes, addHours } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";
import { canUseInbox } from "@/lib/rbac";
import { getWhatsAppProvider } from "@/lib/providers/whatsapp";
import { customerCareWindow } from "@/lib/customer-care-window";
import { audit } from "@/lib/audit";

async function requireInbox() {
  const session = await requireSession();
  if (!canUseInbox(session.user.roles)) {
    redirect("/dashboard?error=forbidden");
  }
  return session;
}

// ── State mutations ──────────────────────────────────────────────────

export async function assignToMeAction(formData: FormData) {
  const session = await requireInbox();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) redirect("/inbox?error=missing_client");
  await prisma.whatsAppThread.upsert({
    where: { clientId },
    create: { clientId, assigneeId: session.user.id, status: "OPEN" },
    update: { assigneeId: session.user.id },
  });
  revalidatePath("/inbox");
  revalidatePath(`/inbox/${clientId}`);
}

export async function unassignAction(formData: FormData) {
  await requireInbox();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) redirect("/inbox");
  await prisma.whatsAppThread.update({
    where: { clientId },
    data: { assigneeId: null },
  });
  revalidatePath("/inbox");
  revalidatePath(`/inbox/${clientId}`);
}

export async function resolveThreadAction(formData: FormData) {
  const session = await requireInbox();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) redirect("/inbox");
  await prisma.whatsAppThread.upsert({
    where: { clientId },
    create: { clientId, status: "RESOLVED", resolvedAt: new Date(), resolvedById: session.user.id },
    update: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: session.user.id },
  });
  revalidatePath("/inbox");
  revalidatePath(`/inbox/${clientId}`);
}

export async function reopenThreadAction(formData: FormData) {
  await requireInbox();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) redirect("/inbox");
  await prisma.whatsAppThread.update({
    where: { clientId },
    data: { status: "OPEN", resolvedAt: null, resolvedById: null, snoozeUntil: null },
  });
  revalidatePath("/inbox");
  revalidatePath(`/inbox/${clientId}`);
}

export async function escalateThreadAction(formData: FormData) {
  await requireInbox();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) redirect("/inbox");
  await prisma.whatsAppThread.update({
    where: { clientId },
    data: { escalated: true },
  });
  revalidatePath("/inbox");
  revalidatePath(`/inbox/${clientId}`);
}

export async function snoozeThreadAction(formData: FormData) {
  await requireInbox();
  const clientId = String(formData.get("clientId") ?? "");
  const preset = String(formData.get("preset") ?? "1h");
  if (!clientId) redirect("/inbox");
  const now = new Date();
  const until = preset === "30m" ? addMinutes(now, 30)
              : preset === "4h"  ? addHours(now, 4)
              : preset === "1d"  ? addHours(now, 24)
              : preset === "3d"  ? addHours(now, 72)
              :                    addHours(now, 1); // default 1h
  await prisma.whatsAppThread.update({
    where: { clientId },
    data: { status: "SNOOZED", snoozeUntil: until },
  });
  revalidatePath("/inbox");
  revalidatePath(`/inbox/${clientId}`);
}

// ── Reply paths ──────────────────────────────────────────────────────

export async function sendQuickReplyTemplateAction(formData: FormData) {
  await requireInbox();
  const clientId     = String(formData.get("clientId") ?? "");
  const templateName = String(formData.get("templateName") ?? "");
  if (!clientId || !templateName) redirect("/inbox");

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { phone: true, name: true },
  });
  if (!client?.phone) redirect(`/inbox/${clientId}?error=no_phone`);

  // Variables come as multiple `var` form fields, ordered.
  const variables = formData.getAll("var").map((v) => String(v));

  try {
    await getWhatsAppProvider().sendTemplate({
      clientId,
      phone: client.phone,
      templateName,
      variables,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Template send failed";
    redirect(`/inbox/${clientId}?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath(`/inbox/${clientId}`);
  redirect(`/inbox/${clientId}?ok=sent`);
}

export async function sendQuickReplyTextAction(formData: FormData) {
  await requireInbox();
  const clientId = String(formData.get("clientId") ?? "");
  const body     = String(formData.get("body") ?? "").trim();
  if (!clientId || !body) redirect(`/inbox/${clientId}?error=empty_body`);

  // Re-check the customer-care window server-side. UI hides the form
  // outside the window but a stale page could still submit.
  const thread = await prisma.whatsAppThread.findUnique({
    where: { clientId },
    select: { lastInboundAt: true },
  });
  const window = customerCareWindow(thread?.lastInboundAt);
  if (!window.open) {
    redirect(`/inbox/${clientId}?error=window_closed`);
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { phone: true },
  });
  if (!client?.phone) redirect(`/inbox/${clientId}?error=no_phone`);

  try {
    await getWhatsAppProvider().sendText({
      clientId,
      phone: client.phone,
      body,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Send failed";
    redirect(`/inbox/${clientId}?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath(`/inbox/${clientId}`);
  redirect(`/inbox/${clientId}?ok=sent`);
}

// ── Orphan attach (unknown sender) ───────────────────────────────────

export async function attachOrphanToClientAction(formData: FormData) {
  await requireInbox();
  const phone    = String(formData.get("phone") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!phone || !clientId) redirect("/inbox?tab=unknown");

  // Patch every orphan inbound from this phone to the chosen client.
  await prisma.whatsAppMessage.updateMany({
    where: { phone, clientId: null, direction: "INBOUND" },
    data: { clientId },
  });
  // Touch the thread so the count/lastInboundAt reflect reality.
  const latest = await prisma.whatsAppMessage.findFirst({
    where: { clientId },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });
  await prisma.whatsAppThread.upsert({
    where: { clientId },
    create: {
      clientId,
      status: "OPEN",
      lastInboundAt: latest?.sentAt ?? new Date(),
      unreadCount: 1,
    },
    update: {
      status: "OPEN",
      lastInboundAt: latest?.sentAt ?? undefined,
      unreadCount: { increment: 1 },
    },
  });
  revalidatePath("/inbox");
  revalidatePath(`/inbox/${clientId}`);
  redirect(`/inbox/${clientId}`);
}

// ── Mark thread read ─────────────────────────────────────────────────
// Called when a coordinator opens a thread — zeros the unreadCount.
// Audit log captures who viewed which client's transcript (DPDP).

export async function markThreadReadAction(clientId: string): Promise<void> {
  const session = await requireInbox();
  await prisma.whatsAppThread.updateMany({
    where: { clientId, unreadCount: { gt: 0 } },
    data: { unreadCount: 0 },
  });
  await audit("WHATSAPP_THREAD_OPENED", "Client", clientId, {
    actorId: session.user.id,
  });
}
