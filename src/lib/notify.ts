// In-app notifications for staff users.
//
// Writes a row to the Notification table that the bell in the staff
// layout reads. Failure is logged + swallowed — a missing notification
// must never break the primary user flow (same policy as audit()).
//
// Use whenever the system mutates state that a specific staff user
// should know about: a new inbound WhatsApp message for an assigned
// thread, a quality flag for a healer, a cert verified, etc. Keep the
// `title` short (fits in 40 chars) and put detail in `body`. `href`
// drives the click target; without it the bell entry is read-only.

import { prisma } from "@/lib/prisma";
import type { NotificationKind } from "@prisma/client";

// ── Preference helpers ───────────────────────────────────────────────────────

/**
 * Returns true if the user has NOT disabled this notification kind.
 * Absence of a preference row = enabled (default-on).
 */
export async function isKindEnabled(
  userId: string,
  kind: NotificationKind,
): Promise<boolean> {
  const rows = await prisma.notificationPreference.findMany({
    where: { userId },
  });
  const row = rows.find((r) => r.kind === kind);
  return row ? row.enabled : true;
}

/**
 * Persist a map of kind→enabled for a user.
 * Rows for enabled=true are deleted (restore default); rows for enabled=false
 * are upserted so the gate can find them quickly.
 */
export async function savePreferences(
  userId: string,
  prefs: Partial<Record<NotificationKind, boolean>>,
): Promise<void> {
  const toDisable = (Object.entries(prefs) as [NotificationKind, boolean][])
    .filter(([, v]) => !v)
    .map(([k]) => k);
  const toEnable = (Object.entries(prefs) as [NotificationKind, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => k);

  await Promise.all([
    ...toDisable.map((kind) =>
      prisma.notificationPreference.upsert({
        where: { userId_kind: { userId, kind } },
        update: { enabled: false },
        create: { userId, kind, enabled: false },
      }),
    ),
    toEnable.length > 0
      ? prisma.notificationPreference.deleteMany({
          where: { userId, kind: { in: toEnable } },
        })
      : Promise.resolve(),
  ]);
}

export type NotifyOpts = {
  recipientId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  href?: string;
};

export async function notify(opts: NotifyOpts): Promise<void> {
  try {
    // Respect per-user opt-outs. Failure to read prefs is non-fatal — we
    // default to sending rather than silently dropping notifications.
    const enabled = await isKindEnabled(opts.recipientId, opts.kind).catch(() => true);
    if (!enabled) return;

    await prisma.notification.create({
      data: {
        recipientId: opts.recipientId,
        kind: opts.kind,
        title: opts.title,
        body: opts.body ?? null,
        href: opts.href ?? null,
      },
    });
  } catch (err) {
    console.warn("[notify] write failed", { kind: opts.kind, recipientId: opts.recipientId }, err);
  }
}

/**
 * Fan-out: write the same notification to multiple recipients.
 * Each write is independent — one failure doesn't block the rest.
 */
export async function notifyMany(
  recipientIds: string[],
  shared: Omit<NotifyOpts, "recipientId">,
): Promise<void> {
  if (recipientIds.length === 0) return;
  // De-dupe so we don't double-notify if a user shows up twice (e.g. a
  // coordinator who's also the assignee).
  const unique = Array.from(new Set(recipientIds));
  await Promise.all(unique.map((recipientId) => notify({ ...shared, recipientId })));
}

/** Convenience: mark a single notification as read for the recipient. */
export async function markNotificationRead(id: string, recipientId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id, recipientId, readAt: null },
    data: { readAt: new Date() },
  });
}

/** Convenience: mark every unread notification read for the user. */
export async function markAllNotificationsRead(recipientId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { recipientId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
