// Healing session check-in / check-out — May 2026 implementation of
// dad's "OTP at start/end" requirement, with the UX upgrade of one-tap
// WhatsApp links instead of memorised codes.
//
// Flow (per session):
//   1. Healer taps "Start"       → startSession() — generates startCheckInToken,
//                                  sets startedAt, sends WhatsApp template
//                                  with link https://crm…/confirm/<token>
//   2. Client taps link in WA    → confirmCheckIn(token) — sets
//                                  clientConfirmedStartAt = now()
//   3. Healer does the work.
//   4. Healer taps "End"         → endSession() — same flow with end token
//   5. Client taps end link      → confirmCheckIn(token) — sets
//                                  clientConfirmedEndAt = now()
//
// Anti-fraud properties:
//   • startedAt vs clientConfirmedStartAt skew ⇒ flagged in /quality if
//     gap > 5 minutes (healer claims a start the client never confirmed).
//   • endedAt − startedAt ⇒ healer's claim of session duration.
//   • clientConfirmedEndAt − clientConfirmedStartAt ⇒ proof of actual span.
//   • Sessions without a confirmedEnd are visible to quality controllers.
//
// Tokens are CUIDs (cryptographically-strong, unguessable). Each can only
// flip its own timestamp once — re-tapping is idempotent.

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getWhatsAppProvider } from "@/lib/providers/whatsapp";
import { env } from "@/lib/env";
import { format } from "date-fns";

// 24-char base64url token (144 bits of entropy) — unguessable, URL-safe.
function newToken(): string {
  return crypto.randomBytes(18).toString("base64url");
}

export type CheckInPhase = "start" | "end";

/** Public URL the client taps. Caddy + Next routes /confirm/[token] to confirmCheckIn(). */
export function buildConfirmUrl(token: string): string {
  const base = env.AUTH_URL?.replace(/\/$/, "") ?? "https://crm.lifeenergycentre.in";
  return `${base}/confirm/${token}`;
}

/** Healer-initiated start. Idempotent — repeated calls don't reset the token. */
export async function startSession(sessionId: string): Promise<{ token: string; url: string }> {
  const session = await prisma.healingSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      healer: { select: { id: true, name: true } },
    },
  });

  let token = session.startCheckInToken;
  if (!session.startedAt) {
    token = newToken();
    await prisma.healingSession.update({
      where: { id: sessionId },
      data: { startedAt: new Date(), startCheckInToken: token },
    });
  }
  if (!token) throw new Error("Failed to allocate start check-in token");

  const url = buildConfirmUrl(token);

  // Send the client the one-tap confirmation link via WhatsApp.
  // The 'session_check_in' template (utility) — text in seed.ts:
  //   "Namaste {{1}}, your session with {{2}} has begun. Tap to confirm: {{3}}"
  const phone = session.client.phone;
  if (phone) {
    getWhatsAppProvider().sendTemplate({
      clientId: session.client.id,
      phone,
      templateName: "session_check_in_start",
      variables: [
        session.client.name.split(" ")[0],
        session.healer.name,
        url,
      ],
    }).catch((err) => console.error("[check-in] start template send failed", err));
  }

  return { token, url };
}

/** Healer-initiated end. Idempotent. */
export async function endSession(sessionId: string): Promise<{ token: string; url: string }> {
  const session = await prisma.healingSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      healer: { select: { id: true, name: true } },
    },
  });

  let token = session.endCheckInToken;
  if (!session.endedAt) {
    token = newToken();
    await prisma.healingSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date(), endCheckInToken: token },
    });
  }
  if (!token) throw new Error("Failed to allocate end check-in token");

  const url = buildConfirmUrl(token);

  const phone = session.client.phone;
  if (phone) {
    getWhatsAppProvider().sendTemplate({
      clientId: session.client.id,
      phone,
      templateName: "session_check_in_end",
      variables: [
        session.client.name.split(" ")[0],
        session.healer.name,
        format(session.startedAt ?? new Date(), "HH:mm"),
        url,
      ],
    }).catch((err) => console.error("[check-in] end template send failed", err));
  }

  return { token, url };
}

