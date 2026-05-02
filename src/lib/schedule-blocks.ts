// Helpers for staff temporary unavailability — the "block slot / full
// day / emergency" system from dad's HEALER ASSIGNMENT spec. Used by the
// assignment engine (to filter out blocked healers) and by the /my-schedule
// page (to render + manage blocks).

import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { addDays, startOfDay, endOfDay } from "date-fns";

export const blockSchema = z.object({
  userId: z.string().min(1),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  fullDay: z.coerce.boolean().default(false),
  reason: z.enum(["EMERGENCY", "PERSONAL", "TRAVEL", "SICK_LEAVE", "TRAINING", "OTHER"]).default("OTHER"),
  note: z.string().max(500).optional(),
});

export async function createScheduleBlock(input: z.infer<typeof blockSchema>) {
  const parsed = blockSchema.parse(input);
  if (parsed.endsAt <= parsed.startsAt) {
    throw new Error("End time must be after start time.");
  }
  return prisma.scheduleBlock.create({ data: parsed });
}

export async function deleteScheduleBlock(id: string, userId: string) {
  // Scope by userId so users can only delete their own blocks (admins can
  // manage anyone's via a separate admin route).
  return prisma.scheduleBlock.deleteMany({ where: { id, userId } });
}

/**
 * True if the given user has any block overlapping the given instant.
 * Cheap range query on the indexed (startsAt, endsAt) tuple.
 */
export async function isUserBlockedAt(userId: string, at: Date): Promise<boolean> {
  const overlap = await prisma.scheduleBlock.findFirst({
    where: {
      userId,
      startsAt: { lte: at },
      endsAt: { gt: at },
    },
    select: { id: true },
  });
  return overlap !== null;
}

/** Returns blocks for a user across a date range — used by the calendar UI. */
export async function listBlocksInRange(userId: string, fromDay: Date, days = 7) {
  return prisma.scheduleBlock.findMany({
    where: {
      userId,
      startsAt: { lt: endOfDay(addDays(fromDay, days - 1)) },
      endsAt:   { gt: startOfDay(fromDay) },
    },
    orderBy: { startsAt: "asc" },
  });
}

/** Bulk variant for a set of users — used by the assignment engine. */
export async function listBlocksForUsersAt(userIds: string[], at: Date): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await prisma.scheduleBlock.findMany({
    where: {
      userId: { in: userIds },
      startsAt: { lte: at },
      endsAt: { gt: at },
    },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}
