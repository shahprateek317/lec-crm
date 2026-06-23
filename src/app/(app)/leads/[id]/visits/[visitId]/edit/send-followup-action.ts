"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getWhatsAppProvider } from "@/lib/providers/whatsapp";

export async function sendVisitFollowupAction(formData: FormData) {
  await requireSession();
  const visitId = String(formData.get("visitId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { client: { select: { name: true, phone: true, whatsappPhone: true } } },
  });
  if (!visit) throw new Error("Visit not found");

  // Build next steps from checkboxes
  const steps: string[] = [];
  if (formData.get("step_demo")) steps.push("• Further demo pranic healing session");
  if (formData.get("step_meditation")) steps.push("• Join our meditation group");
  if (formData.get("step_counselling")) steps.push("• Counselling session with our counsellor");
  if (formData.get("step_paid")) steps.push("• Full paid healing package");
  const customStep = String(formData.get("step_custom") ?? "").trim();
  if (customStep) steps.push(`• ${customStep}`);

  const nextSteps = steps.length > 0 ? steps.join("\n") : "Please contact us to discuss the best next step for you.";
  const firstName = visit.client.name.split(" ")[0];
  const phone = visit.client.whatsappPhone ?? visit.client.phone;

  if (phone) {
    await getWhatsAppProvider()
      .sendTemplate({
        clientId,
        phone,
        templateName: "visit_followup",
        variables: [firstName, nextSteps],
      });
  }

  redirect(`/leads/${clientId}?ok=1`);
}
