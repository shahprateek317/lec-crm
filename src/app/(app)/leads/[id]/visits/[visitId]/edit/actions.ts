"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function updateVisitDetailsAction(formData: FormData) {
  await requireSession();
  const visitId = String(formData.get("visitId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!visitId || !clientId) throw new Error("Missing visit or client id");

  await prisma.visit.update({
    where: { id: visitId },
    data: {
      problemsDiscussed: String(formData.get("problemsDiscussed") ?? "") || null,
      healingExplained: String(formData.get("healingExplained") ?? "") || null,
      demoHealingDone: formData.get("demoHealingDone") === "true",
      demoChakrasBefore: formData.get("demoChakrasBefore") ? JSON.parse(String(formData.get("demoChakrasBefore"))) : null,
      demoChakrasAfter: formData.get("demoChakrasAfter") ? JSON.parse(String(formData.get("demoChakrasAfter"))) : null,
      demoHealingNotes: String(formData.get("demoHealingNotes") ?? "") || null,
      initialFeedback: String(formData.get("initialFeedback") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    },
  });

  revalidatePath(`/leads/${clientId}`);
  redirect(`/leads/${clientId}?ok=1`);
}
