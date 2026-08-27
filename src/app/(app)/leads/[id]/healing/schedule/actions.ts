"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { scheduleHealingSession } from "@/lib/scheduling";

export async function scheduleHealingSessionAction(formData: FormData) {
  await requireSession();
  const clientId = String(formData.get("clientId") ?? "");
  const healerId = String(formData.get("healerId") ?? "");
  const mode = String(formData.get("mode") ?? "IN_PERSON") as "IN_PERSON" | "DISTANT";
  const scheduledAt = String(formData.get("scheduledAt") ?? "");

  if (!healerId) {
    const msg = encodeURIComponent("Please select a healer");
    redirect(`/leads/${clientId}/healing/schedule?error=${msg}`);
  }

  try {
    await scheduleHealingSession({
      clientId,
      healerId,
      mode,
      scheduledAt: new Date(scheduledAt),
      byUserId: clientId, // not used for stage transition
    });
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "Failed to schedule");
    redirect(`/leads/${clientId}/healing/schedule?error=${msg}`);
  }
  revalidatePath(`/leads/${clientId}`);
  redirect(`/leads/${clientId}`);
}
