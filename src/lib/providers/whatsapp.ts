// WhatsApp provider — abstract interface so we can swap implementations.
// In dev: stub. In production: Meta WhatsApp Cloud API.
// Groups are NOT part of this interface — the Business API doesn't support
// programmatic group creation. Groups are created manually; we only track them.

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
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
  return prisma.whatsAppMessage.create({
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
}

// ── Stub implementation (local dev) ───────────────────────────────────
// Pretends to send, logs to console, records in DB, returns fake ID.
class StubWhatsAppProvider implements WhatsAppProvider {
  async sendTemplate(input: SendTemplateInput): Promise<SendResult> {
    const tpl = await loadTemplate(input.templateName);
    const body = renderTemplate(tpl, input.variables ?? []);
    const providerMessageId = `stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // eslint-disable-next-line no-console
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
    // eslint-disable-next-line no-console
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
// Uses POST https://graph.facebook.com/v21.0/{phoneNumberId}/messages
class MetaWhatsAppProvider implements WhatsAppProvider {
  private endpoint(): string {
    const id = env.WHATSAPP_PHONE_NUMBER_ID;
    if (!id) throw new Error("WHATSAPP_PHONE_NUMBER_ID missing");
    return `https://graph.facebook.com/v21.0/${id}/messages`;
  }

  private normalize(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    return digits.startsWith("91") || digits.length >= 11 ? digits : `91${digits}`;
  }

  private async post(payload: unknown): Promise<{ messageId: string | null; raw: unknown }> {
    const token = env.WHATSAPP_ACCESS_TOKEN;
    if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN missing");
    const res = await fetch(this.endpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        `WhatsApp send failed (${res.status}): ${JSON.stringify(raw)}`,
      );
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
        to: this.normalize(input.phone),
        type: "template",
        template: {
          name: tpl.name,
          language: { code: tpl.language },
          components: input.variables?.length
            ? [{
                type: "body",
                parameters: input.variables.map((text) => ({ type: "text", text })),
              }]
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
        to: this.normalize(input.phone),
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

let _provider: WhatsAppProvider | null = null;
export function getWhatsAppProvider(): WhatsAppProvider {
  if (_provider) return _provider;
  _provider = env.WHATSAPP_PROVIDER === "meta"
    ? new MetaWhatsAppProvider()
    : new StubWhatsAppProvider();
  return _provider;
}
