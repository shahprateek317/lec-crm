import { z } from "zod";
import { computeSessionEarning, type EarningsProfile, type EarningsSession } from "./earnings";

// ── Period helpers ───────────────────────────────────────────────────────────

export const periodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must be YYYY-MM (e.g. 2026-06)");

export function parsePeriod(period: string): { year: number; month: number } {
  periodSchema.parse(period);
  const [y, m] = period.split("-");
  return { year: parseInt(y, 10), month: parseInt(m, 10) };
}

export function formatPeriod(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function currentPeriod(now: Date = new Date()): string {
  return formatPeriod(now.getFullYear(), now.getMonth() + 1);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function periodLabel(period: string): string {
  const { year, month } = parsePeriod(period);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// ── Pending period computation ───────────────────────────────────────────────

export type PendingPeriod = {
  period: string;
  label: string;
  earned: number; // total from sessions in period
  paid: number;   // net from existing payout (0 if none)
  pending: number; // earned - paid
};

type PeriodSession = EarningsSession & { date: Date };
type PeriodPayout = { period: string; net: number };

/**
 * Returns periods where the healer has earned money but has not been fully
 * paid. Periods with zero earnings (e.g. only free demo sessions) are excluded.
 * Periods where `earned === paid` are also excluded (fully settled).
 * Results are sorted oldest-first.
 */
export function computePendingPeriods(
  profile: EarningsProfile,
  sessions: PeriodSession[],
  payouts: PeriodPayout[],
): PendingPeriod[] {
  // Accumulate earned per period
  const earned = new Map<string, number>();
  for (const s of sessions) {
    const e = computeSessionEarning(profile, s);
    if (e === 0) continue;
    const period = formatPeriod(s.date.getFullYear(), s.date.getMonth() + 1);
    earned.set(period, (earned.get(period) ?? 0) + e);
  }

  // Index payouts by period
  const paidMap = new Map<string, number>();
  for (const p of payouts) {
    paidMap.set(p.period, (paidMap.get(p.period) ?? 0) + p.net);
  }

  const result: PendingPeriod[] = [];
  for (const [period, totalEarned] of earned) {
    const paid = paidMap.get(period) ?? 0;
    const pending = totalEarned - paid;
    if (pending <= 0) continue;
    result.push({ period, label: periodLabel(period), earned: totalEarned, paid, pending });
  }

  result.sort((a, b) => a.period.localeCompare(b.period));
  return result;
}
