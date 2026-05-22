// Lead score — coarse heuristic for prioritising follow-up. Rubric was
// originally weighted toward the ₹99 introductory program; rewired in May 2026
// per dad's "Update the existing Healing" doc which retired that program and
// elevated the centre visit as the primary conversion engine:
//   +10  Nearby (Kolkata-area locality)
//   +10  Severe pain (severity >= 8)
//   +20  Attended counselling at least once
//   +20  Completed at least one centre visit
//   +30  Paid for any healing package (real commitment signal)
// Higher = more attention. Stored on Client.leadScore so we can sort/filter
// without re-computing every render.

import { prisma } from "@/lib/prisma";
import type { AreaCategory } from "@prisma/client";

const NEARBY_AREAS: ReadonlyArray<AreaCategory> = [
  "NEW_TOWN", "SALT_LAKE", "RAJARHAT", "DUMDUM", "BARASAT",
];

export async function computeLeadScore(clientId: string): Promise<number> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      counselingSessions: { where: { doneAt: { not: null } }, select: { id: true }, take: 1 },
      visits:             { where: { visitedAt:   { not: null } }, select: { id: true }, take: 1 },
      // Any successful payment counts — the ₹99 special case is gone.
      payments: {
        where: { status: "PAID" },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!client) return 0;

  let score = 0;
  if (client.areaCategory && NEARBY_AREAS.includes(client.areaCategory)) score += 10;
  if (typeof client.severity === "number" && client.severity >= 8) score += 10;
  if (client.counselingSessions.length > 0) score += 20;
  if (client.visits.length > 0)             score += 20;
  if (client.payments.length > 0)           score += 30;

  return score;
}

/** Recompute and persist for one client. */
export async function syncLeadScore(clientId: string): Promise<number> {
  const score = await computeLeadScore(clientId);
  await prisma.client.update({ where: { id: clientId }, data: { leadScore: score } });
  return score;
}

/** Recompute for many — used by an admin "recompute all" or when a config change invalidates scores. */
export async function syncAllLeadScores(): Promise<{ updated: number }> {
  const ids = await prisma.client.findMany({ select: { id: true } });
  for (const { id } of ids) await syncLeadScore(id);
  return { updated: ids.length };
}
