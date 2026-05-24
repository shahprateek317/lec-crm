// WhatsApp provider — abstract interface so we can swap implementations.
// In dev: stub. In production: Meta WhatsApp Cloud API.
// Groups are NOT part of this interface — the Business API doesn't support
// programmatic group creation. Groups are created manually; we only track them.
//
// Config precedence: AppSetting (DB) > env var > "stub" default. This means
// the centre owner can wire the WhatsApp credentials from the admin UI at
// /settings/whatsapp without any engineer touching env vars.

import { prisma } from "@/lib/prisma";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import type {
  WhatsAppMessage,
  WhatsAppStatus,
  WhatsAppTemplate,
} from "@prisma/client";

export type SendTemplateInput = {
  clientId?: string;
  phone: string;
  templateName: string;
  variables?: string[];
};

export type SendTextInput = {
  clientId?: string;
  phone: string;
  body: string;
};

export type SendResult = {
  providerMessageId: string | null;
  status: WhatsAppStatus;
  body: string;
};

export interface WhatsAppProvider {
  sendTemplate(input: SendTemplateInput): Promise<SendResult>;
  /** Freeform text — only valid inside a 24-hour customer service window. */
  sendText(input: SendTextInput): Promise<SendResult>;
}

// ── Template rendering ────────────────────────────────────────────────
function renderTemplate(tpl: WhatsAppTemplate, variables: string[]): string {
  return tpl.bodyTemplate.replace(/\{\{(\d+)\}\}/g, (_, idx: string) => {
    const i = parseInt(idx, 10) - 1;
    return variables[i] ?? `{{${idx}}}`;
  });
}

async function loadTemplate(name: string): Promise<WhatsAppTemplate> {
  const tpl = await prisma.whatsAppTemplate.findUnique({ where: { name } });
  if (!tpl) throw new Error(`WhatsApp template not found: ${name}`);
  if (!tpl.active) throw new Error(`WhatsApp template is inactive: ${name}`);
  return tpl;
}

async function recordMessage(params: {
  clientId?: string;
  templateId?: string;
  phone: string;
  body: string;
  status: WhatsAppStatus;
  providerMessageId: string | null;
  errorMessage?: string;
}): Promise<WhatsAppMessage> {
  const created = await prisma.whatsAppMessage.create({
    data: {
      clientId: params.clientId,
      templateId: params.templateId,
      phone: params.phone,
      body: params.body,
      status: params.status,
      providerMessageId: params.providerMessageId,
      errorMessage: params.errorMessage,
      sentAt: params.status === "FAILED" ? null : new Date(),
    },
  });
  // Mirror the message into the coordinator inbox thread. Outbound
  // resets unreadCount (the centre has spoken — ball is in client's
  // court). Best-effort: a thread-upsert failure shouldn't block the
  // primary write. Only mirror for matched clients; unknown phones
  // remain as orphan WhatsAppMessage rows surfaced via /inbox's
  // "Unknown sender" view (Phase 1b).
  if (params.clientId && params.status !== "FAILED") {
    await touchThread({
      clientId: params.clientId,
      direction: "OUTBOUND",
      at: created.sentAt ?? new Date(),
    }).catch((err) => console.error("[whatsapp] outbound thread upsert failed", err));
  }
  return created;
}

/**
 * Upsert the per-client WhatsAppThread aggregate.
 *
 * Inbound:  bumps unreadCount + sets lastInboundAt + reopens RESOLVED/SNOOZED.
 * Outbound: zeroes unreadCount + sets lastOutboundAt (the centre replied).
 *
 * Race-safe via Prisma `upsert` on the `clientId` unique constraint —
 * two concurrent inbound messages for a brand-new client cannot both
 * win a create. Status transitions are computed once into a single
 * value (no spread-key fragility).
 *
 * Exported so the webhook (`/api/webhook/whatsapp`) can call it on inbound
 * messages with the same semantics.
 */
export async function touchThread(params: {
  clientId: string;
  direction: "INBOUND" | "OUTBOUND";
  at: Date;
}): Promise<void> {
  const isInbound = params.direction === "INBOUND";

  // Status transition is computed explicitly to avoid the
  // object-spread key-ordering fragility flagged in mid-phase review.
  // For inbound: if the existing thread is RESOLVED or SNOOZED, reopen.
  // For outbound: leave status alone (writing back the same value is fine).
  //
  // upsert.update accepts a function-less object — we need the existing
  // status to decide whether to reset SNOOZED. Two-step: fetch (best-effort
  // for status), then upsert with computed status. The upsert is atomic on
  // clientId — the worst case under contention is a stale status read
  // (still safe; we still reopen on any incoming inbound).
  let existingStatus: "OPEN" | "SNOOZED" | "RESOLVED" | undefined;
  if (isInbound) {
    const existing = await prisma.whatsAppThread.findUnique({
      where: { clientId: params.clientId },
      select: { status: true },
    });
    existingStatus = existing?.status;
  }
  const inboundShouldReopen = existingStatus === "RESOLVED" || existingStatus === "SNOOZED";

  await prisma.whatsAppThread.upsert({
    where: { clientId: params.clientId },
    create: {
      clientId: params.clientId,
      status: "OPEN",
      unreadCount: isInbound ? 1 : 0,
      lastInboundAt:  isInbound ? params.at : null,
      lastOutboundAt: isInbound ? null     : params.at,
    },
    update: isInbound
      ? {
          unreadCount: { increment: 1 },
          lastInboundAt: params.at,
          ...(inboundShouldReopen ? { status: "OPEN" as const, snoozeUntil: null } : {}),
        }
      : {
          unreadCount: 0,
          lastOutboundAt: params.at,
        },
  });
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("91") || digits.length >= 11 ? digits : `91${digits}`;
}

