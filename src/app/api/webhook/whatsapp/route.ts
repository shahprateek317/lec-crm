// WhatsApp Cloud API webhook — delivery status + inbound messages.
//
// Verification (GET): Meta calls with ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…
// Receiver (POST):    { entry: [{ changes: [{ value: { statuses?, messages? } }] }] }
//
// SECURITY: Every POST body MUST be HMAC-SHA256-signed by Meta using the
// App Secret. We read the raw body, verify the X-Hub-Signature-256 header,
// then parse + dispatch. Without the App Secret configured the webhook
// **fails closed** (returns 401) rather than processing unauthenticated
// payloads — accepting them would let anyone on the internet inject phantom
// inbound messages into /inbox.
//
// Configure in Meta App Dashboard:
//   • GET+POST https://<your-domain>/api/webhook/whatsapp
//   • Verify token: WHATSAPP_VERIFY_TOKEN (or /settings/whatsapp DB setting)
//   • App Secret:    WHATSAPP_APP_SECRET    (or /settings/whatsapp DB setting)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import { verifyWhatsAppSignature } from "@/lib/webhook-signing";
import { touchThread } from "@/lib/providers/whatsapp";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expected = await getSetting(SETTING_KEYS.whatsappVerifyToken);
  if (mode === "subscribe" && token && expected && token === expected) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

type StatusPayload = {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  errors?: Array<{ title?: string; message?: string }>;
};

type InboundMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  interactive?: {
    type: "button_reply" | "list_reply";
    button_reply?: { id: string; title: string };
  };
};

// Maps quick-reply button IDs to lead nextAction values
const BUTTON_ACTION_MAP: Record<string, string> = {
  COUNSELLING:    "COUNSELLING",
  PRANIC_DEMO:    "CENTER_VISIT_DEMO_HEALING",
  MEDITATION:     "MEDITATION_GROUP",
  CALL_BACK:      "TELEPHONIC_CALL",
  NOT_INTERESTED: "NOT_INTERESTED",
};

export async function POST(req: Request) {
  // Read raw bytes BEFORE any JSON parsing — Meta signs the exact body.
  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const appSecret = await getSetting(SETTING_KEYS.whatsappAppSecret);

  if (!verifyWhatsAppSignature(raw, signature, appSecret)) {
    // Fail closed. Do not leak which check failed (signature vs missing
    // secret) — a 401 with a generic message limits oracle attacks.
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const entries = (body as { entry?: Array<{ changes?: Array<{ value?: { statuses?: StatusPayload[]; messages?: InboundMessage[] } }> }> }).entry ?? [];

  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};

      // Delivery status updates
      for (const st of value.statuses ?? []) {
        const statusMap: Record<StatusPayload["status"], "SENT" | "DELIVERED" | "READ" | "FAILED"> = {
          sent: "SENT",
          delivered: "DELIVERED",
          read: "READ",
          failed: "FAILED",
        };
        await prisma.whatsAppMessage.updateMany({
          where: { providerMessageId: st.id },
          data: {
            status: statusMap[st.status],
            deliveredAt: st.status === "delivered" ? new Date(Number(st.timestamp) * 1000) : undefined,
            readAt: st.status === "read" ? new Date(Number(st.timestamp) * 1000) : undefined,
            errorMessage: st.errors?.[0]?.message,
          },
        }).catch((err) => console.error("[whatsapp webhook] status update failed", err));
      }

      // Inbound messages
      for (const msg of value.messages ?? []) {
        // Meta sends digits-only `from` (E.164 without +). Client.phone is
        // canonicalised to "+" + digits by the enquiry intake; we mirror
        // that here. Unmatched phones surface as orphan messages with
        // clientId = null and are rendered as "Unknown sender" threads
        // in /inbox (Phase 1b).
        const phone = "+" + msg.from;
        const client = await prisma.client.findUnique({
          where: { phone },
          select: { id: true, name: true, assignedToId: true, leadStatus: true },
        });

        // Resolve message body — for button replies use the button title
        const buttonId = msg.interactive?.button_reply?.id ?? null;
        const buttonTitle = msg.interactive?.button_reply?.title ?? null;
        const body = buttonTitle
          ? `[Button: ${buttonTitle}]`
          : msg.text?.body ?? `[${msg.type}]`;

        const sentAt = new Date(Number(msg.timestamp) * 1000);

        // Idempotent: Meta retries the entire webhook payload if we
        // don't 2xx within ~20s. providerMessageId is the natural key.
        await prisma.whatsAppMessage.upsert({
          where: { providerMessageId: msg.id },
          create: {
            clientId: client?.id,
            phone,
            direction: "INBOUND",
            body,
            status: "DELIVERED",
            providerMessageId: msg.id,
            sentAt,
          },
          update: {}, // no-op on retry; the original write is canonical
        });

        // ── Button reply: auto-update lead nextAction ──────────────────
        if (buttonId && client?.id) {
          const nextAction = BUTTON_ACTION_MAP[buttonId] ?? null;
          if (nextAction) {
            const isNotInterested = nextAction === "NOT_INTERESTED";
            await prisma.client.update({
              where: { id: client.id },
              data: {
                nextAction: nextAction as never,
                ...(isNotInterested ? { leadStatus: "NOT_INTERESTED" as never } : {}),
              },
            }).catch((err) => console.error("[whatsapp webhook] button nextAction update failed", err));

            // Notify assigned coordinator
            if (client.assignedToId) {
              const label: Record<string, string> = {
                COUNSELLING: "wants Counselling",
                CENTER_VISIT_DEMO_HEALING: "wants a Pranic Healing Demo",
                MEDITATION_GROUP: "wants to join Meditation Group",
                TELEPHONIC_CALL: "requested a Call Back",
                NOT_INTERESTED: "is Not Interested",
              };
              await prisma.notification.create({
                data: {
                  recipientId: client.assignedToId,
                  kind: "LEAD_REPLIED",
                  title: `${client.name} ${label[nextAction] ?? buttonTitle}`,
                  body: `Tap to open their lead and take action.`,
                  href: `/leads/${client.id}`,
                },
              }).catch((err) => console.error("[whatsapp webhook] button notify failed", err));
            }
          }
        }

        // Bump the thread aggregate for matched clients. Unknown senders
        // are handled by /inbox's orphan view (Phase 1b) — no thread row.
        if (client?.id) {
          await touchThread({
            clientId: client.id,
            direction: "INBOUND",
            at: sentAt,
          }).catch((err) => console.error("[whatsapp webhook] inbound thread upsert failed", err));
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
