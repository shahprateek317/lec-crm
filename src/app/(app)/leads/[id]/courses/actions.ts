"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { enrolClient, markEnrolmentCompleted } from "@/lib/courses";

export async function enrolAction(formData: FormData) {
  const session = await requireSession();
  const clientId = String(formData.get("clientId") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  const applyCreditsToFee = formData.get("applyCreditsToFee") === "true";

  try {
    await enrolClient({ clientId, courseId, applyCreditsToFee, byUserId: session.user.id });
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "Failed");
    redirect(`/leads/${clientId}/courses?error=${msg}`);
  }
  revalidatePath(`/leads/${clientId}`);
  revalidatePath(`/leads/${clientId}/courses`);
}

export async function markCompletedAction(formData: FormData) {
  await requireSession();
  const enrolmentId = String(formData.get("enrolmentId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  await markEnrolmentCompleted(enrolmentId);
  revalidatePath(`/leads/${clientId}/courses`);
  revalidatePath(`/leads/${clientId}`);
}
