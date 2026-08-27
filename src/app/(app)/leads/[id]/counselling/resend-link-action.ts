"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getWhatsAppProvider } from "@/lib/providers/whatsapp";
import { format } from "date-fns";

export async function resendMeetingLinkAction(sessionId: string, clientId: string) {
  await requireSession();

  const counselling = await prisma.counselingSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { client: true, counsellor: true },
  });

  if (!counselling.meetLink) {
    throw new Error("No meeting link found for this session.");
  }

  await getWhatsAppProvider().sendTemplate({
    clientId: counselling.clientId,
    phone: counselling.client.phone,
    templateName: "session_join_link",
    variables: [
      counselling.client.name.split(" ")[0],
      format(counselling.scheduledAt, "dd MMM, HH:mm"),
      counselling.counsellor.name,
      counselling.meetLink,
    ],
  });

  revalidatePath(`/leads/${clientId}`);
}
