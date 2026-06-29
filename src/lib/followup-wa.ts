// Sends a single WhatsApp template message for each stage completion.

import { getWhatsAppProvider } from "@/lib/providers/whatsapp";

const STAGE_TEMPLATE: Record<string, string> = {
  counselling:    "counselling_followup_1",
  pranic_group:   "pranic_group_followup_1",
  visit:          "visit_followup_1",
  healing:        "healing_summary_1",
  package_client: "package_client_1",
  need_more_time: "need_more_time_1",
  feedback:       "feedback_request_1",
};

export async function sendStagePair(
  stage: keyof typeof STAGE_TEMPLATE,
  opts: { clientId: string; phone: string; variables: string[] }
): Promise<void> {
  const templateName = STAGE_TEMPLATE[stage];
  if (!templateName) return;
  const wa = getWhatsAppProvider();
  await wa.sendTemplate({ clientId: opts.clientId, phone: opts.phone, templateName, variables: opts.variables });
}
