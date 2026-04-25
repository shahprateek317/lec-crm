// Lead pipeline state machine. Defines stage progression, allowed
// transitions, and display helpers. Also keeps side-effects (status
// timestamps, WhatsApp triggers) in one place.

import type { PipelineStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { syncLeadScore } from "@/lib/lead-score";

export const STAGES: PipelineStage[] = [
  "NEW",
  "CONTACTED",
  "COUNSELING_SCHEDULED",
  "COUNSELING_DONE",
  "VISIT_SCHEDULED",
  "VISIT_DONE",
  "HEALING_ACTIVE",
  "CONVERTED",
  "ON_HOLD",
  "LOST",
];

// Forward progression through the happy-path funnel.
const NEXT: Record<PipelineStage, PipelineStage[]> = {
  NEW:                  ["CONTACTED", "ON_HOLD", "LOST"],
  CONTACTED:            ["COUNSELING_SCHEDULED", "ON_HOLD", "LOST"],
  COUNSELING_SCHEDULED: ["COUNSELING_DONE", "ON_HOLD", "LOST"],
  COUNSELING_DONE:      ["VISIT_SCHEDULED", "ON_HOLD", "LOST"],
  VISIT_SCHEDULED:      ["VISIT_DONE", "ON_HOLD", "LOST"],
  VISIT_DONE:           ["HEALING_ACTIVE", "CONVERTED", "ON_HOLD", "LOST"],
  HEALING_ACTIVE:       ["CONVERTED", "ON_HOLD", "LOST"],
  CONVERTED:            ["HEALING_ACTIVE"],
  ON_HOLD:              STAGES.filter((s) => s !== "ON_HOLD"),
  LOST:                 ["NEW", "CONTACTED"],
};

export function allowedNextStages(current: PipelineStage): PipelineStage[] {
  return NEXT[current] ?? [];
}

// Soft tone palette per stage — neutral early, warmer mid-funnel, green at win.
export const STAGE_TONE: Record<PipelineStage, { bg: string; fg: string; label: string }> = {
  NEW:                  { bg: "bg-muted",           fg: "text-muted-foreground", label: "New lead" },
  CONTACTED:            { bg: "bg-blue-100",        fg: "text-blue-900",         label: "Contacted" },
  COUNSELING_SCHEDULED: { bg: "bg-indigo-100",      fg: "text-indigo-900",       label: "Counselling scheduled" },
  COUNSELING_DONE:      { bg: "bg-violet-100",      fg: "text-violet-900",       label: "Counselling done" },
  VISIT_SCHEDULED:      { bg: "bg-fuchsia-100",     fg: "text-fuchsia-900",      label: "Visit scheduled" },
  VISIT_DONE:           { bg: "bg-pink-100",        fg: "text-pink-900",         label: "Visit done" },
  HEALING_ACTIVE:       { bg: "bg-teal-100",        fg: "text-teal-900",         label: "Healing active" },
  CONVERTED:            { bg: "bg-emerald-100",     fg: "text-emerald-900",      label: "Converted" },
  ON_HOLD:              { bg: "bg-amber-100",       fg: "text-amber-900",        label: "On hold" },
  LOST:                 { bg: "bg-rose-100",        fg: "text-rose-900",         label: "Lost" },
};

export type TransitionInput = {
  clientId: string;
  toStage: PipelineStage;
  byUserId: string;
  note?: string;
};

/**
 * Atomically transition a client and record the audit entry.
 * Updates timestamps when crossing key milestones (convertedAt, lastContactedAt).
 */
export async function transitionStage({ clientId, toStage, byUserId, note }: TransitionInput) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.client.findUniqueOrThrow({ where: { id: clientId } });
    if (current.stage === toStage) return current;

    const allowed = allowedNextStages(current.stage);
    if (!allowed.includes(toStage)) {
      throw new Error(
        `Transition not allowed: ${current.stage} → ${toStage}. Allowed: ${allowed.join(", ")}`,
      );
    }

    const patch: Record<string, unknown> = { stage: toStage };
    if (toStage === "CONTACTED") patch.lastContactedAt = new Date();
    if (toStage === "CONVERTED") patch.convertedAt = new Date();

    const updated = await tx.client.update({ where: { id: clientId }, data: patch });

    await tx.stageTransition.create({
      data: {
        clientId,
        fromStage: current.stage,
        toStage,
        byUserId,
        note,
      },
    });

    return updated;
  }).then(async (updated) => {
    // Stage transitions can change the lead score (e.g. attended counselling).
    // Recompute outside the transaction so a slow score update can't roll back
    // the transition.
    await syncLeadScore(clientId).catch((err) => {
      console.error("[pipeline] syncLeadScore failed", err);
    });
    return updated;
  });
}
