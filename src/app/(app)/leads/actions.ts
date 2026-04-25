"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { transitionStage, allowedNextStages } from "@/lib/pipeline";
import type { PipelineStage } from "@prisma/client";

/**
 * Kanban-style stage move. Called from the board's drag-and-drop handler
 * with an explicit clientId + toStage. Validates the transition against the
 * pipeline state machine before applying.
 */
export async function kanbanMoveAction(input: { clientId: string; toStage: PipelineStage; fromStage: PipelineStage }) {
  const session = await requireSession();
  const allowed = allowedNextStages(input.fromStage);
  if (!allowed.includes(input.toStage)) {
    throw new Error(
      `Can't move from "${input.fromStage}" to "${input.toStage}". Allowed next stages: ${allowed.join(", ") || "none"}.`,
    );
  }
  await transitionStage({
    clientId: input.clientId,
    toStage: input.toStage,
    byUserId: session.user.id,
    note: "Moved on board",
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${input.clientId}`);
  revalidatePath("/dashboard");
}
