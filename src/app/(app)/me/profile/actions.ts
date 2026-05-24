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
      // File attachment is wired separately via Phase 1a #5 — the healer
      // uploads to S3 and the resulting Document is linked here via the
      // attachCertificationFileAction below. Metadata-only rows are valid
      // (documentId stays null) until the file lands.
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
    select: { userId: true, documentId: true },
  });
  if (!cert || cert.userId !== session.user.id) {
    redirect("/me/profile?error=forbidden");
  }
  await prisma.healerCertificate.delete({ where: { id: certId } });
  // Cascade the attached Document if any — hard-deletes the row + S3
  // object (versioning preserves a 365d recovery copy via the AWS
  // console). Audit log captures the destructive action.
  if (cert.documentId) {
    const { deleteDocument } = await import("@/lib/uploads");
    await deleteDocument(cert.documentId, {
      actorId: session.user.id,
      reason: "Cascaded from HealerCertificate.delete",
    }).catch((err) => console.error("[me/profile] doc delete failed", err));
  }
  revalidatePath("/me/profile");
  redirect("/me/profile?ok=cert_deleted");
}

// ── File upload flow for a certification ─────────────────────────────
// Three-step browser dance:
//   1. requestCertUploadAction(certId, filename, contentType, sizeBytes)
//        → server validates ownership + per-kind limits, creates a PENDING
//          Document row, returns { uploadUrl, documentId }
//   2. Browser PUT directly to S3 using `uploadUrl`
//   3. completeCertUploadAction(certId, documentId)
//        → server HEAD's the object, marks Document UPLOADED, attaches it
//          to the certificate (HealerCertificate.documentId = documentId)
//
// The middle step bypasses the app server entirely — the browser uploads
// directly to S3, keeping the EC2 instance's 2 GB RAM safe.

const requestSchema = z.object({
  certId:      z.string().min(1),
  filename:    z.string().min(1).max(200),
  contentType: z.string().min(1).max(120),
  sizeBytes:   z.number().int().positive().max(50 * 1024 * 1024),
});

export async function requestCertUploadAction(input: {
  certId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<{ ok: true; uploadUrl: string; documentId: string } | { ok: false; error: string }> {
  const session = await requireSession();
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const cert = await prisma.healerCertificate.findUnique({
    where: { id: parsed.data.certId },
    select: { id: true, userId: true, documentId: true },
  });
  if (!cert || cert.userId !== session.user.id) {
    return { ok: false, error: "Certificate not found" };
  }
  if (cert.documentId) {
    return { ok: false, error: "A file is already attached. Remove the certificate and re-add it to replace." };
  }

  const { issueUploadIntent } = await import("@/lib/uploads");
  const res = await issueUploadIntent({
    kind: "HEALER_CERT",
    ownerType: "USER",
    ownerId: session.user.id,
    filename: parsed.data.filename,
    contentType: parsed.data.contentType,
    sizeBytes: parsed.data.sizeBytes,
    uploadedById: session.user.id,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, uploadUrl: res.uploadUrl, documentId: res.documentId };
}

export async function completeCertUploadAction(input: {
  certId: string;
  documentId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const [cert, doc] = await Promise.all([
    prisma.healerCertificate.findUnique({
      where: { id: input.certId },
      select: { id: true, userId: true, documentId: true },
    }),
    prisma.document.findUnique({
      where: { id: input.documentId },
      select: { id: true, ownerUserId: true, kind: true, status: true },
    }),
  ]);
  if (!cert || cert.userId !== session.user.id) return { ok: false, error: "Certificate not found" };
  if (!doc || doc.ownerUserId !== session.user.id || doc.kind !== "HEALER_CERT") {
    return { ok: false, error: "Document not found" };
  }
  if (cert.documentId) return { ok: false, error: "Already attached" };

  const { markUploadComplete } = await import("@/lib/uploads");
  const result = await markUploadComplete(input.documentId);
  if (!result.ok) return { ok: false, error: result.error ?? "S3 verification failed" };

  await prisma.healerCertificate.update({
    where: { id: input.certId },
    data: { documentId: input.documentId },
  });
  revalidatePath("/me/profile");
  return { ok: true };
}
