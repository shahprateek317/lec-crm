// Sends two WhatsApp template messages in sequence (2s apart) for each stage completion.
// Each pair = message1 (3 buttons) + message2 (2-3 more buttons).

import { getWhatsAppProvider } from "@/lib/providers/whatsapp";

type Pair = { t1: string; t2: string };

const PAIRS: Record<string, Pair> = {
  counselling:    { t1: "counselling_followup_1",  t2: "counselling_followup_2" },
  pranic_group:   { t1: "pranic_group_followup_1", t2: "pranic_group_followup_2" },
  meditation:     { t1: "meditation_followup_1",   t2: "meditation_followup_2" },
  visit:          { t1: "visit_followup_1",         t2: "visit_followup_2" },
  healing:        { t1: "healing_summary_1",        t2: "healing_summary_2" },
  package_client: { t1: "package_client_1",         t2: "package_client_2" },
};

export async function sendStagePair(
  stage: keyof typeof PAIRS,
  opts: { clientId: string; phone: string; variables: string[] }
): Promise<void> {
  const pair = PAIRS[stage];
  const wa = getWhatsAppProvider();
  await wa.sendTemplate({ clientId: opts.clientId, phone: opts.phone, templateName: pair.t1, variables: opts.variables });
  await new Promise<void>(r => setTimeout(r, 2000));
  await wa.sendTemplate({ clientId: opts.clientId, phone: opts.phone, templateName: pair.t2, variables: [opts.variables[0]] });
}
