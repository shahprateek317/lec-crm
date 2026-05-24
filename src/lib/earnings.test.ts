// Tests for the healer earnings library.
//
// Covers:
//   - computeSessionEarning: happy path, demo handling (free vs paid),
//     incomplete sessions, missing config, rounding
//   - totalEarnings: sum across mixed sessions
//   - bucketEarnings: month/year boundaries, last-month exclusion of
//     current-month-day-1

import { describe, it, expect } from "vitest";
import {
  computeSessionEarning,
  totalEarnings,
  bucketEarnings,
  type EarningsProfile,
} from "./earnings";

const paidProfile: EarningsProfile = {
  perSessionCharge: 1000,
  revenueSharePercent: 60,
  acceptsDemoFree: true,
};

describe("computeSessionEarning", () => {
  it("computes per-session earning correctly for a completed PAID session", () => {
    expect(computeSessionEarning(paidProfile, { sessionType: "PAID", endedAt: new Date() })).toBe(600);
  });

  it("returns 0 for a session that never ended", () => {
    expect(computeSessionEarning(paidProfile, { sessionType: "PAID", endedAt: null })).toBe(0);
  });

  it("returns 0 for a DEMO session when healer accepts demos for free", () => {
    expect(computeSessionEarning(paidProfile, { sessionType: "DEMO", endedAt: new Date() })).toBe(0);
  });

  it("pays for a DEMO session when healer does NOT accept demos for free", () => {
    const p = { ...paidProfile, acceptsDemoFree: false };
    expect(computeSessionEarning(p, { sessionType: "DEMO", endedAt: new Date() })).toBe(600);
  });

  it("returns 0 when profile fee is missing", () => {
    expect(computeSessionEarning(
      { perSessionCharge: null, revenueSharePercent: 60, acceptsDemoFree: false },
      { sessionType: "PAID", endedAt: new Date() },
    )).toBe(0);
  });

  it("returns 0 when share percent is missing or 0", () => {
    expect(computeSessionEarning(
      { perSessionCharge: 1000, revenueSharePercent: null, acceptsDemoFree: false },
      { sessionType: "PAID", endedAt: new Date() },
    )).toBe(0);
    expect(computeSessionEarning(
      { perSessionCharge: 1000, revenueSharePercent: 0, acceptsDemoFree: false },
      { sessionType: "PAID", endedAt: new Date() },
    )).toBe(0);
  });

  it("rounds to whole rupees", () => {
    const p = { perSessionCharge: 333, revenueSharePercent: 33, acceptsDemoFree: false };
    // 333 * 0.33 = 109.89 → 110
    expect(computeSessionEarning(p, { sessionType: "PAID", endedAt: new Date() })).toBe(110);
  });

  it("counts FOLLOW_UP sessions like PAID", () => {
    expect(computeSessionEarning(paidProfile, { sessionType: "FOLLOW_UP", endedAt: new Date() })).toBe(600);
  });
});

describe("totalEarnings", () => {
  it("sums earnings across a mixed list, ignoring zeros", () => {
    const sessions = [
      { sessionType: "PAID" as const,    endedAt: new Date() },                    // 600
      { sessionType: "DEMO" as const,    endedAt: new Date() },                    // 0 (free demo)
      { sessionType: "PAID" as const,    endedAt: null },                          // 0 (incomplete)
      { sessionType: "FOLLOW_UP" as const, endedAt: new Date() },                 // 600
    ];
    expect(totalEarnings(paidProfile, sessions)).toBe(1200);
  });

  it("returns 0 for empty input", () => {
    expect(totalEarnings(paidProfile, [])).toBe(0);
  });
});

describe("bucketEarnings", () => {
  // Pinned now: 24 May 2026 (in the middle of May).
  const now = new Date(2026, 4, 24); // month is 0-indexed; 4 = May

  it("places this month's sessions in thisMonth (and not in lastMonth)", () => {
    const sessions = [
      { sessionType: "PAID" as const, endedAt: new Date(), date: new Date(2026, 4, 1) },
      { sessionType: "PAID" as const, endedAt: new Date(), date: new Date(2026, 4, 23) },
    ];
    const b = bucketEarnings(paidProfile, sessions, now);
    expect(b.thisMonth).toBe(1200);
    expect(b.lastMonth).toBe(0);
    expect(b.thisYear).toBe(1200);
    expect(b.lifetime).toBe(1200);
  });

  it("places last-month sessions in lastMonth (and not in thisMonth)", () => {
    const sessions = [
      { sessionType: "PAID" as const, endedAt: new Date(), date: new Date(2026, 3, 15) },
    ];
    const b = bucketEarnings(paidProfile, sessions, now);
    expect(b.thisMonth).toBe(0);
    expect(b.lastMonth).toBe(600);
    expect(b.thisYear).toBe(600);
    expect(b.lifetime).toBe(600);
  });

  it("excludes prior-year sessions from thisYear but counts them in lastYear", () => {
    const sessions = [
      { sessionType: "PAID" as const, endedAt: new Date(), date: new Date(2025, 11, 31) },
    ];
    const b = bucketEarnings(paidProfile, sessions, now);
    expect(b.thisMonth).toBe(0);
    expect(b.lastMonth).toBe(0);
    expect(b.thisYear).toBe(0);
    expect(b.lastYear).toBe(600);
    expect(b.lifetime).toBe(600);
  });

  it("Jan 1 regression: a Dec 31 session shows in lastMonth AND lastYear", () => {
    // Pinned now: 1 January 2026.
    const jan1 = new Date(2026, 0, 1);
    const sessions = [
      { sessionType: "PAID" as const, endedAt: new Date(), date: new Date(2025, 11, 31) },
    ];
    const b = bucketEarnings(paidProfile, sessions, jan1);
    expect(b.thisMonth).toBe(0);
    expect(b.lastMonth).toBe(600); // Dec 2025
    expect(b.thisYear).toBe(0);    // 2026 hasn't started accruing
    expect(b.lastYear).toBe(600);  // 2025 total
    expect(b.lifetime).toBe(600);
  });

  it("sessions older than lastYear count in lifetime only", () => {
    const sessions = [
      { sessionType: "PAID" as const, endedAt: new Date(), date: new Date(2023, 5, 15) },
    ];
    const b = bucketEarnings(paidProfile, sessions, now);
    expect(b.lifetime).toBe(600);
    expect(b.lastYear).toBe(0);
    expect(b.thisYear).toBe(0);
  });

  it("does not double-count the first day of the current month", () => {
    // 1 May 2026 00:00 — start of thisMonthStart, so it counts as thisMonth not lastMonth.
    const sessions = [
      { sessionType: "PAID" as const, endedAt: new Date(), date: new Date(2026, 4, 1) },
    ];
    const b = bucketEarnings(paidProfile, sessions, now);
    expect(b.thisMonth).toBe(600);
    expect(b.lastMonth).toBe(0);
  });

  it("ignores incomplete / free-demo sessions across all buckets", () => {
    const sessions = [
      { sessionType: "PAID" as const, endedAt: null,       date: new Date(2026, 4, 10) },
      { sessionType: "DEMO" as const, endedAt: new Date(), date: new Date(2026, 4, 10) }, // free demo
    ];
    const b = bucketEarnings(paidProfile, sessions, now);
    expect(b).toEqual({ thisMonth: 0, lastMonth: 0, thisYear: 0, lastYear: 0, lifetime: 0 });
  });
});
