import { describe, it, expect } from "vitest";
import {
  parsePeriod,
  formatPeriod,
  currentPeriod,
  periodLabel,
  computePendingPeriods,
} from "./payout";

// ── parsePeriod / formatPeriod ───────────────────────────────────────────────

describe("parsePeriod", () => {
  it("parses a valid YYYY-MM string", () => {
    expect(parsePeriod("2026-05")).toEqual({ year: 2026, month: 5 });
  });

  it("throws on malformed string", () => {
    expect(() => parsePeriod("2026-5")).toThrow();
    expect(() => parsePeriod("26-05")).toThrow();
    expect(() => parsePeriod("2026-13")).toThrow();
    expect(() => parsePeriod("")).toThrow();
  });
});

describe("formatPeriod", () => {
  it("formats year+month to YYYY-MM", () => {
    expect(formatPeriod(2026, 5)).toBe("2026-05");
    expect(formatPeriod(2026, 12)).toBe("2026-12");
    expect(formatPeriod(2026, 1)).toBe("2026-01");
  });
});

describe("currentPeriod", () => {
  it("returns YYYY-MM for a given date", () => {
    expect(currentPeriod(new Date("2026-06-08"))).toBe("2026-06");
    expect(currentPeriod(new Date("2026-01-31"))).toBe("2026-01");
  });
});

describe("periodLabel", () => {
  it("returns a human-readable month label", () => {
    expect(periodLabel("2026-06")).toBe("June 2026");
    expect(periodLabel("2026-01")).toBe("January 2026");
    expect(periodLabel("2025-12")).toBe("December 2025");
  });
});

// ── computePendingPeriods ───────────────────────────────────────────────────

type Session = { date: Date; sessionType: "DEMO" | "PAID" | "FOLLOW_UP"; endedAt: Date | null };
type Profile = { perSessionCharge: number | null; revenueSharePercent: number | null; acceptsDemoFree: boolean };
type Payout = { period: string; net: number };

describe("computePendingPeriods", () => {
  const profile: Profile = { perSessionCharge: 1000, revenueSharePercent: 50, acceptsDemoFree: true };
  // each PAID completed session earns ₹500

  const session = (date: string, type: Session["sessionType"] = "PAID", ended = true): Session => ({
    date: new Date(date),
    sessionType: type,
    endedAt: ended ? new Date(date) : null,
  });

  it("returns empty array when no sessions", () => {
    expect(computePendingPeriods(profile, [], [])).toEqual([]);
  });

  it("marks a period as pending when there is no payout for it", () => {
    const sessions = [session("2026-05-10"), session("2026-05-20")];
    const result = computePendingPeriods(profile, sessions, []);
    expect(result).toHaveLength(1);
    expect(result[0].period).toBe("2026-05");
    expect(result[0].earned).toBe(1000); // 2 sessions × ₹500
    expect(result[0].paid).toBe(0);
    expect(result[0].pending).toBe(1000);
  });

  it("marks a period as fully paid when payout net equals earned", () => {
    const sessions = [session("2026-05-10")];
    const payouts: Payout[] = [{ period: "2026-05", net: 500 }];
    const result = computePendingPeriods(profile, sessions, payouts);
    // period is paid in full — not returned as a pending period
    expect(result.find((r) => r.period === "2026-05")).toBeUndefined();
  });

  it("marks a period as partially pending when payout is less than earned", () => {
    const sessions = [session("2026-05-10"), session("2026-05-20")]; // ₹1000 earned
    const payouts: Payout[] = [{ period: "2026-05", net: 300 }]; // ₹300 paid
    const result = computePendingPeriods(profile, sessions, payouts);
    expect(result).toHaveLength(1);
    expect(result[0].pending).toBe(700);
    expect(result[0].paid).toBe(300);
  });

  it("excludes free demo sessions from earned", () => {
    const sessions = [session("2026-05-10", "DEMO")]; // demo = free for this profile
    const result = computePendingPeriods(profile, sessions, []);
    expect(result).toHaveLength(0); // nothing earned, no pending period
  });

  it("handles multiple periods", () => {
    const sessions = [
      session("2026-04-15"), // ₹500 earned
      session("2026-05-10"), // ₹500 earned
      session("2026-05-20"), // ₹500 earned
    ];
    const payouts: Payout[] = [{ period: "2026-04", net: 500 }]; // April fully paid
    const result = computePendingPeriods(profile, sessions, payouts);
    // Only May should be pending
    expect(result).toHaveLength(1);
    expect(result[0].period).toBe("2026-05");
    expect(result[0].pending).toBe(1000);
  });

  it("excludes incomplete sessions", () => {
    const sessions = [session("2026-05-10", "PAID", false)]; // not ended
    const result = computePendingPeriods(profile, sessions, []);
    expect(result).toHaveLength(0);
  });
});
