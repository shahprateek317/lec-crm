// Payment provider — abstract interface so we can swap implementations.
// In dev: stub. In production: Razorpay Payment Links.
// Config precedence: AppSetting (DB) > env > "stub". Admin edits via
// /settings/razorpay.

import crypto from "node:crypto";
import { getSetting, SETTING_KEYS } from "@/lib/settings";

export type CreatePaymentLinkInput = {
  amount: number; // INR (no paise)
  description: string;
  client: { id: string; name: string; phone: string; email?: string | null };
  reference: string; // internal payment id
  callbackUrl?: string;
};

export type CreatePaymentLinkResult = {
  providerLinkId: string;
  url: string;
};

export type WebhookVerifyResult =
  | { ok: true; event: "payment.captured" | "payment.failed" | "payment.refunded" | "other"; paymentLinkId: string | null; paymentId: string | null }
  | { ok: false; reason: string };

export interface PaymentProvider {
  createPaymentLink(input: CreatePaymentLinkInput): Promise<CreatePaymentLinkResult>;
  verifyWebhook(rawBody: string, signature: string | null): Promise<WebhookVerifyResult>;
}

// ── Stub implementation ──────────────────────────────────────────────
class StubPaymentProvider implements PaymentProvider {
  async createPaymentLink(input: CreatePaymentLinkInput) {
    const id = `stub_plink_${input.reference}`;
    return { providerLinkId: id, url: `/dev/pay/${input.reference}` };
  }

  async verifyWebhook(): Promise<WebhookVerifyResult> {
    return { ok: false, reason: "Webhooks disabled in stub mode" };
  }
}

// ── Razorpay implementation ──────────────────────────────────────────
class RazorpayProvider implements PaymentProvider {
  private async basicAuth(): Promise<string> {
    const [id, secret] = await Promise.all([
      getSetting(SETTING_KEYS.razorpayKeyId),
      getSetting(SETTING_KEYS.razorpayKeySecret),
    ]);
    if (!id || !secret) throw new Error("Razorpay credentials are not configured");
    return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
  }

  async createPaymentLink(input: CreatePaymentLinkInput): Promise<CreatePaymentLinkResult> {
    const auth = await this.basicAuth();
    const res = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: input.amount * 100, // paise
        currency: "INR",
        accept_partial: false,
        description: input.description,
        reference_id: input.reference,
        customer: {
          name: input.client.name,
          contact: input.client.phone,
          email: input.client.email ?? undefined,
        },
        notify: { sms: true, email: !!input.client.email },
        callback_url: input.callbackUrl,
        callback_method: input.callbackUrl ? "get" : undefined,
      }),
    });
    const raw = await res.json();
    if (!res.ok) {
      throw new Error(`Razorpay createPaymentLink failed: ${JSON.stringify(raw)}`);
    }
    return { providerLinkId: raw.id as string, url: raw.short_url as string };
  }

  async verifyWebhook(rawBody: string, signature: string | null): Promise<WebhookVerifyResult> {
    const secret = await getSetting(SETTING_KEYS.razorpayWebhookSecret);
    if (!secret) return { ok: false, reason: "Webhook secret not configured" };
    if (!signature) return { ok: false, reason: "Signature missing" };
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      return { ok: false, reason: "Signature mismatch" };
    }
    const parsed = JSON.parse(rawBody) as {
      event?: string;
      payload?: { payment?: { entity?: { id?: string } }; payment_link?: { entity?: { id?: string } } };
    };
    const evt = parsed.event ?? "other";
    type EventTag = "payment.captured" | "payment.failed" | "payment.refunded" | "other";
    const event: EventTag =
      evt === "payment_link.paid" || evt === "payment.captured"
        ? "payment.captured"
        : evt === "payment.failed"
          ? "payment.failed"
          : evt === "refund.created" || evt === "payment.refunded"
            ? "payment.refunded"
            : "other";
    return {
      ok: true,
      event,
      paymentLinkId: parsed.payload?.payment_link?.entity?.id ?? null,
      paymentId: parsed.payload?.payment?.entity?.id ?? null,
    };
  }
}

async function resolveProvider(): Promise<PaymentProvider> {
  const provider = await getSetting(SETTING_KEYS.razorpayProvider);
  return provider === "razorpay" ? new RazorpayProvider() : new StubPaymentProvider();
}

/** Synchronous facade over the async resolver so existing callers keep working. */
export function getPaymentProvider(): PaymentProvider {
  return {
    createPaymentLink: async (input) => (await resolveProvider()).createPaymentLink(input),
    verifyWebhook:     async (rawBody, sig) => (await resolveProvider()).verifyWebhook(rawBody, sig),
  };
}

/**
 * Quick auth check — lists a page of payment links (limit=1). Any non-auth
 * error still means "yes, Razorpay sees your key"; auth errors surface clearly.
 */
export async function testRazorpayCredentials(): Promise<{ ok: boolean; detail: string }> {
  const [id, secret] = await Promise.all([
    getSetting(SETTING_KEYS.razorpayKeyId),
    getSetting(SETTING_KEYS.razorpayKeySecret),
  ]);
  if (!id) return { ok: false, detail: "Key ID is not set." };
  if (!secret) return { ok: false, detail: "Key Secret is not set." };
  try {
    const auth = "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/payment_links?count=1", {
      headers: { Authorization: auth },
    });
    const body = (await res.json().catch(() => ({}))) as { error?: { description?: string } };
    if (res.ok) {
      const mode = id.startsWith("rzp_test_") ? "TEST" : "LIVE";
      return { ok: true, detail: `Razorpay connected in ${mode} mode.` };
    }
    return { ok: false, detail: body.error?.description ?? `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "Unknown error" };
  }
}
