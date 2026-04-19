// Payment provider — abstract interface so we can swap implementations.
// In dev: stub. In production: Razorpay Payment Links.

import crypto from "node:crypto";
import { env } from "@/lib/env";

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
// Returns an internal URL the coordinator can click to mark the payment
// paid manually. Useful for local development without Razorpay creds.
class StubPaymentProvider implements PaymentProvider {
  async createPaymentLink(input: CreatePaymentLinkInput) {
    const id = `stub_plink_${input.reference}`;
    return { providerLinkId: id, url: `/dev/pay/${input.reference}` };
  }

  async verifyWebhook(): Promise<WebhookVerifyResult> {
    return { ok: false, reason: "Webhooks disabled in stub mode" };
  }
}

// ── Razorpay implementation (production) ─────────────────────────────
// Uses the Payment Links API. Docs: https://razorpay.com/docs/api/payments/payment-links/
class RazorpayProvider implements PaymentProvider {
  private auth(): string {
    const id = env.RAZORPAY_KEY_ID;
    const secret = env.RAZORPAY_KEY_SECRET;
    if (!id || !secret) throw new Error("Razorpay credentials missing");
    return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
  }

  async createPaymentLink(input: CreatePaymentLinkInput): Promise<CreatePaymentLinkResult> {
    const res = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: { Authorization: this.auth(), "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: input.amount * 100, // Razorpay uses paise
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
    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return { ok: false, reason: "Webhook secret missing" };
    if (!signature) return { ok: false, reason: "Signature missing" };
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      return { ok: false, reason: "Signature mismatch" };
    }
    const parsed = JSON.parse(rawBody) as {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string; description?: string } }; payment_link?: { entity?: { id?: string } } };
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

let _provider: PaymentProvider | null = null;
export function getPaymentProvider(): PaymentProvider {
  if (_provider) return _provider;
  _provider = env.RAZORPAY_PROVIDER === "razorpay"
    ? new RazorpayProvider()
    : new StubPaymentProvider();
  return _provider;
}
