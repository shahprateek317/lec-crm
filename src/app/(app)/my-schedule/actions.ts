"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { createScheduleBlock, deleteScheduleBlock } from "@/lib/schedule-blocks";

export async function createBlockAction(formData: FormData) {
  const session = await requireSession();
  // userId is the signed-in user — never trust the form input.
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const reason = String(formData.get("reason") ?? "OTHER") as
    | "EMERGENCY" | "PERSONAL" | "TRAVEL" | "SICK_LEAVE" | "TRAINING" | "OTHER";
  const note = String(formData.get("note") ?? "") || undefined;
  const fullDay = formData.get("fullDay") === "true";
  try {
    await createScheduleBlock({
      userId: session.user.id,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      reason,
      note,
      fullDay,
    });
  } catch (err) {
    redirect(
      `/my-schedule?error=${encodeURIComponent(err instanceof Error ? err.message : "Failed to add block")}`,
    );
  }
  revalidatePath("/my-schedule");
  redirect("/my-schedule?ok=1");
}

export async function deleteBlockAction(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteScheduleBlock(id, session.user.id);
  revalidatePath("/my-schedule");
}
