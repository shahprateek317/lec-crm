// Auto-assignment helpers. Given a client (and optional time), suggest the
// best counsellor or healer to assign — based on the rich profile data
// captured under /settings/users/[id].
//
// Today the UI surfaces the top suggestions; a real auto-assignment engine
// can layer on top of these helpers later.

import { prisma } from "@/lib/prisma";
import type { Client, User, HealerProfile, CounsellorProfile, TimeBand, DayOfWeek } from "@prisma/client";

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

  const out = counsellors.map((u) => {
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

  return out.sort((a, b) => b.score - a.score).slice(0, topN);
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

  const out = healers.map((u) => {
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
