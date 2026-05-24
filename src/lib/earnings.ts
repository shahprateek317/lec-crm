// Healer earnings — pure aggregation helpers for /my-earnings.
//
// We don't model a separate Payout table yet (Phase 2c-ish). Earnings
// are derived from HealingSession + HealerProfile on read. This file
// is the single source of truth for the formula so /my-earnings, an
// admin payroll export (future), and any audit query all use the
// same numbers.
//
// Formula:
//   per-session-fee  = HealerProfile.perSessionCharge        (₹, integer)
//   revenue-share    = HealerProfile.revenueSharePercent / 100  (0–1)
//   earning(session) = per-session-fee × revenue-share
//
// Demo sessions (sessionType === "DEMO") earn the same as paid sessions
// IF the healer's `acceptsDemoFree` is false. If they accept demos for
// free, demos earn zero. We honor that flag here so the UI matches
// payroll without callers having to remember.
//
// Sessions only count toward earnings if they actually happened
// (endedAt IS NOT NULL). A session that was started but never ended
// is excluded — payroll needs proof of delivery.

export type EarningsProfile = {
  perSessionCharge: number | null;
  revenueSharePercent: number | null;
  acceptsDemoFree: boolean;
};

export type EarningsSession = {
  sessionType: "DEMO" | "PAID" | "FOLLOW_UP";
  endedAt: Date | null;
};

/**
 * Earning for a single session, in whole rupees. Returns 0 for sessions
 * that don't count (incomplete, unconfigured profile, free demo).
 */
export function computeSessionEarning(
  profile: EarningsProfile,
  session: EarningsSession,
): number {
  if (!session.endedAt) return 0;
  if (session.sessionType === "DEMO" && profile.acceptsDemoFree) return 0;

  const charge = profile.perSessionCharge ?? 0;
  const sharePct = profile.revenueSharePercent ?? 0;
  if (charge <= 0 || sharePct <= 0) return 0;

  // Round to whole rupees — payroll never deals in paise.
  return Math.round(charge * (sharePct / 100));
}

/** Sum of earnings across a list of sessions. */
export function totalEarnings(
  profile: EarningsProfile,
  sessions: EarningsSession[],
): number {
  return sessions.reduce((sum, s) => sum + computeSessionEarning(profile, s), 0);
}

/**
 * Bucket sessions into (this month / last month / this year / last year /
 * lifetime). `now` is injectable for testability; defaults to new Date().
 *
 * lastYear exists for the Jan-1 case: on 1 Jan, a 31 Dec session shows
 * up under lastMonth but would be invisible to thisYear (calendar year
 * just rolled over). The lastYear bucket gives the UI somewhere to
 * surface those earnings without surprising the healer.
 */
export function bucketEarnings(
  profile: EarningsProfile,
  sessions: Array<EarningsSession & { date: Date }>,
  now: Date = new Date(),
): {
  thisMonth: number;
  lastMonth: number;
  thisYear: number;
  lastYear: number;
  lifetime: number;
} {
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = thisMonthStart;
  const thisYearStart = new Date(now.getFullYear(), 0, 1);
  const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);

  let thisMonth = 0;
  let lastMonth = 0;
  let thisYear = 0;
  let lastYear = 0;
  let lifetime = 0;

  for (const s of sessions) {
    const e = computeSessionEarning(profile, s);
    if (e === 0) continue;
    lifetime += e;
    if (s.date >= thisYearStart) thisYear += e;
    else if (s.date >= lastYearStart) lastYear += e;
    if (s.date >= thisMonthStart) thisMonth += e;
    else if (s.date >= lastMonthStart && s.date < lastMonthEnd) lastMonth += e;
  }

  return { thisMonth, lastMonth, thisYear, lastYear, lifetime };
}
