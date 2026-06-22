"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, isAdmin } from "@/lib/rbac";
import { transitionStage } from "@/lib/pipeline";
import { getWhatsAppProvider } from "@/lib/providers/whatsapp";
import { audit } from "@/lib/audit";
import type { PipelineStage } from "@prisma/client";
import { format } from "date-fns";

export async function transitionStageAction(formData: FormData) {
  const session = await requireSession();
  const clientId = String(formData.get("clientId") ?? "");
  const toStage = String(formData.get("toStage") ?? "") as PipelineStage;
  const note = String(formData.get("note") ?? "").trim() || undefined;

  if (!clientId || !toStage) throw new Error("Missing clientId or toStage");

  await transitionStage({ clientId, toStage, byUserId: session.user.id, note });
  revalidatePath(`/leads/${clientId}`);
  revalidatePath(`/leads`);
  revalidatePath(`/dashboard`);
}

export async function assignLeadAction(formData: FormData) {
  await requireSession();
  const clientId = String(formData.get("clientId") ?? "");
  const assignedToId = String(formData.get("assignedToId") ?? "") || null;
  if (!clientId) throw new Error("Missing clientId");

  await prisma.client.update({
    where: { id: clientId },
    data: { assignedToId },
  });
  revalidatePath(`/leads/${clientId}`);
  revalidatePath(`/leads`);
}

export async function updateLeadNotesAction(formData: FormData) {
  await requireSession();
  const clientId = String(formData.get("clientId") ?? "");
  const notes = String(formData.get("notes") ?? "");
  if (!clientId) throw new Error("Missing clientId");

  await prisma.client.update({
    where: { id: clientId },
    data: { notes: notes || null },
  });
  revalidatePath(`/leads/${clientId}`);
}

/**
 * Send a simple (non-parameterised) WhatsApp template. Parameterised
 * templates (e.g. payment_link) have dedicated flows where the variables
 * come from real entities (a Payment row).
 */
export async function sendTemplateAction(formData: FormData) {
  await requireSession();
  const clientId = String(formData.get("clientId") ?? "");
  const templateName = String(formData.get("templateName") ?? "");
  if (!clientId || !templateName) throw new Error("Missing clientId or templateName");

  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });

  // Guess variables for known templates from the client record.
  let variables: string[] = [];
  let buttonSuffix: string | undefined;
  if (templateName === "lead_welcome") {
    variables = [client.name.split(" ")[0], "https://crm.lifeenergycentre.in/files/lec-brochure.pdf"];
  } else if (templateName === "visit_invitation" || templateName === "feedback_request") {
    variables = [client.name.split(" ")[0]];
  } else if (templateName === "counseling_confirmation" || templateName === "counseling_meeting_link" || templateName === "session_join_link") {
    const upcoming = await prisma.counselingSession.findFirst({
      where: { clientId, scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      include: { counsellor: true },
    });
    variables = [
      client.name.split(" ")[0],
      upcoming ? format(upcoming.scheduledAt, "dd MMM, HH:mm") : "—",
      upcoming?.counsellor.name ?? "—",
    ];
    if (templateName === "session_join_link" && upcoming?.meetLink) {
      variables.push(upcoming.meetLink);
    }
  }

  await getWhatsAppProvider().sendTemplate({
    clientId,
    phone: client.phone,
    templateName,
    variables,
    buttonSuffix,
  });
  revalidatePath(`/leads/${clientId}`);
}

/**
 * Admin-only soft-delete. Sets Client.deletedAt = now() so the
 * tombstone reconciler (Phase 2a) anonymizes the row after 30 days.
 *
 * Requires a typed confirmation phrase to defend against accidental
 * clicks — the operator must type the client's first name. We compare
 * case-insensitively + trim to be forgiving of typing variance.
 *
 * Idempotent: re-deleting a soft-deleted row is a no-op (the deletedAt
 * column is set to the LATER timestamp so the tombstone window resets).
 *
 * After soft-delete:
 *   - The client is hidden from /me/sessions, /me, /me/* (via
 *     getClient deletedAt check).
 *   - The reminder cron skips them (already wired).
 *   - The reconciler will scrub their medical reports + identity
 *     fields after 30 days.
 *   - Audit log records the operator + the client name so we can
 *     trace post-mortem.
 */
export async function softDeleteClientAction(formData: FormData) {
  const session = await requireSession();
  if (!isAdmin(session.user.roles)) {
    redirect(`/leads/${formData.get("clientId") ?? ""}?error=forbidden`);
  }

  const clientId = String(formData.get("clientId") ?? "");
  const confirm = String(formData.get("confirm") ?? "").trim().toLowerCase();
  if (!clientId) redirect("/leads?error=missing_client");

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true, phone: true, deletedAt: true },
  });
  if (!client) redirect("/leads?error=not_found");

  const expectedFirstName = (client.name.split(" ")[0] ?? "").trim().toLowerCase();
  if (!expectedFirstName || confirm !== expectedFirstName) {
    redirect(`/leads/${clientId}?error=confirm_mismatch`);
  }

  // Conditional update: only flip `deletedAt` if it's still NULL. If
  // two admins race the action, the second `count` is 0 and we skip
  // the duplicate audit row — keeps the audit log clean while still
  // recording the actual deleter.
  const result = await prisma.client.updateMany({
    where: { id: clientId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  if (result.count === 1) {
    await audit("CLIENT_SOFT_DELETED", "Client", clientId, {
      actorId: session.user.id,
      meta: {
        clientNameAtDelete: client.name,
        phoneAtDelete: client.phone,
        tombstoneDays: 30,
      },
    });
  }

  revalidatePath(`/leads/${clientId}`);
  revalidatePath(`/leads`);
  revalidatePath(`/dashboard`);
  redirect(`/leads?ok=soft_deleted`);
}
