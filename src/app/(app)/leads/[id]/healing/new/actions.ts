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
  const sessionType = String(formData.get("sessionType") ?? "PAID") as "DEMO" | "PAID" | "FOLLOW_UP";
  const colorsUsed = formData.getAll("colorsUsed").map(String);
  const cleansingActions = formData.getAll("cleansingActions").map(String);
  const energisingActions = formData.getAll("energisingActions").map(String);
  const creditUsed = formData.get("creditUsed") === "true";
  const followUpNeeded = formData.get("followUpNeeded") === "true";
  const nextRec = String(formData.get("nextSessionRecommendedAt") ?? "");

  // Chakra state maps arrive as JSON strings from the v2 form.
  const tryParse = (s: FormDataEntryValue | null): Record<string, string> => {
    try { return s ? JSON.parse(String(s)) as Record<string, string> : {}; }
    catch { return {}; }
  };
  const chakraStatesBefore = tryParse(formData.get("chakraStatesBefore"));
  const chakraStatesAfter  = tryParse(formData.get("chakraStatesAfter"));
  // Derive the legacy chakras[] list from before-state keys for back-compat.
  const chakras = Object.keys(chakraStatesBefore);

  try {
    await logHealingSession({
      clientId,
      healerId,
      mode,
      sessionType,
      chakras: chakras as never,
      chakraStatesBefore,
      chakraStatesAfter,
      cleansingActions: cleansingActions as never,
      energisingActions: energisingActions as never,
      colorsUsed: colorsUsed as never,
      process: String(formData.get("process") ?? "") || undefined,
      durationMinutes: formData.get("durationMinutes")
        ? Number(formData.get("durationMinutes"))
        : undefined,
      remarks: String(formData.get("remarks") ?? "") || undefined,
      clientResponse: String(formData.get("clientResponse") ?? "") || undefined,
      followUpNeeded,
      nextSessionRecommendedAt: nextRec ? new Date(nextRec) : undefined,
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
