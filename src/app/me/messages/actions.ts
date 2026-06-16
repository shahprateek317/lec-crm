"use server";

// Client-portal message composer.
//
// WhatsApp's Business API can only send FROM the centre's business number —
// it cannot make a client's own WhatsApp app send a message on our behalf.
// So a portal-typed message can't be relayed over real WhatsApp transport.
// Instead we write it into the same WhatsAppMessage/WhatsAppThread tables a
// real inbound WhatsApp message would use, so it shows up instantly in the
// coordinator's /inbox exactly like a WhatsApp reply would. The "2-way"
// channel is the portal + WhatsApp both feeding one unified thread, not a
// literal relay onto the client's WhatsApp account.

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireClient } from "@/lib/me-session";
import { prisma } from "@/lib/prisma";
import { touchThread } from "@/lib/providers/whatsapp";

const MAX_BODY_LENGTH = 2000;
const COOLDOWN_MS = 10_000;

export async function sendPortalMessageAction(formData: FormData) {
  const client = await requireClient("/me/messages");
  const body = String(formData.get("body") ?? "").trim();

  if (!body) redirect("/me/messages?error=Message+can%27t+be+empty");
  if (body.length > MAX_BODY_LENGTH) redirect("/me/messages?error=Message+is+too+long");

  const lastFromClient = await prisma.whatsAppMessage.findFirst({
    where: { clientId: client.id, direction: "INBOUND", providerMessageId: { startsWith: "portal_" } },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });
  if (lastFromClient?.sentAt && Date.now() - lastFromClient.sentAt.getTime() < COOLDOWN_MS) {
    redirect("/me/messages?error=Please+wait+a+few+seconds+before+sending+another+message");
  }

  const sentAt = new Date();
  await prisma.whatsAppMessage.create({
    data: {
      clientId: client.id,
      phone: client.phone,
      direction: "INBOUND",
      body,
      status: "DELIVERED",
      providerMessageId: `portal_${randomUUID()}`,
      sentAt,
    },
  });

  await touchThread({ clientId: client.id, direction: "INBOUND", at: sentAt }).catch(
    (err) => console.error("[me/messages] thread upsert failed", err),
  );

  revalidatePath("/me/messages");
  redirect("/me/messages");
}
