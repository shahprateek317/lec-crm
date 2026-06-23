"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { completeVisit } from "@/lib/scheduling";

export async function completeVisitAction(formData: FormData) {
  const session = await requireSession();
  const visitId = String(formData.get("visitId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");

  try {
    await completeVisit({
      visitId,
      problemsDiscussed: String(formData.get("problemsDiscussed") ?? "") || undefined,
      healingExplained: String(formData.get("healingExplained") ?? "") || undefined,
      demoHealingDone: formData.get("demoHealingDone") === "true",
      demoHealingNotes: String(formData.get("demoHealingNotes") ?? "") || undefined,
      demoChakrasBefore: formData.get("demoChakrasBefore") ? JSON.parse(String(formData.get("demoChakrasBefore"))) : undefined,
      demoChakrasAfter: formData.get("demoChakrasAfter") ? JSON.parse(String(formData.get("demoChakrasAfter"))) : undefined,
      initialFeedback: String(formData.get("initialFeedback") ?? "") || undefined,
      notes: String(formData.get("notes") ?? "") || undefined,
      byUserId: session.user.id,
    });
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "Failed to save");
    redirect(`/leads/${clientId}/visits/${visitId}/complete?error=${msg}`);
  }
  revalidatePath(`/leads/${clientId}`);
  revalidatePath(`/schedule`);
  redirect(`/leads/${clientId}`);
}
