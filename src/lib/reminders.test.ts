// Tests for the pre-session reminder library.
//
// Covers:
//   - findSessionsNeedingReminder: window edges (inclusive lower, exclusive
//     upper feel), uses the store's filter, returns what the store gives
//   - formatReminderArgs: time formatting + mode label, edge cases
//   - firstName: split on whitespace, fallback when empty

import { describe, it, expect } from "vitest";
import { addMinutes } from "date-fns";
import {
  findSessionsNeedingReminder,
  formatReminderArgs,
  firstName,
  REMINDER_WINDOW_LEAD_MIN_MIN,
  REMINDER_WINDOW_LEAD_MAX_MIN,
  type CandidateSession,
  type ReminderStore,
} from "./reminders";

function makeStore() {
  const sessions: CandidateSession[] = [];
  let lastFilter: { from: Date; to: Date } | null = null;
  const store: ReminderStore = {
    async findCandidates({ from, to }) {
      lastFilter = { from, to };
      return sessions.filter((s) => s.date >= from && s.date <= to);
    },
  };
  return {
    store,
    add(s: CandidateSession) { sessions.push(s); },
    get filter() { return lastFilter; },
  };
}

describe("findSessionsNeedingReminder", () => {
  const now = new Date("2026-05-24T12:00:00Z");

  it("passes a 55–65 minute lead window to the store", async () => {
    const fake = makeStore();
    await findSessionsNeedingReminder(fake.store, now);
    expect(fake.filter).not.toBeNull();
    expect(fake.filter!.from.getTime()).toBe(addMinutes(now, REMINDER_WINDOW_LEAD_MIN_MIN).getTime());
    expect(fake.filter!.to.getTime()).toBe(addMinutes(now, REMINDER_WINDOW_LEAD_MAX_MIN).getTime());
  });

  it("returns sessions whose date falls in the window", async () => {
    const fake = makeStore();
    fake.add({ id: "s1", date: addMinutes(now, 60), clientId: "c1", healerId: "h1", mode: "IN_PERSON" });
    const out = await findSessionsNeedingReminder(fake.store, now);
    expect(out.map((s) => s.id)).toEqual(["s1"]);
  });

  it("excludes sessions outside the window", async () => {
    const fake = makeStore();
    fake.add({ id: "too_soon", date: addMinutes(now, 30), clientId: "c", healerId: "h", mode: "DISTANT" });
    fake.add({ id: "too_far",  date: addMinutes(now, 120), clientId: "c", healerId: "h", mode: "DISTANT" });
    const out = await findSessionsNeedingReminder(fake.store, now);
    expect(out).toEqual([]);
  });

  it("returns empty when no candidates", async () => {
    const fake = makeStore();
    const out = await findSessionsNeedingReminder(fake.store, now);
    expect(out).toEqual([]);
  });
});

describe("formatReminderArgs", () => {
  it("composes [firstName, healer, time, mode-label] for IN_PERSON", () => {
    const args = formatReminderArgs({
      clientFirstName: "Asha",
      healerName: "Ravi Kumar",
      date: new Date("2026-05-24T17:30:00"),
      mode: "IN_PERSON",
    });
    expect(args[0]).toBe("Asha");
    expect(args[1]).toBe("Ravi Kumar");
    expect(args[2]).toMatch(/5:30 PM/i);
    expect(args[3]).toBe("in person at the centre");
  });

  it("uses 'distant healing' for DISTANT mode", () => {
    const args = formatReminderArgs({
      clientFirstName: "B",
      healerName: "H",
      date: new Date(),
      mode: "DISTANT",
    });
    expect(args[3]).toBe("distant healing");
  });
});

describe("firstName", () => {
  it("returns the first whitespace-delimited token", () => {
    expect(firstName("Asha Patel")).toBe("Asha");
    expect(firstName("Dr. Ravi Kumar")).toBe("Dr.");
  });

  it("handles single-name input", () => {
    expect(firstName("Madonna")).toBe("Madonna");
  });

  it("trims surrounding whitespace", () => {
    expect(firstName("  Asha   ")).toBe("Asha");
  });

  it("falls back to the original when empty", () => {
    // An empty string has no tokens; we return the original (also empty)
    // so the WhatsApp template doesn't get an "undefined" string.
    expect(firstName("")).toBe("");
  });
});
