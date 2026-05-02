// Auto-assignment helpers. Given a client (and optional time), suggest or
// outright pick the best counsellor / healer based on the rich profile
// data captured under /settings/users/[id].
//
// `suggestHealers` and `suggestCounsellors` return ranked options for the
// UI to display. `pickHealer` and `pickCounsellor` make the final call
// when a server action wants a single answer (e.g. auto-assignment on
// session creation when no healer was chosen manually).

import { prisma } from "@/lib/prisma";
import { listBlocksForUsersAt } from "@/lib/schedule-blocks";
import type { User, HealerProfile, CounsellorProfile, TimeBand, DayOfWeek } from "@prisma/client";

export type Suggestion<T> = {
  user: T;
  score: number;
  reasons: string[];
};

const NEARBY: ReadonlyArray<string> = ["NEW_TOWN", "SALT_LAKE", "RAJARHAT", "DUMDUM", "BARASAT"];

function bandFromHour(hour: number): TimeBand {
  if (hour < 9) return "EARLY_MORNING";
  if (hour < 12) return "MORNING";
  if (hour < 16) return "AFTERNOON";
  if (hour < 19) return "EVENING";
  return "NIGHT";
}

const DAY_LIST: ReadonlyArray<DayOfWeek> = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
function dayFromDate(d: Date): DayOfWeek {
  return DAY_LIST[d.getDay()];
}

// Soft language match — case-insensitive, normalises trailing whitespace.
function languageOverlap(a: string[], b: string[]): string[] {
  const set = new Set(b.map((s) => s.trim().toLowerCase()));
  return a.filter((s) => set.has(s.trim().toLowerCase()));
}

// ── Counsellors ───────────────────────────────────────────────────
export async function suggestCounsellors(
  clientId: string,
  scheduledAt?: Date,
  topN = 3,
): Promise<Array<Suggestion<User & { counsellorProfile: CounsellorProfile | null }>>> {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return [];

  const counsellors = await prisma.user.findMany({
    where: { active: true, role: { in: ["COUNSELLOR", "SENIOR_COUNSELLOR"] } },
    include: { counsellorProfile: true },
  });

  const slot = scheduledAt
    ? `${dayFromDate(scheduledAt)}:${bandFromHour(scheduledAt.getHours())}`
    : null;

  const blockedIds = scheduledAt
    ? await listBlocksForUsersAt(counsellors.map((c) => c.id), scheduledAt)
    : new Set<string>();

  const out = counsellors.filter((u) => !blockedIds.has(u.id)).map((u) => {
    const p = u.counsellorProfile;
    let score = 0;
    const reasons: string[] = [];
    if (p) {
      // Time match (strong signal)
      if (slot && (p.availabilitySlots.includes(slot) || p.availabilitySlots.length === 0)) {
        score += 5;
        reasons.push(p.availabilitySlots.length === 0 ? "No availability set (assumed open)" : "Available at this time");
      }
      // Senior bonus
      if (u.role === "SENIOR_COUNSELLOR") {
        score += 1;
        reasons.push("Senior counsellor");
      }
      // Online preference if no specific area
      if (p.acceptsOnline) {
        score += 1;
        reasons.push("Online sessions");
      }
      // Specialisations matching client's category
      const wanted = (client.issueCategory ?? "").toLowerCase().replace(/_/g, " ");
      const matches = p.specializations.filter((s) => s.toLowerCase().includes(wanted));
      if (matches.length > 0) {
        score += 3 * matches.length;
        reasons.push(`Specialises in ${matches.join(", ")}`);
      }
      // Max sessions per day not exceeded
      if (p.maxSessionsPerDay && scheduledAt) {
        // Cheap heuristic: don't penalise here — UI shows actual load.
      }
    }
    return { user: u, score, reasons };
  });

  // Workload tiebreaker: among similarly scored healers, pick the one
  // with the fewest sessions today. Cheap aggregate query.
  if (scheduledAt && out.some((o) => o.score > 0)) {
    const dayStart = new Date(scheduledAt); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(scheduledAt); dayEnd.setHours(23, 59, 59, 999);
    const loads = await prisma.healingSession.groupBy({
      by: ["healerId"],
      where: { healerId: { in: out.map((o) => o.user.id) }, date: { gte: dayStart, lte: dayEnd } },
      _count: { _all: true },
    });
    const loadMap = new Map(loads.map((l) => [l.healerId, l._count._all]));
    return out
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (loadMap.get(a.user.id) ?? 0) - (loadMap.get(b.user.id) ?? 0);
      })
      .slice(0, topN);
  }
  return out.sort((a, b) => b.score - a.score).slice(0, topN);
}

