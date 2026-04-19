"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { completeCounseling } from "@/lib/scheduling";

export async function completeCounselingAction(formData: FormData) {
  const session = await requireSession();
  const sessionId = String(formData.get("sessionId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");

  try {
    await completeCounseling({
      sessionId,
      issueRefined: String(formData.get("issueRefined") ?? "") || undefined,
      severity: (formData.get("severity") as string) || undefined
        ? Number(formData.get("severity"))
        : undefined,
      keyNotes: String(formData.get("keyNotes") ?? "") || undefined,
      byUserId: session.user.id,
    });
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "Failed to save");
    redirect(`/leads/${clientId}/counselling/${sessionId}/complete?error=${msg}`);
  }
  revalidatePath(`/leads/${clientId}`);
  revalidatePath(`/schedule`);
  redirect(`/leads/${clientId}`);
}
