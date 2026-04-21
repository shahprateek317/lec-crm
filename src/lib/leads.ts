// Lead capture & pipeline helpers — shared by the public enquiry action
// and the internal manual-entry form. Any other lead source (webhook from
// FB/Insta ads, WhatsApp API inbox) should funnel through createLead().

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getWhatsAppProvider } from "@/lib/providers/whatsapp";
import type { LeadSource, PipelineStage } from "@prisma/client";

export const leadInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name is too short")
    .max(50, "Name is too long")
    .regex(/^[A-Za-z\s.'-]+$/, "Alphabets only"),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s\-]{7,}$/, "Enter a valid phone number"),
  email: z.string().email().optional().or(z.literal("")),
  age: z.coerce.number().int().positive().max(120).optional(),
  ageBucket: z
    .enum(["UNDER_18", "AGE_18_25", "AGE_26_40", "AGE_41_60", "AGE_60_PLUS"])
    .optional(),
  area: z.string().trim().max(120).optional(),
  areaCategory: z
    .enum(["NEW_TOWN", "SALT_LAKE", "RAJARHAT", "DUMDUM", "BARASAT", "OTHER_KOLKATA", "OUTSIDE_KOLKATA"])
    .optional(),
  issue: z.string().trim().max(2000).optional(),
  issueCategory: z
    .enum(["STRESS_ANXIETY", "PHYSICAL_HEALTH", "EMOTIONAL", "RELATIONSHIP", "FINANCIAL", "WELLBEING", "OTHER"])
    .optional(),
  issueDuration: z.string().trim().max(120).optional(),
  durationBucket: z.enum(["DAYS", "WEEKS", "MONTHS", "OVER_YEAR"]).optional(),
  preferredTimeSlot: z.enum(["MORNING", "AFTERNOON", "EVENING", "WEEKEND"]).optional(),
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
      ageBucket: parsed.ageBucket,
      area: parsed.area,
      areaCategory: parsed.areaCategory,
      issue: parsed.issue,
      issueCategory: parsed.issueCategory,
      issueDuration: parsed.issueDuration,
      durationBucket: parsed.durationBucket,
      preferredTimeSlot: parsed.preferredTimeSlot,
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
