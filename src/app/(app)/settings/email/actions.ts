"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { setSetting, clearSetting, SETTING_KEYS } from "@/lib/settings";
import { sendEmail } from "@/lib/providers/email";

const schema = z.object({
  provider:    z.enum(["stub", "resend"]),
  apiKey:      z.string().max(200).optional(),
  fromAddress: z.string().email().max(200).optional(),
});

export async function saveEmailSettingsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) redirect("/dashboard");

  const parsed = schema.safeParse({
    provider:    formData.get("provider"),
    apiKey:      formData.get("apiKey")      || undefined,
    fromAddress: formData.get("fromAddress") || undefined,
  });
  if (!parsed.success) {
    redirect("/settings/email?error=Invalid+form+data");
  }

  const { provider, apiKey, fromAddress } = parsed.data;

  await setSetting(SETTING_KEYS.emailProvider, provider, session.user.id);
  if (apiKey)      await setSetting(SETTING_KEYS.emailApiKey,      apiKey,      session.user.id);
  if (fromAddress) await setSetting(SETTING_KEYS.emailFromAddress, fromAddress, session.user.id);

  redirect("/settings/email?ok=Email+settings+saved");
}

export async function testEmailAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) redirect("/dashboard");

  const to = session.user.email ?? "";
  if (!to) redirect("/settings/email?error=Your+account+has+no+email+address");

  const result = await sendEmail({
    to,
    subject: "Test email from Life Energy Centre CRM",
    html:    `<p>If you're reading this, email is configured correctly. Sent to <strong>${to}</strong>.</p>`,
    text:    `If you're reading this, email is configured correctly. Sent to ${to}.`,
  });

  if (!result.ok) {
    redirect(`/settings/email?error=${encodeURIComponent("Send failed: " + result.error.slice(0, 120))}`);
  }
  redirect(`/settings/email?ok=${encodeURIComponent("Test email sent to " + to)}`);
}

export async function clearEmailSettingsAction() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) redirect("/dashboard");

  await Promise.all([
    clearSetting(SETTING_KEYS.emailApiKey),
    clearSetting(SETTING_KEYS.emailFromAddress),
  ]);
  redirect("/settings/email?ok=Email+credentials+cleared");
}
