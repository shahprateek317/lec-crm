"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import type { TimeBand, DayOfWeek } from "@prisma/client";

// Re-use the time-band parsing helper pattern from settings/users/actions.ts
function parseAvailability(formData: FormData): { availabilitySlots: string[]; preferredTimeBands: TimeBand[]; availableDays: DayOfWeek[] } {
  const slots = formData.getAll("availabilitySlots").map((v) => String(v)).filter(Boolean);
  const bandSet = new Set<TimeBand>();
  const daySet = new Set<DayOfWeek>();
  for (const s of slots) {
    const [d, b] = s.split(":");
    if (d) daySet.add(d as DayOfWeek);
    if (b) bandSet.add(b as TimeBand);
  }
  return {
    availabilitySlots: slots,
    preferredTimeBands: [...bandSet],
    availableDays: [...daySet],
  };
}

function csv(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function saveMyProfileAction(formData: FormData) {
  const session = await requireSession();
  // Self-service only — userId must match the logged-in user.
  const formUserId = String(formData.get("userId") ?? "");
  if (formUserId && formUserId !== session.user.id) {
    redirect("/me/profile?error=forbidden");
  }
  const userId = session.user.id;

  const role = session.user.role;
  if (role !== "HEALER" && role !== "SENIOR_HEALER") {
    redirect("/me/profile?error=role_not_supported");
  }

  const avail = parseAvailability(formData);
  await prisma.healerProfile.update({
    where: { userId },
    data: {
      experienceYears:    Number(formData.get("experienceYears")) || null,
      maxHealingsPerDay:  Number(formData.get("maxHealingsPerDay")) || null,
      focusAreas:         csv(formData.get("focusAreas")),
      languages:          csv(formData.get("languages")),
      availabilitySlots:  avail.availabilitySlots,
      preferredTimeBands: avail.preferredTimeBands,
      availableDays:      avail.availableDays,
    },
  });
  revalidatePath("/me/profile");
  redirect("/me/profile?ok=1");
}

const addCertSchema = z.object({
  title:       z.string().min(2).max(120),
  issuingBody: z.string().max(120).optional(),
  issuedAt:    z.string().optional(),  // "YYYY-MM" from <input type=month>
  expiresAt:   z.string().optional(),
});

function parseMonth(s?: string): Date | null {
  if (!s || !/^\d{4}-\d{2}$/.test(s)) return null;
  return new Date(`${s}-01T00:00:00Z`);
}

export async function addCertificationAction(formData: FormData) {
  const session = await requireSession();
  const userId = session.user.id;

  const parsed = addCertSchema.safeParse({
    title:       formData.get("title"),
    issuingBody: formData.get("issuingBody") || undefined,
    issuedAt:    formData.get("issuedAt") || undefined,
    expiresAt:   formData.get("expiresAt") || undefined,
  });
  if (!parsed.success) redirect("/me/profile?error=invalid");

  await prisma.healerCertificate.create({
    data: {
      userId,
      title:       parsed.data.title,
      // Placeholder — actual file upload to S3 ships next iteration.
      // Admins can attach the real file later by patching this row.
      storageKey:  "pending-upload",
      contentType: "application/pdf",
      fileSize:    0,
      issuingBody: parsed.data.issuingBody ?? null,
      issuedAt:    parseMonth(parsed.data.issuedAt),
      expiresAt:   parseMonth(parsed.data.expiresAt),
    },
  });
  revalidatePath("/me/profile");
  redirect("/me/profile?ok=cert_added");
}

export async function deleteCertificationAction(formData: FormData) {
  const session = await requireSession();
  const certId = String(formData.get("certId") ?? "");
  if (!certId) redirect("/me/profile?error=missing_cert");

  const cert = await prisma.healerCertificate.findUnique({
    where: { id: certId },
    select: { userId: true },
  });
  if (!cert || cert.userId !== session.user.id) {
    redirect("/me/profile?error=forbidden");
  }
  await prisma.healerCertificate.delete({ where: { id: certId } });
  revalidatePath("/me/profile");
  redirect("/me/profile?ok=cert_deleted");
}
