"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";
import type { FollowUpStatus } from "@prisma/client";

export async function updateFollowUpAction(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as FollowUpStatus;
  if (!id) throw new Error("Missing id");
  await prisma.followUp.update({
    where: { id },
    data: {
      status,
      completedAt: status === "DONE" ? new Date() : null,
    },
  });
  revalidatePath("/follow-ups");
}
