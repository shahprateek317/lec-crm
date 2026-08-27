// Email provider abstraction — mirrors the WhatsApp provider pattern.
//
// provider = "stub"   → logs to console (dev/demo)
// provider = "resend" → sends via the Resend API (no SDK needed; simple REST)
//
// Config is read from AppSetting at call time so the admin can switch
// provider without restarting the server.

import { getSetting, SETTING_KEYS } from "@/lib/settings";

export type EmailPayload = {
  to:      string;   // recipient email address
  subject: string;
  html:    string;
  text:    string;
};

export type EmailResult =
  | { ok: true;  messageId: string }
  | { ok: false; error: string };

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const provider = (await getSetting(SETTING_KEYS.emailProvider)) ?? "stub";

  if (provider === "resend") {
    return sendViaResend(payload);
  }

  // Stub — log and return success so the cron doesn't fail in demo mode.
  console.log("[email/stub] would send", {
    to:      payload.to,
    subject: payload.subject,
    textLen: payload.text.length,
  });
  return { ok: true, messageId: `stub-${Date.now()}` };
}

async function sendViaResend(payload: EmailPayload): Promise<EmailResult> {
  const [apiKey, from] = await Promise.all([
    getSetting(SETTING_KEYS.emailApiKey),
    getSetting(SETTING_KEYS.emailFromAddress),
  ]);

  if (!apiKey) return { ok: false, error: "email.api_key not configured" };
  if (!from)   return { ok: false, error: "email.from_address not configured" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to:      payload.to,
        subject: payload.subject,
        html:    payload.html,
        text:    payload.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable)");
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }

    const data = (await res.json()) as { id?: string };
    return { ok: true, messageId: data.id ?? "unknown" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
