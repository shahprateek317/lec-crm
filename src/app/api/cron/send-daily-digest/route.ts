// Daily email digest cron — 02:30 UTC (08:00 IST).
//
// For each active staff user with unread notifications:
//   1. Build HTML + text digest from their unread notifications.
//   2. Send via the configured email provider (stub | resend).
//   3. Mark sent notifications as read (so tomorrow's digest is fresh).
//
// Auth: Bearer $CRON_SECRET (same as all other cron routes).
// Idempotent in spirit: marking read prevents repeat sends in the same day.
// If a send fails we leave notifications unread so the next run retries.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { buildDigestHtml, buildDigestText, shouldSendDigest } from "@/lib/digest";
import { sendEmail } from "@/lib/providers/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const APP_URL = process.env.AUTH_URL?.replace(/\/$/, "") ?? "https://crm.lifeenergycentre.in";

export async function GET(): Promise<NextResponse> {
  const h = await headers();
  const provided = h.get("authorization") ?? "";
  const secret   = process.env.CRON_SECRET ?? "";

  if (!secret) {
    console.error("[cron/send-daily-digest] CRON_SECRET not set");
    return NextResponse.json({ ok: false, error: "cron_secret_unset" }, { status: 500 });
  }
  if (provided !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const started = Date.now();

  // Load all active staff users who have at least one unread notification.
  const users = await prisma.user.findMany({
    where: {
      active: true,
      email: { not: "" },           // skip seed accounts without real emails
      notifications: { some: { readAt: null } },
    },
    select: {
      id:    true,
      name:  true,
      email: true,
      notifications: {
        where:   { readAt: null },
        orderBy: { createdAt: "desc" },
        take:    50,                  // cap per user — avoids huge emails
        select: { id: true, kind: true, title: true, body: true, href: true, createdAt: true },
      },
    },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ userId: string; error: string }> = [];

  for (const user of users) {
    const notifs = user.notifications;
    if (!shouldSendDigest(notifs)) { skipped++; continue; }

    const subject = `Your daily digest — ${notifs.length} unread notification${notifs.length !== 1 ? "s" : ""}`;
    const html    = buildDigestHtml(user.name, notifs, APP_URL);
    const text    = buildDigestText(user.name, notifs);

    const result = await sendEmail({ to: user.email, subject, html, text });

    if (!result.ok) {
      console.error("[cron/send-daily-digest] send failed", { userId: user.id, error: result.error });
      errors.push({ userId: user.id, error: result.error });
      failed++;
      continue;
    }

    // Mark sent notifications as read — keeps the digest fresh each day.
    await prisma.notification.updateMany({
      where: { id: { in: notifs.map((n) => n.id) }, readAt: null },
      data:  { readAt: new Date() },
    }).catch((err) => {
      console.error("[cron/send-daily-digest] markRead failed", user.id, err);
    });

    sent++;
  }

  const elapsedMs = Date.now() - started;
  console.log("[cron/send-daily-digest] run complete", { sent, skipped, failed, elapsedMs });

  return NextResponse.json({ ok: true, elapsedMs, sent, skipped, failed, errors: errors.slice(0, 10) });
}
