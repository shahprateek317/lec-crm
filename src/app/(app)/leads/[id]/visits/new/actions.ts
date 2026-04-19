"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { scheduleVisit } from "@/lib/scheduling";

export async function scheduleVisitAction(formData: FormData) {
  const session = await requireSession();
  const clientId = String(formData.get("clientId") ?? "");
  const assignedHealerId = String(formData.get("assignedHealerId") ?? "") || undefined;
  const scheduledAt = String(formData.get("scheduledAt") ?? "");

  try {
    await scheduleVisit({
      clientId,
      assignedHealerId,
      scheduledAt: new Date(scheduledAt),
      byUserId: session.user.id,
    });
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "Failed to schedule");
    redirect(`/leads/${clientId}/visits/new?error=${msg}`);
  }
  revalidatePath(`/leads/${clientId}`);
  revalidatePath(`/schedule`);
  redirect(`/leads/${clientId}`);
}