// ── Stub implementation (local dev / demo) ───────────────────────────
class StubWhatsAppProvider implements WhatsAppProvider {
  async sendTemplate(input: SendTemplateInput): Promise<SendResult> {
    const tpl = await loadTemplate(input.templateName);
    const body = renderTemplate(tpl, input.variables ?? []);
    const providerMessageId = `stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[WhatsApp STUB] → ${input.phone}\n${body}\n`);
    await recordMessage({
      clientId: input.clientId,
      templateId: tpl.id,
      phone: input.phone,
      body,
      status: "SENT",
      providerMessageId,
    });
    return { providerMessageId, status: "SENT", body };
  }

  async sendText(input: SendTextInput): Promise<SendResult> {
    const providerMessageId = `stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[WhatsApp STUB] → ${input.phone}\n${input.body}\n`);
    await recordMessage({
      clientId: input.clientId,
      phone: input.phone,
      body: input.body,
      status: "SENT",
      providerMessageId,
    });
    return { providerMessageId, status: "SENT", body: input.body };
  }
}

// ── Meta Cloud API implementation (production) ────────────────────────
class MetaWhatsAppProvider implements WhatsAppProvider {
  private async endpointAndToken(): Promise<{ endpoint: string; token: string }> {
    const [phoneId, token] = await Promise.all([
      getSetting(SETTING_KEYS.whatsappPhoneId),
      getSetting(SETTING_KEYS.whatsappToken),
    ]);
    if (!phoneId) throw new Error("whatsapp.phone_number_id is not configured");
    if (!token) throw new Error("whatsapp.access_token is not configured");
    return { endpoint: `https://graph.facebook.com/v21.0/${phoneId}/messages`, token };
  }

  private async post(payload: unknown): Promise<{ messageId: string | null; raw: unknown }> {
    const { endpoint, token } = await this.endpointAndToken();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`WhatsApp send failed (${res.status}): ${JSON.stringify(raw)}`);
    }
    const messageId =
      (raw as { messages?: Array<{ id?: string }> }).messages?.[0]?.id ?? null;
    return { messageId, raw };
  }

  async sendTemplate(input: SendTemplateInput): Promise<SendResult> {
    const tpl = await loadTemplate(input.templateName);
    const body = renderTemplate(tpl, input.variables ?? []);
    try {
      const { messageId } = await this.post({
        messaging_product: "whatsapp",
        to: normalizePhone(input.phone),
        type: "template",
        template: {
          name: tpl.name,
          language: { code: tpl.language },
          components: input.variables?.length
            ? [{ type: "body", parameters: input.variables.map((text) => ({ type: "text", text })) }]
            : undefined,
        },
      });
      await recordMessage({
        clientId: input.clientId,
        templateId: tpl.id,
        phone: input.phone,
        body,
        status: "SENT",
        providerMessageId: messageId,
      });
      return { providerMessageId: messageId, status: "SENT", body };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await recordMessage({
        clientId: input.clientId,
        templateId: tpl.id,
        phone: input.phone,
        body,
        status: "FAILED",
        providerMessageId: null,
        errorMessage,
      });
      throw err;
    }
  }

  async sendText(input: SendTextInput): Promise<SendResult> {
    try {
      const { messageId } = await this.post({
        messaging_product: "whatsapp",
        to: normalizePhone(input.phone),
        type: "text",
        text: { body: input.body, preview_url: false },
      });
      await recordMessage({
        clientId: input.clientId,
        phone: input.phone,
        body: input.body,
        status: "SENT",
        providerMessageId: messageId,
      });
      return { providerMessageId: messageId, status: "SENT", body: input.body };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await recordMessage({
        clientId: input.clientId,
        phone: input.phone,
        body: input.body,
        status: "FAILED",
        providerMessageId: null,
        errorMessage,
      });
      throw err;
    }
  }
}

async function resolveProvider(): Promise<WhatsAppProvider> {
  const provider = await getSetting(SETTING_KEYS.whatsappProvider);
  return provider === "meta" ? new MetaWhatsAppProvider() : new StubWhatsAppProvider();
}

/**
 * Returns a WhatsAppProvider facade. Methods resolve the underlying provider
 * (stub vs meta) from DB settings at call time, so admin can switch at
 * runtime without a redeploy. Signature stays synchronous so existing
 * callers don't need to change.
 */
export function getWhatsAppProvider(): WhatsAppProvider {
  return {
    sendTemplate: async (input) => (await resolveProvider()).sendTemplate(input),
    sendText:     async (input) => (await resolveProvider()).sendText(input),
  };
}

/** Directly test Meta credentials by pinging the phone-number endpoint. */
export async function testWhatsAppCredentials(): Promise<{ ok: boolean; detail: string }> {
  const [phoneId, token] = await Promise.all([
    getSetting(SETTING_KEYS.whatsappPhoneId),
    getSetting(SETTING_KEYS.whatsappToken),
  ]);
  if (!phoneId) return { ok: false, detail: "Phone Number ID is not set." };
  if (!token) return { ok: false, detail: "Access Token is not set." };
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, detail: (body as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}` };
    }
    const data = body as { display_phone_number?: string; verified_name?: string };
    return {
      ok: true,
      detail: `Connected as ${data.verified_name ?? "(no name)"} (${data.display_phone_number ?? phoneId})`,
    };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "Unknown error" };
  }
}
