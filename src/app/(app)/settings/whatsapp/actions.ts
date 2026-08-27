"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { requireRole } from "@/lib/rbac";
import { setSetting, SETTING_KEYS } from "@/lib/settings";
import { testWhatsAppCredentials } from "@/lib/providers/whatsapp";

export async function saveWhatsAppAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const provider = String(formData.get("provider") ?? "stub");
  const phoneNumberId = String(formData.get("phoneNumberId") ?? "").trim();
  const accessToken = String(formData.get("accessToken") ?? "").trim();
  const appSecret = String(formData.get("appSecret") ?? "").trim();

  try {
    await setSetting(SETTING_KEYS.whatsappProvider, provider === "meta" ? "meta" : "stub", session.user.id);
    if (phoneNumberId) await setSetting(SETTING_KEYS.whatsappPhoneId, phoneNumberId, session.user.id);
    if (accessToken) await setSetting(SETTING_KEYS.whatsappToken, accessToken, session.user.id);
    if (appSecret) await setSetting(SETTING_KEYS.whatsappAppSecret, appSecret, session.user.id);
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "Save failed");
    redirect(`/settings/whatsapp?error=${msg}`);
  }
  revalidatePath("/settings/whatsapp");
  redirect("/settings/whatsapp?ok=1");
}

export async function generateVerifyTokenAction() {
  const session = await requireRole("ADMIN");
  const token = "lec_" + crypto.randomBytes(18).toString("base64url");
  await setSetting(SETTING_KEYS.whatsappVerifyToken, token, session.user.id);
  revalidatePath("/settings/whatsapp");
  redirect("/settings/whatsapp?ok=1");
}

export async function testWhatsAppAction() {
  await requireRole("ADMIN");
  const result = await testWhatsAppCredentials();
  const flag = result.ok ? "ok" : "err";
  redirect(`/settings/whatsapp?test=${flag}:${encodeURIComponent(result.detail)}`);
}

export async function saveZoomLinkAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const link = String(formData.get("zoomIntroLink") ?? "").trim();
  await setSetting(SETTING_KEYS.zoomIntroLink, link, session.user.id);
  revalidatePath("/settings/whatsapp");
  redirect("/settings/whatsapp?ok=1");
}