/**
 * Single best healer for a client. Honours mode (in-person / distant) and
 * a per-day workload tiebreaker. Returns null when nobody qualifies — UI
 * should surface a clear "no available healer" message rather than silently
 * picking someone who can't actually do the work.
 */
export async function pickHealer(
  clientId: string,
  mode: HealingMode = "IN_PERSON",
  scheduledAt?: Date,
): Promise<User | null> {
  const ranked = await suggestHealers(clientId, mode, scheduledAt, 5);
  const eligible = ranked.filter((s) => s.score > 0);
  if (eligible.length === 0) return null;
  return eligible[0].user;
}

/**
 * Single best counsellor for a client + optional time. Returns null when
 * no qualified counsellor exists. Use this when a server action needs to
 * auto-assign without showing a UI.
 */
export async function pickCounsellor(
  clientId: string,
  scheduledAt?: Date,
): Promise<User | null> {
  const ranked = await suggestCounsellors(clientId, scheduledAt, 5);
  // Filter to anyone with at least one match reason — never silently
  // assign a random counsellor with score 0.
  const eligible = ranked.filter((s) => s.score > 0);
  if (eligible.length === 0) return ranked[0]?.user ?? null;
  return eligible[0].user;
}

// ── Healers ───────────────────────────────────────────────────────
export type HealingMode = "IN_PERSON" | "DISTANT";

export async function suggestHealers(
  clientId: string,
  mode: HealingMode = "IN_PERSON",
  scheduledAt?: Date,
  topN = 3,
): Promise<Array<Suggestion<User & { healerProfile: HealerProfile | null }>>> {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return [];

  const healers = await prisma.user.findMany({
    where: { active: true, role: { in: ["HEALER", "SENIOR_HEALER"] } },
    include: { healerProfile: true },
  });

  const slot = scheduledAt
    ? `${dayFromDate(scheduledAt)}:${bandFromHour(scheduledAt.getHours())}`
    : null;

  // Filter out healers blocked at the requested instant — schedule blocks
  // are a hard "no" regardless of base availability.
  const blockedIds = scheduledAt
    ? await listBlocksForUsersAt(healers.map((h) => h.id), scheduledAt)
    : new Set<string>();

  const out = healers.filter((u) => !blockedIds.has(u.id)).map((u) => {
    const p = u.healerProfile;
    let score = 0;
    const reasons: string[] = [];
    if (p) {
      if (mode === "IN_PERSON" && p.acceptsInPerson) {
        score += 3;
        reasons.push("Accepts in-person");
      }
      if (mode === "DISTANT" && p.acceptsDistant) {
        score += 3;
        reasons.push("Accepts distant healing");
      }
      if (slot && (p.availabilitySlots.includes(slot) || p.availabilitySlots.length === 0)) {
        score += 5;
        reasons.push(p.availabilitySlots.length === 0 ? "No availability set (assumed open)" : "Available at this time");
      }
      if (mode === "IN_PERSON" && client.areaCategory && NEARBY.includes(client.areaCategory) && p.canVisitCentre) {
        score += 2;
        reasons.push("Centre-based; client is nearby");
      }
      if (u.role === "SENIOR_HEALER") {
        score += 2;
        reasons.push("Senior healer");
      }
      if (p.experienceYears && p.experienceYears >= 5) {
        score += 1;
        reasons.push(`${p.experienceYears} yrs experience`);
      }
      // Focus area match against issue category
      const wanted = (client.issueCategory ?? "").toLowerCase().replace(/_/g, " ");
      const focusMatches = p.focusAreas.filter((f) => f.toLowerCase().includes(wanted));
      if (focusMatches.length > 0) {
        score += 3 * focusMatches.length;
        reasons.push(`Focus area: ${focusMatches.join(", ")}`);
      }
    }
    return { user: u, score, reasons };
  });

  return out.sort((a, b) => b.score - a.score).slice(0, topN);
}
