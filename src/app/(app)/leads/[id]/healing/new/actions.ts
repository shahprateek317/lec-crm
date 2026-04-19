"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { logHealingSession, getCreditBalance } from "@/lib/credits";
import { getWhatsAppProvider } from "@/lib/providers/whatsapp";
import { prisma } from "@/lib/prisma";

export async function logHealingSessionAction(formData: FormData) {
  await requireSession();
  const clientId = String(formData.get("clientId") ?? "");
  const healerId = String(formData.get("healerId") ?? "");
  const mode = String(formData.get("mode") ?? "IN_PERSON") as "IN_PERSON" | "DISTANT";
  const chakras = formData.getAll("chakras").map(String);
  const creditUsed = formData.get("creditUsed") === "true";

  try {
    await logHealingSession({
      clientId,
      healerId,
      mode,
      chakras: chakras as never,
      process: String(formData.get("process") ?? "") || undefined,
      durationMinutes: formData.get("durationMinutes")
        ? Number(formData.get("durationMinutes"))
        : undefined,
      remarks: String(formData.get("remarks") ?? "") || undefined,
      creditUsed,
    });
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "Failed");
    redirect(`/leads/${clientId}/healing/new?error=${msg}`);
  }

  // After save, check balance — if zero, WhatsApp a low-credits alert.
  const balance = await getCreditBalance(clientId);
  if (creditUsed && balance <= 0) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (client) {
      getWhatsAppProvider()
        .sendTemplate({
          clientId,
          phone: client.phone,
          templateName: "low_credits",
          variables: [client.name.split(" ")[0], String(balance)],
        })
        .catch((err) => console.error("[healing] low_credits WhatsApp failed", err));
    }
  }

  revalidatePath(`/leads/${clientId}`);
  revalidatePath(`/healing`);
  redirect(`/leads/${clientId}`);
}
