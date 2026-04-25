// Lead score — coarse heuristic for prioritising follow-up. Per the
// master-data spec:
//   +10  Nearby (Kolkata-area locality)
//   +10  Severe pain (severity >= 8)
//   +20  Attended counselling at least once
//   +30  Paid the ₹99 program
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
      payments: {
        where: { status: "PAID", amount: { gte: 50, lte: 200 } },
        select: { id: true, notes: true, package: { select: { name: true } } },
      },
    },
  });
  if (!client) return 0;

  let score = 0;
  if (client.areaCategory && NEARBY_AREAS.includes(client.areaCategory)) score += 10;
  if (typeof client.severity === "number" && client.severity >= 8) score += 10;
  if (client.counselingSessions.length > 0) score += 20;

  const paid99 = client.payments.some((p) =>
    (p.package?.name ?? "").toLowerCase().includes("99") ||
    (p.notes ?? "").toLowerCase().includes("99 program") ||
    (p.notes ?? "").toLowerCase().includes("₹99"),
  );
  if (paid99) score += 30;

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
