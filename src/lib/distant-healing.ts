// Distant healing helpers. Per the spec, WhatsApp groups are created
// manually (the official Business API doesn't allow programmatic groups).
// We track: group link, client photo, problem areas, healer daily updates,
// and client feedback — then surface everything on the lead detail page.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Chakra } from "@prisma/client";

export const enableGroupSchema = z.object({
  clientId: z.string().min(1),
  whatsappGroupName: z.string().max(200).optional(),
  whatsappGroupLink: z.string().url("Must be a valid WhatsApp chat.whatsapp.com link").optional(),
  photoUrl: z.string().url().optional().or(z.literal("")),
  problemAreas: z.string().max(2000).optional(),
});

export async function enableDistantGroup(input: z.infer<typeof enableGroupSchema>) {
  const parsed = enableGroupSchema.parse(input);
  return prisma.distantHealingGroup.upsert({
    where: { clientId: parsed.clientId },
    create: {
      clientId: parsed.clientId,
      whatsappGroupName: parsed.whatsappGroupName,
      whatsappGroupLink: parsed.whatsappGroupLink,
      photoUrl: parsed.photoUrl || null,
      problemAreas: parsed.problemAreas,
      active: true,
    },
    update: {
      whatsappGroupName: parsed.whatsappGroupName,
      whatsappGroupLink: parsed.whatsappGroupLink,
      photoUrl: parsed.photoUrl || null,
      problemAreas: parsed.problemAreas,
      active: true,
    },
  });
}

export const healerUpdateSchema = z.object({
  distantGroupId: z.string().min(1),
  healerId: z.string().min(1),
  chakras: z.array(
    z.enum([
      "CROWN", "FOREHEAD", "AJNA", "THROAT", "HEART",
      "SOLAR_PLEXUS_FRONT", "SOLAR_PLEXUS_BACK", "NAVEL", "MENG_MEIN",
      "SPLEEN_FRONT", "SPLEEN_BACK", "SEX", "BASIC",
    ]),
  ).default([]),
  process: z.string().max(500).optional(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  remarks: z.string().max(2000).optional(),
  postedToWhatsApp: z.boolean().default(false),
});

export async function addHealerUpdate(input: z.infer<typeof healerUpdateSchema>) {
  const parsed = healerUpdateSchema.parse(input);
  return prisma.healerUpdate.create({
    data: {
      distantGroupId: parsed.distantGroupId,
      healerId: parsed.healerId,
      chakras: parsed.chakras as Chakra[],
      process: parsed.process,
      durationMinutes: parsed.durationMinutes,
      remarks: parsed.remarks,
      postedToWhatsAppAt: parsed.postedToWhatsApp ? new Date() : null,
    },
  });
}

export const feedbackSchema = z.object({
  clientId: z.string().min(1),
  content: z.string().min(2).max(2000),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  healingSessionId: z.string().optional(),
});

export async function addClientFeedback(input: z.infer<typeof feedbackSchema>) {
  const parsed = feedbackSchema.parse(input);
  return prisma.clientFeedback.create({
    data: {
      clientId: parsed.clientId,
      content: parsed.content,
      rating: parsed.rating,
      healingSessionId: parsed.healingSessionId,
    },
  });
}

/** Copy-paste templates for the coordinator to paste into the client's group. */
export function standardDataFormat(client: {
  name: string;
  age: number | null;
  area: string | null;
  issueRefined: string | null;
  issue: string | null;
  problemAreas?: string | null;
}): string {
  return [
    `*Client:* ${client.name}`,
    client.age ? `*Age:* ${client.age}` : null,
    client.area ? `*Area:* ${client.area}` : null,
    `*Concern:* ${client.issueRefined ?? client.issue ?? "—"}`,
    client.problemAreas ? `*Problem areas:* ${client.problemAreas}` : null,
    "",
    "Healers, please post daily updates using the format below 🙏",
  ]
    .filter(Boolean)
    .join("\n");
}

export function healerUpdateFormat(): string {
  return [
    "*Date:* ",
    "*Chakras worked:* ",
    "*Process used:* ",
    "*Duration (min):* ",
    "*Remarks:* ",
  ].join("\n");
}
