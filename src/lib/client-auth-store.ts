// Production wiring of the client-auth library to Prisma.
//
// The library (src/lib/client-auth.ts) is DB-agnostic — it talks to a
// typed store interface. This file is the only place that knows about
// our actual tables (ClientMagicLink, ClientSession). Keeps the security
// logic testable in isolation while the SQL stays close to the DB schema.

import { prisma } from "@/lib/prisma";
import type { ClientAuthStore } from "@/lib/client-auth";

export const prismaClientAuthStore: ClientAuthStore = {
  magicLink: {
    async create(data) {
      const row = await prisma.clientMagicLink.create({
        data: {
          tokenHash: data.tokenHash,
          otpHash: data.otpHash,
          clientId: data.clientId,
          expiresAt: data.expiresAt,
          requestIp: data.requestIp ?? null,
        },
        select: { id: true },
      });
      return { id: row.id };
    },

    async findByTokenHash(hash) {
      return prisma.clientMagicLink.findUnique({ where: { tokenHash: hash } });
    },

    async findLatestUnconsumedForClient(clientId) {
      return prisma.clientMagicLink.findFirst({
        where: { clientId, consumedAt: null },
        orderBy: { createdAt: "desc" },
      });
    },

    /** Race-safe consume: UPDATE only if consumedAt IS NULL. Returns
     *  true iff this call won the race. */
    async markConsumedIfUnconsumed(id, when, via) {
      const result = await prisma.clientMagicLink.updateMany({
        where: { id, consumedAt: null },
        data: { consumedAt: when, consumedVia: via },
      });
      return result.count === 1;
    },

    async incrementOtpAttempts(id) {
      const row = await prisma.clientMagicLink.update({
        where: { id },
        data: { otpAttempts: { increment: 1 } },
        select: { otpAttempts: true },
      });
      return row.otpAttempts;
    },

    async countRecent(clientId, since) {
      return prisma.clientMagicLink.count({
        where: { clientId, createdAt: { gte: since } },
      });
    },
  },

  session: {
    async create(data) {
      await prisma.clientSession.create({
        data: {
          tokenHash: data.tokenHash,
          clientId: data.clientId,
          expiresAt: data.expiresAt,
          userAgent: data.userAgent ?? null,
        },
      });
    },

    async findByTokenHash(hash) {
      return prisma.clientSession.findUnique({ where: { tokenHash: hash } });
    },

    async touch(hash, when, newExpiry) {
      await prisma.clientSession.update({
        where: { tokenHash: hash },
        data: {
          lastUsedAt: when,
          ...(newExpiry ? { expiresAt: newExpiry } : {}),
        },
      });
    },

    async revoke(hash) {
      // updateMany so a missing/already-revoked row doesn't throw.
      await prisma.clientSession.updateMany({
        where: { tokenHash: hash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },

    async revokeAllForClient(clientId) {
      const result = await prisma.clientSession.updateMany({
        where: { clientId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return result.count;
    },
  },
};
