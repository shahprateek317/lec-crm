// Pre-session reminder cron — pure logic + Prisma-backed runner.
//
// 1 hour before a scheduled HealingSession, we send the client a
// WhatsApp ping using the healing_reminder_1h template. The cron fires
// hourly; idempotent via HealingSession.reminderSentAt (NULL until the
// first successful send, then a timestamp).
//
// Window: [now+55min, now+65min]. We deliberately don't use a tight
// [now+59m, now+61m] window because the cron may run a few minutes
// late under load; a 10-minute window is generous and still feels
// like "about an hour from now" to the client.
//
// The runner is split into:
//   - findSessionsNeedingReminder()   pure: returns the IDs the cron
//                                     should ping given a store + now
//   - sendReminderForSession()        production: composes the template
//                                     args, fires via the provider,
//                                     marks reminderSentAt, writes a
//                                     Notification for the healer
//
// The pure helper is unit-tested against an in-memory fake store.

import { addMinutes, format } from "date-fns";

// Window edges relative to "now". Lower bound INCLUSIVE, upper EXCLUSIVE
// so consecutive 10-min cron runs partition cleanly: run-T covers
// [T+55, T+65); run-T+10 covers [T+65, T+75). A session at exactly
// T+65 falls in run-T+10 only.
export const REMINDER_WINDOW_LEAD_MIN_MIN = 55;
export const REMINDER_WINDOW_LEAD_MAX_MIN = 65;

export type CandidateSession = {
  id: string;
  date: Date;
  clientId: string;
  healerId: string;
  mode: "IN_PERSON" | "DISTANT";
};

export interface ReminderStore {
  /** Sessions in [now+55m, now+65m] with reminderSentAt IS NULL. */
  findCandidates(input: { from: Date; to: Date }): Promise<CandidateSession[]>;
}

/**
 * Pure: given a store + the current time, returns the candidate
 * sessions that should be reminded right now.
 *
 * Caller is responsible for calling sendReminderForSession() on each
 * and updating reminderSentAt — separation lets us swap the send
 * mechanism (template vs text) without rewriting the query.
 */
export async function findSessionsNeedingReminder(
  store: ReminderStore,
  now: Date,
): Promise<CandidateSession[]> {
  return store.findCandidates({
    from: addMinutes(now, REMINDER_WINDOW_LEAD_MIN_MIN),
    to:   addMinutes(now, REMINDER_WINDOW_LEAD_MAX_MIN),
  });
}

// ── Template-arg formatting ──────────────────────────────────────────
// Pure too — given the session metadata, return the {{1}}-{{4}} args
// for the healing_reminder_1h template. Unit-tested.

export function formatReminderArgs(input: {
  clientFirstName: string;
  healerName: string;
  date: Date;
  mode: "IN_PERSON" | "DISTANT";
}): [string, string, string, string] {
  return [
    input.clientFirstName,
    input.healerName,
    format(input.date, "h:mm a"),
    input.mode === "IN_PERSON" ? "in person at the centre" : "distant healing",
  ];
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}
