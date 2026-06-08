// Admin-editable configuration persisted to DB. Used for integration
// credentials (WhatsApp, Razorpay) so the centre owner can manage secrets
// without an engineer.
//
// Precedence when reading: DB setting > env var > default.
// Sensitive values are encrypted with AES-256-GCM using a key derived from
// AUTH_SECRET. If AUTH_SECRET rotates, encrypted values become unrecoverable
// and admin will need to re-paste them.

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { encryptForStorage, decryptFromStorage } from "@/lib/crypto";

// Local aliases keep the original call sites readable. The
// at-rest crypto lives in `@/lib/crypto` now — reused by TOTP secrets.
const encrypt = encryptForStorage;
const decrypt = decryptFromStorage;

// ── Setting keys ──────────────────────────────────────────────────────
export const SETTING_KEYS = {
  whatsappProvider:    "whatsapp.provider",
  whatsappPhoneId:     "whatsapp.phone_number_id",
  whatsappToken:       "whatsapp.access_token",
  whatsappVerifyToken: "whatsapp.verify_token",
  whatsappAppSecret:   "whatsapp.app_secret",

  razorpayProvider:     "razorpay.provider",
  razorpayKeyId:        "razorpay.key_id",
  razorpayKeySecret:    "razorpay.key_secret",
  razorpayWebhookSecret: "razorpay.webhook_secret",

  emailProvider:   "email.provider",    // "stub" | "resend"
  emailApiKey:     "email.api_key",     // Resend API key (sensitive)
  emailFromAddress: "email.from_address", // e.g. "Life Energy Centre <hello@lifeenergycentre.in>"
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export const SENSITIVE_KEYS: ReadonlySet<SettingKey> = new Set([
  SETTING_KEYS.whatsappToken,
  SETTING_KEYS.whatsappVerifyToken,
  SETTING_KEYS.whatsappAppSecret,
  SETTING_KEYS.razorpayKeySecret,
  SETTING_KEYS.razorpayWebhookSecret,
  SETTING_KEYS.emailApiKey,
]);

// ── Env fallbacks ─────────────────────────────────────────────────────
const ENV_FALLBACK: Partial<Record<SettingKey, string | undefined>> = {
  [SETTING_KEYS.whatsappProvider]:    env.WHATSAPP_PROVIDER,
  [SETTING_KEYS.whatsappPhoneId]:     env.WHATSAPP_PHONE_NUMBER_ID,
  [SETTING_KEYS.whatsappToken]:       env.WHATSAPP_ACCESS_TOKEN,
  [SETTING_KEYS.whatsappVerifyToken]: env.WHATSAPP_VERIFY_TOKEN,
  [SETTING_KEYS.whatsappAppSecret]:   env.WHATSAPP_APP_SECRET,
  [SETTING_KEYS.razorpayProvider]:     env.RAZORPAY_PROVIDER,
  [SETTING_KEYS.razorpayKeyId]:        env.RAZORPAY_KEY_ID,
  [SETTING_KEYS.razorpayKeySecret]:    env.RAZORPAY_KEY_SECRET,
  [SETTING_KEYS.razorpayWebhookSecret]: env.RAZORPAY_WEBHOOK_SECRET,
  [SETTING_KEYS.emailProvider]:    env.EMAIL_PROVIDER,
  [SETTING_KEYS.emailApiKey]:      env.EMAIL_API_KEY,
  [SETTING_KEYS.emailFromAddress]: env.EMAIL_FROM_ADDRESS,
};

// ── Read / write ──────────────────────────────────────────────────────
/** Returns the effective value: DB setting (decrypted) > env > undefined. */
export async function getSetting(key: SettingKey): Promise<string | undefined> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row) {
    try {
      return row.encrypted ? decrypt(row.value) : row.value;
    } catch (err) {
      console.error(`[settings] failed to decrypt ${key}`, err);
      // Fall through to env as a last resort.
    }
  }
  return ENV_FALLBACK[key] || undefined;
}

export async function getSettings(keys: SettingKey[]): Promise<Partial<Record<SettingKey, string>>> {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: keys } } });
  const out: Partial<Record<SettingKey, string>> = {};
  for (const k of keys) {
    const row = rows.find((r) => r.key === k);
    let v: string | undefined;
    if (row) {
      try { v = row.encrypted ? decrypt(row.value) : row.value; } catch {}
    }
    out[k] = v ?? ENV_FALLBACK[k];
  }
  return out;
}

/** Returns metadata + masked preview for admin UI (never returns secret plaintext). */
export async function getSettingPreview(key: SettingKey): Promise<{
  isSet: boolean;
  source: "db" | "env" | "none";
  preview: string;
}> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  const envVal = ENV_FALLBACK[key] || undefined;
  let value: string | undefined;
  let source: "db" | "env" | "none" = "none";
  if (row) {
    try {
      value = row.encrypted ? decrypt(row.value) : row.value;
      source = "db";
    } catch { /* falls through */ }
  }
  if (!value && envVal) {
    value = envVal;
    source = "env";
  }
  if (!value) return { isSet: false, source, preview: "" };
  if (SENSITIVE_KEYS.has(key)) {
    return { isSet: true, source, preview: "••••••" + value.slice(-4) };
  }
  return { isSet: true, source, preview: value };
}

export async function setSetting(
  key: SettingKey,
  value: string,
  updatedById?: string,
): Promise<void> {
  const isSensitive = SENSITIVE_KEYS.has(key);
  const stored = isSensitive ? encrypt(value) : value;
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: stored, encrypted: isSensitive, updatedById },
    update: { value: stored, encrypted: isSensitive, updatedById },
  });
}

export async function clearSetting(key: SettingKey): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key } });
}