/**
 * Token lookup — used by the public /confirm/[token] route.
 * Returns the session + which phase the token belongs to, or null if invalid.
 */
export async function lookupCheckInToken(token: string): Promise<
  | { phase: CheckInPhase; sessionId: string; clientName: string; healerName: string; alreadyConfirmed: boolean }
  | null
> {
  if (!token || token.length < 12) return null;
  const session = await prisma.healingSession.findFirst({
    where: {
      OR: [{ startCheckInToken: token }, { endCheckInToken: token }],
    },
    include: {
      client: { select: { name: true } },
      healer: { select: { name: true } },
    },
  });
  if (!session) return null;

  const isStart = session.startCheckInToken === token;
  const alreadyConfirmed = isStart
    ? session.clientConfirmedStartAt !== null
    : session.clientConfirmedEndAt !== null;

  return {
    phase: isStart ? "start" : "end",
    sessionId: session.id,
    clientName: session.client.name,
    healerName: session.healer.name,
    alreadyConfirmed,
  };
}

/** Records the client's confirmation. Idempotent — re-tap doesn't reset. */
export async function confirmCheckIn(token: string): Promise<{ phase: CheckInPhase; confirmedAt: Date } | null> {
  const found = await lookupCheckInToken(token);
  if (!found) return null;

  if (found.alreadyConfirmed) {
    // Report the existing timestamp.
    const existing = await prisma.healingSession.findUnique({
      where: { id: found.sessionId },
      select: { clientConfirmedStartAt: true, clientConfirmedEndAt: true },
    });
    return {
      phase: found.phase,
      confirmedAt:
        (found.phase === "start" ? existing?.clientConfirmedStartAt : existing?.clientConfirmedEndAt) ?? new Date(),
    };
  }

  const now = new Date();
  await prisma.healingSession.update({
    where: { id: found.sessionId },
    data:
      found.phase === "start"
        ? { clientConfirmedStartAt: now }
        : { clientConfirmedEndAt: now },
  });

  // Send healing summary WA after client confirms session end
  if (found.phase === "end") {
    const session = await prisma.healingSession.findUnique({
      where: { id: found.sessionId },
      select: { clientId: true, startedAt: true, summaryToken: true, client: { select: { name: true, phone: true } } },
    });
    if (session?.client.phone) {
      const firstName = session.client.name.split(" ")[0];
      const dateStr = (session.startedAt ?? now).toLocaleDateString("en-IN", { day: "numeric", month: "long" });

      let summaryToken = session.summaryToken;
      if (!summaryToken) {
        summaryToken = crypto.randomBytes(18).toString("base64url");
        await prisma.healingSession.update({ where: { id: found.sessionId }, data: { summaryToken } });
      }

      const base = process.env.AUTH_URL?.replace(/\/$/, "") ?? "https://crm.lifeenergycentre.in";
      const summaryUrl = `${base}/summary/${summaryToken}`;
      const wa = getWhatsAppProvider();

      void wa.sendTemplate({
        clientId: session.clientId,
        phone: session.client.phone,
        templateName: "healing_summary_1",
        variables: [firstName, dateStr, summaryUrl],
      }).catch((err) => console.error("[check-in] healing summary WA failed", err));

      // Send portal welcome WA on first ever confirmed session end
      const priorConfirmedSessions = await prisma.healingSession.count({
        where: {
          clientId: session.clientId,
          clientConfirmedEndAt: { not: null },
          id: { not: found.sessionId },
        },
      });
      if (priorConfirmedSessions === 0) {
        void wa.sendTemplate({
          clientId: session.clientId,
          phone: session.client.phone,
          templateName: "client_portal_welcome",
          variables: [firstName],
        }).catch((err) => console.error("[check-in] portal welcome WA failed", err));
      }
    }
  }

  return { phase: found.phase, confirmedAt: now };
}
