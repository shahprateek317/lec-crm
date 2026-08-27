"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import type { ActionType, LeadStatus } from "@prisma/client";

export async function updateActionPlanAction(formData: FormData) {
  const session = await requireSession();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) throw new Error("Missing clientId");

  const nextAction = (String(formData.get("nextAction") ?? "") || null) as ActionType | null;
  const nextActionDate = String(formData.get("nextActionDate") ?? "") || null;
  const leadStatus = (String(formData.get("leadStatus") ?? "") || null) as LeadStatus | null;
  const actionRemarks = String(formData.get("actionRemarks") ?? "") || null;
  const journeyReason = String(formData.get("journeyReason") ?? "") || null;
  const currentAction = (String(formData.get("currentAction") ?? "") || null) as ActionType | null;

  await prisma.client.update({
    where: { id: clientId },
    data: {
      currentAction: currentAction ?? undefined,
      nextAction: nextAction ?? undefined,
      nextActionDate: nextActionDate ? new Date(nextActionDate) : null,
      leadStatus: leadStatus ?? undefined,
      actionRemarks,
      journeyReason,
    },
  });

  revalidatePath(`/leads/${clientId}`);
  redirect(`/leads/${clientId}?ok=1`);
}
