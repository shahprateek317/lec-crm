"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { endSession } from "@/lib/check-in";

/** Healer-initiated end. Sets endedAt + generates end token + sends WhatsApp. */
export async function endSessionAction(formData: FormData) {
  await requireSession();
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) redirect("/my-schedule?error=missing_session");

  await endSession(sessionId);
  revalidatePath(`/healing/in-progress/${sessionId}`);
  redirect(`/healing/in-progress/${sessionId}`);
}
