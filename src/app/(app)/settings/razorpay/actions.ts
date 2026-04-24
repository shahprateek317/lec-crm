"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { requireRole } from "@/lib/rbac";
import { setSetting, SETTING_KEYS } from "@/lib/settings";
import { testRazorpayCredentials } from "@/lib/providers/payment";

export async function saveRazorpayAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const provider = String(formData.get("provider") ?? "stub");
  const keyId = String(formData.get("keyId") ?? "").trim();
  const keySecret = String(formData.get("keySecret") ?? "").trim();

  try {
    await setSetting(SETTING_KEYS.razorpayProvider, provider === "razorpay" ? "razorpay" : "stub", session.user.id);
    if (keyId) await setSetting(SETTING_KEYS.razorpayKeyId, keyId, session.user.id);
    if (keySecret) await setSetting(SETTING_KEYS.razorpayKeySecret, keySecret, session.user.id);
  } catch (err) {
    redirect(`/settings/razorpay?error=${encodeURIComponent(err instanceof Error ? err.message : "Save failed")}`);
  }
  revalidatePath("/settings/razorpay");
  redirect("/settings/razorpay?ok=1");
}

export async function regenerateWebhookSecretAction() {
  const session = await requireRole("ADMIN");
  const secret = "whsec_" + crypto.randomBytes(24).toString("base64url");
  await setSetting(SETTING_KEYS.razorpayWebhookSecret, secret, session.user.id);
  revalidatePath("/settings/razorpay");
  redirect("/settings/razorpay?ok=1");
}

export async function testRazorpayAction() {
  await requireRole("ADMIN");
  const result = await testRazorpayCredentials();
  const flag = result.ok ? "ok" : "err";
  redirect(`/settings/razorpay?test=${flag}:${encodeURIComponent(result.detail)}`);
}
