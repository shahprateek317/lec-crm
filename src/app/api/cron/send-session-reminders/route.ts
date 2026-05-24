// Pre-session reminder cron — hourly nudge to clients ~1 hour before
// their scheduled HealingSession.
//
// Triggered by EC2 crond (see scripts/install-reminder-cron.sh) or
// Vercel cron (vercel.json). Auth via Authorization: Bearer
// $CRON_SECRET — same shape as the reconciler cron.
//
// Idempotent: each session has a HealingSession.reminderSentAt that
// we set on successful send. A re-run won't double-ping because the
// store filters reminderSentAt IS NULL.
//
// What it does per candidate:
//   1. Send WhatsApp template healing_reminder_1h via the provider
//   2. Mark reminderSentAt = now
//   3. Create a Notification for the healer ("Session with X starts in 1h")
//
// Failures on individual sessions log + continue. The route returns
// a JSON summary with counts for monitoring.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getWhatsAppProvider } from "@/lib/providers/whatsapp";
import { notify } from "@/lib/notify";
import {
  findSessionsNeedingReminder,
  formatReminderArgs,
  firstName,
  REMINDER_WINDOW_LEAD_MIN_MIN,
  REMINDER_WINDOW_LEAD_MAX_MIN,
  type ReminderStore,
} from "@/lib/reminders";
import { addMinutes } from "date-fns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120; // 2 min — plenty for hourly batch size

// Take cap for one cron pass. Loop in BATCHES_MAX runs of CANDIDATE_BATCH
// each to drain a backlog without unbounded work; alert via console if
// we ever fill the cap (signals a burst that may need ops attention).
const CANDIDATE_BATCH = 200;
const BATCHES_MAX = 5;

const prismaReminderStore: ReminderStore = {
  async findCandidates({ from, to }) {
    const rows = await prisma.healingSession.findMany({
      where: {
        // Upper bound EXCLUSIVE so consecutive cron windows partition
        // cleanly (see reminders.ts window doc).
        date: { gte: from, lt: to },
        reminderSentAt: null,
      },
      select: {
        id: true,
        date: true,
        clientId: true,
        healerId: true,
        mode: true,
      },
      take: CANDIDATE_BATCH,
    });
    return rows;
  },
};

export async function GET(): Promise<NextResponse> {
  const h = await headers();
  const provided = h.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "";

  if (!secret) {
    console.error("[cron/send-session-reminders] CRON_SECRET not set — refusing to run");
    return NextResponse.json({ ok: false, error: "cron_secret_unset" }, { status: 500 });
  }
  if (provided !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const now = new Date();
  const provider = getWhatsAppProvider();

  let totalCandidates = 0;
  let sent = 0;
  let failed = 0;
  let skippedDeleted = 0;
  const errors: Array<{ sessionId: string; error: string }> = [];

  // Drain the backlog in batches so a busy window isn't truncated to
  // CANDIDATE_BATCH and forgotten.
  for (let batch = 0; batch < BATCHES_MAX; batch++) {
    const candidates = await findSessionsNeedingReminder(prismaReminderStore, now);
    if (candidates.length === 0) break;
    totalCandidates += candidates.length;

    for (const c of candidates) {
      // ── Atomic claim ────────────────────────────────────────────────
      // The order is critical: SET reminderSentAt = now() BEFORE the
      // WhatsApp send. If the send fails, we null the column back out
      // so a later cron run retries. Worst case: we mark sent but the
      // process dies before sending — the client misses the reminder
      // (acceptable). The alternative (send first, mark second) risks
      // double-pings if marking fails, which is much worse UX.
      const claimResult = await prisma.healingSession.updateMany({
        where: { id: c.id, reminderSentAt: null },
        data: { reminderSentAt: new Date() },
      });
      if (claimResult.count === 0) {
        // Another concurrent cron run (overlapping invocations) won the
        // claim. Skip silently.
        continue;
      }

      try {
        const [client, healer] = await Promise.all([
          prisma.client.findUnique({
            where: { id: c.clientId },
            select: { name: true, phone: true, deletedAt: true },
          }),
          prisma.user.findUnique({
            where: { id: c.healerId },
            select: { name: true },
          }),
        ]);
        if (!client || !healer) {
          throw new Error("client or healer not found");
        }
        // Skip soft-deleted clients — they shouldn't receive new
        // outbound messages even before the tombstone reconciler runs.
        if (client.deletedAt) {
          skippedDeleted += 1;
          continue; // claim stays; soft-deleted clients shouldn't be
                    // retried either.
        }

        const args = formatReminderArgs({
          clientFirstName: firstName(client.name),
          healerName: healer.name,
          date: c.date,
          mode: c.mode,
        });

        await provider.sendTemplate({
          clientId: c.clientId,
          phone: client.phone,
          templateName: "healing_reminder_1h",
          variables: args,
        });

        // notify() is best-effort decoration; failure here is just a
        // missing bell entry, not a missing WhatsApp. Isolate so a
        // notify exception doesn't mark this send as failed.
        try {
          await notify({
            recipientId: c.healerId,
            kind: "SESSION_REMINDER_1H",
            title: `Session with ${firstName(client.name)} in about an hour`,
            body: `${args[2]} · ${args[3]}`,
            href: `/healing/${c.id}`,
          });
        } catch (notifyErr) {
          console.error("[cron/send-session-reminders] notify failed", c.id, notifyErr);
        }

        sent += 1;
      } catch (err) {
        // Send failed — give up the claim so a future run retries.
        const msg = err instanceof Error ? err.message : String(err);
        await prisma.healingSession.update({
          where: { id: c.id },
          data: { reminderSentAt: null },
        }).catch((rollbackErr) => {
          console.error("[cron/send-session-reminders] claim rollback failed", c.id, rollbackErr);
        });
        console.error("[cron/send-session-reminders] send failed", c.id, msg);
        errors.push({ sessionId: c.id, error: msg });
        failed += 1;
      }
    }

    if (candidates.length < CANDIDATE_BATCH) break;
  }

  // Warn loudly if we hit the batch cap — signals a burst that may
  // need ops attention (more cron runs / wider window).
  if (totalCandidates >= CANDIDATE_BATCH * BATCHES_MAX) {
    console.warn(
      `[cron/send-session-reminders] hit batch cap of ${CANDIDATE_BATCH * BATCHES_MAX}; ` +
      `some sessions may have been left for the next run`,
    );
  }

  const elapsedMs = Date.now() - started;
  console.log("[cron/send-session-reminders] run complete", {
    candidates: totalCandidates, sent, failed, skippedDeleted, elapsedMs,
  });

  return NextResponse.json({
    ok: true,
    elapsedMs,
    window: {
      from: addMinutes(now, REMINDER_WINDOW_LEAD_MIN_MIN).toISOString(),
      to:   addMinutes(now, REMINDER_WINDOW_LEAD_MAX_MIN).toISOString(),
    },
    candidates: totalCandidates,
    sent,
    failed,
    skippedDeleted,
    errors: errors.slice(0, 10),
  });
}
