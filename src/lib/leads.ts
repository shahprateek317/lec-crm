// Lead capture & pipeline helpers — shared by the public enquiry action
// and the internal manual-entry form. Any other lead source (webhook from
// FB/Insta ads, WhatsApp API inbox) should funnel through createLead().

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getWhatsAppProvider } from "@/lib/providers/whatsapp";
import type { LeadSource, PipelineStage } from "@prisma/client";

export const leadInputSchema = z.object({
  name: z.string().trim().min(2, "Name is too short"),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s\-]{7,}$/, "Enter a valid phone number"),
  email: z.string().email().optional().or(z.literal("")),
  age: z.coerce.number().int().positive().max(120).optional(),
  area: z.string().trim().max(120).optional(),
  issue: z.string().trim().max(2000).optional(),
  issueDuration: z.string().trim().max(120).optional(),
  source: z
    .enum(["FACEBOOK", "INSTAGRAM", "WHATSAPP", "WALK_IN", "REFERRAL", "MANUAL", "OTHER"])
    .default("MANUAL"),
  notes: z.string().trim().max(2000).optional(),
  assignedToId: z.string().optional(),
});

export type LeadInput = z.infer<typeof leadInputSchema>;

/** Normalize an Indian phone number to +91XXXXXXXXXX wherever sensible. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return raw.startsWith("+") ? raw : `+${digits}`;
}

export async function createLead(input: LeadInput, opts: { silent?: boolean } = {}) {
  const parsed = leadInputSchema.parse(input);
  const phone = normalizePhone(parsed.phone);

  const existing = await prisma.client.findUnique({ where: { phone } });
  if (existing) {
    // Don't create duplicates — instead, append a note and return existing.
    await prisma.client.update({
      where: { id: existing.id },
      data: {
        notes: [existing.notes, `Re-enquiry on ${new Date().toISOString()}: ${parsed.issue ?? ""}`]
          .filter(Boolean)
          .join("\n\n"),
      },
    });
    return { client: existing, created: false };
  }

  const client = await prisma.client.create({
    data: {
      name: parsed.name,
      phone,
      email: parsed.email || null,
      age: parsed.age,
      area: parsed.area,
      issue: parsed.issue,
      issueDuration: parsed.issueDuration,
      source: parsed.source as LeadSource,
      stage: "NEW" as PipelineStage,
      assignedToId: parsed.assignedToId,
      notes: parsed.notes,
      stageTransitions: {
        create: { toStage: "NEW", note: "Lead captured" },
      },
    },
  });

  // Fire-and-forget welcome message. Failure here must not block lead creation.
  if (!opts.silent) {
    getWhatsAppProvider()
      .sendTemplate({
        clientId: client.id,
        phone,
        templateName: "lead_welcome",
        variables: [client.name.split(" ")[0]],
      })
      .catch((err) => {
        console.error("[leads] welcome WhatsApp failed", err);
      });
  }

  return { client, created: true };
}
