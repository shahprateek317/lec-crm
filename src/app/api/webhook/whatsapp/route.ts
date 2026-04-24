// WhatsApp Cloud API webhook — delivery status + inbound messages.
//
// Verification (GET): Meta calls with ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…
// Receiver (POST): { entry: [{ changes: [{ value: { statuses?, messages? } }] }] }
//
// Configure in Meta App Dashboard: GET+POST https://<your-domain>/api/webhook/whatsapp
// Verify token must match WHATSAPP_VERIFY_TOKEN in .env.local.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetting, SETTING_KEYS } from "@/lib/settings";

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
};

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
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
        const phone = "+" + msg.from;
        const client = await prisma.client.findUnique({ where: { phone } });
        const body = msg.text?.body ?? `[${msg.type}]`;
        await prisma.whatsAppMessage.create({
          data: {
            clientId: client?.id,
            phone,
            direction: "INBOUND",
            body,
            status: "DELIVERED",
            providerMessageId: msg.id,
            sentAt: new Date(Number(msg.timestamp) * 1000),
          },
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
