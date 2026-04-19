"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { scheduleCounseling } from "@/lib/scheduling";

export async function scheduleCounselingAction(formData: FormData) {
  const session = await requireSession();
  const clientId = String(formData.get("clientId") ?? "");
  const counsellorId = String(formData.get("counsellorId") ?? "");
  const scheduledAt = String(formData.get("scheduledAt") ?? "");

  try {
    await scheduleCounseling({
      clientId,
      counsellorId,
      scheduledAt: new Date(scheduledAt),
      byUserId: session.user.id,
    });
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "Failed to schedule");
    redirect(`/leads/${clientId}/counselling/new?error=${msg}`);
  }
  revalidatePath(`/leads/${clientId}`);
  revalidatePath(`/schedule`);
  redirect(`/leads/${clientId}`);
}
