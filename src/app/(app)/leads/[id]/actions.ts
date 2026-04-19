"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";
import { transitionStage } from "@/lib/pipeline";
import { getWhatsAppProvider } from "@/lib/providers/whatsapp";
import type { PipelineStage } from "@prisma/client";

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
  if (templateName === "lead_welcome" || templateName === "visit_invitation" || templateName === "feedback_request") {
    variables = [client.name.split(" ")[0]];
  }

  await getWhatsAppProvider().sendTemplate({
    clientId,
    phone: client.phone,
    templateName,
    variables,
  });
  revalidatePath(`/leads/${clientId}`);
}
