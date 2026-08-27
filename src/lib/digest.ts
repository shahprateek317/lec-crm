// Daily email digest helpers — pure functions, no I/O.
//
// `buildDigestHtml` renders the email body. `buildDigestText` is the
// plain-text fallback. Both are called by the cron route.

import type { NotificationKind } from "@prisma/client";

export type DigestNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: Date;
};

// Friendly labels for each kind in the email (same as the settings page).
const KIND_LABEL: Partial<Record<NotificationKind, string>> = {
  NEW_INBOUND_MESSAGE:          "New messages",
  NEW_HEALING_ASSIGNMENT:       "Healing assignments",
  SESSION_REMINDER_1H:          "Session reminders",
  CLIENT_DID_NOT_CONFIRM_START: "Missed confirmations",
  QC_FLAGGED_SESSION:           "QC flags",
  CERT_VERIFIED:                "Certificates verified",
  REFERRAL_REWARD_GRANTED:      "Referral rewards",
  PAYMENT_RECEIVED:             "Payments received",
  COURSE_ENROLMENT:             "Course enrolments",
  OTHER:                        "Other",
};

export function shouldSendDigest(notifications: DigestNotification[]): boolean {
  return notifications.length > 0;
}

export function groupByKind(
  notifications: DigestNotification[],
): Map<NotificationKind, DigestNotification[]> {
  const map = new Map<NotificationKind, DigestNotification[]>();
  for (const n of notifications) {
    const existing = map.get(n.kind);
    if (existing) existing.push(n);
    else map.set(n.kind, [n]);
  }
  return map;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildDigestText(
  userName: string,
  notifications: DigestNotification[],
): string {
  const count = notifications.length;
  const lines = [
    `Good morning, ${userName}!`,
    ``,
    `You have ${count} unread notification${count !== 1 ? "s" : ""} in the Life Energy Centre CRM.`,
    ``,
  ];

  const groups = groupByKind(notifications);
  for (const [kind, items] of groups) {
    lines.push(`── ${KIND_LABEL[kind] ?? kind} (${items.length})`);
    for (const item of items.slice(0, 5)) {
      lines.push(`   • ${item.title}${item.body ? ` — ${item.body}` : ""}`);
    }
    if (items.length > 5) lines.push(`   … and ${items.length - 5} more`);
    lines.push(``);
  }

  lines.push(`Sign in to view and action these: https://crm.lifeenergycentre.in/dashboard`);
  return lines.join("\n");
}

export function buildDigestHtml(
  userName: string,
  notifications: DigestNotification[],
  appUrl: string,
): string {
  const count = notifications.length;
  const groups = groupByKind(notifications);

  const groupsHtml = Array.from(groups.entries())
    .map(([kind, items]) => {
      const rowsHtml = items
        .slice(0, 5)
        .map(
          (item) => `
          <tr>
            <td style="padding:6px 0;border-bottom:1px solid #f0ece6;font-size:14px;color:#3d3530;">
              ${item.href
                ? `<a href="${appUrl}${escapeHtml(item.href)}" style="color:#7c3aed;text-decoration:none;">${escapeHtml(item.title)}</a>`
                : escapeHtml(item.title)}
              ${item.body ? `<span style="color:#8a7d72;font-size:12px;"> — ${escapeHtml(item.body)}</span>` : ""}
            </td>
          </tr>`,
        )
        .join("");
      const moreHtml =
        items.length > 5
          ? `<tr><td style="padding:4px 0;font-size:12px;color:#8a7d72;">… and ${items.length - 5} more</td></tr>`
          : "";

      return `
        <tr>
          <td style="padding:16px 0 4px;">
            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#8a7d72;">
              ${escapeHtml(KIND_LABEL[kind] ?? kind)} &middot; ${items.length}
            </p>
          </td>
        </tr>
        ${rowsHtml}
        ${moreHtml}`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Your daily digest · Life Energy Centre</title>
</head>
<body style="margin:0;padding:0;background:#faf7f2;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#7c3aed;padding:24px 32px;">
            <p style="margin:0;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.7);">Life Energy Centre CRM</p>
            <h1 style="margin:4px 0 0;font-size:22px;font-weight:600;color:#ffffff;">Good morning, ${escapeHtml(userName)} ☀️</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:24px 32px 8px;">
            <p style="margin:0 0 16px;font-size:15px;color:#3d3530;">
              You have <strong>${count} unread notification${count !== 1 ? "s" : ""}</strong> since yesterday.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${groupsHtml}
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:24px 32px 32px;">
            <a href="${appUrl}/dashboard"
               style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">
              Open CRM →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f0ece6;">
            <p style="margin:0;font-size:11px;color:#b0a49a;">
              You're receiving this because you're a staff member at Life Energy Centre.
              To change notification preferences, visit
              <a href="${appUrl}/settings/notifications" style="color:#7c3aed;">Settings → Notifications</a>.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
