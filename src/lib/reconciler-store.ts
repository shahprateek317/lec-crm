// Production wiring of the reconciler library to Prisma + S3.
//
// The pure logic lives in src/lib/reconciler.ts and talks to a typed
// ReconcilerStore interface — same split as client-auth + client-auth-store.
// This file is the only place that knows the actual table layout.

import { prisma } from "@/lib/prisma";
import { deleteFromS3 } from "@/lib/uploads";
import type { ReconcilerStore } from "@/lib/reconciler";

export const prismaReconcilerStore: ReconcilerStore = {
  async findCandidates(deletedBefore, limit) {
    const rows = await prisma.client.findMany({
      where: { deletedAt: { lt: deletedBefore, not: null } },
      select: { id: true, name: true, phone: true, deletedAt: true },
      orderBy: { deletedAt: "asc" },
      take: limit,
    });
    // deletedAt is non-null because of the WHERE filter, but Prisma's
    // generated type keeps it Date | null. Narrow defensively.
    return rows
      .filter((r): r is typeof r & { deletedAt: Date } => r.deletedAt !== null)
      .map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        deletedAt: r.deletedAt,
      }));
  },

  async anonymizeClient(id, fields) {
    await prisma.client.update({
      where: { id },
      data: {
        name: fields.name,
        phone: fields.phone,
        email: fields.email,
        age: fields.age,
        ageBucket: fields.ageBucket,
        gender: fields.gender,
        maritalStatus: fields.maritalStatus,
        occupation: fields.occupation,
        referredBy: fields.referredBy,
        area: fields.area,
        areaCategory: fields.areaCategory,
        issue: fields.issue,
        issueCategory: fields.issueCategory,
        secondaryConcerns: { set: fields.secondaryConcerns },
        issueRefined: fields.issueRefined,
        issueDuration: fields.issueDuration,
        notes: fields.notes,
        lostReason: fields.lostReason,
      },
    });
  },

  async findClientDocuments(clientId) {
    return prisma.document.findMany({
      where: { ownerClientId: clientId },
      select: { id: true, storageKey: true },
    });
  },

  async scrubDocument(id) {
    // We do NOT delete the Document row — the DPDP audit trail wants
    // proof the file existed and was removed. Status flips to FAILED
    // (semantically: "no longer fetchable"), and storageKey gets a
    // sentinel value that cannot match any real S3 key, so any stale
    // presigned URL still hanging in caches becomes unresolvable.
    await prisma.document.update({
      where: { id },
      data: {
        status: "FAILED",
        storageKey: `scrubbed-${id}`,
      },
    });
  },

  async deleteFromStorage(key) {
    return deleteFromS3(key);
  },
};
