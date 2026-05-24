"use server";

// /me/documents — server actions for the client-portal medical-report
// upload flow. Mirrors the healer cert pattern (3-step browser dance:
// request presigned URL → PUT to S3 → confirm), but the owner is a
// Client, not a User, so we use requireClient() and the polymorphic
// Document.ownerClientId column.
//
// Auth model: every action requires a valid ClientSession cookie (set
// by the passwordless OTP/magic-link sign-in). The actions enforce
// owner === session.client.id on every read/write — a client can
// never see or mutate another client's documents.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireClient } from "@/lib/me-session";
import { prisma } from "@/lib/prisma";
import { issueUploadIntent, markUploadComplete, deleteDocument } from "@/lib/uploads";

const requestSchema = z.object({
  filename:    z.string().min(1).max(200),
  contentType: z.string().min(1).max(120),
  // Hard cap at 50 MB matches DOCUMENT_LIMITS.MEDICAL_REPORT; the
  // server re-validates against the policy so this is just a fast
  // first-line check.
  sizeBytes:   z.number().int().positive().max(50 * 1024 * 1024),
});

export async function requestMyDocUploadAction(input: {
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<
  | { ok: true; uploadUrl: string; documentId: string }
  | { ok: false; error: string }
> {
  const client = await requireClient("/me/documents");
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const res = await issueUploadIntent({
    kind: "MEDICAL_REPORT",
    ownerType: "CLIENT",
    ownerId: client.id,
    filename: parsed.data.filename,
    contentType: parsed.data.contentType,
    sizeBytes: parsed.data.sizeBytes,
    // No uploadedById — the client doesn't have a User row. Document
    // model already supports null uploadedById for portal-uploads.
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, uploadUrl: res.uploadUrl, documentId: res.documentId };
}

export async function completeMyDocUploadAction(input: {
  documentId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await requireClient("/me/documents");

  const doc = await prisma.document.findUnique({
    where: { id: input.documentId },
    select: { id: true, ownerClientId: true, kind: true, status: true },
  });
  if (!doc) return { ok: false, error: "Document not found" };
  // Defense in depth: even though issueUploadIntent set ownerClientId,
  // verify on confirm so a tampered documentId can't promote someone
  // else's PENDING row to UPLOADED.
  if (doc.ownerClientId !== client.id) return { ok: false, error: "Forbidden" };
  if (doc.kind !== "MEDICAL_REPORT") return { ok: false, error: "Wrong document kind" };

  const result = await markUploadComplete(input.documentId);
  if (!result.ok) return { ok: false, error: result.error ?? "S3 verification failed" };

  revalidatePath("/me/documents");
  return { ok: true };
}

export async function deleteMyDocAction(formData: FormData): Promise<void> {
  const client = await requireClient("/me/documents");
  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) return;

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { ownerClientId: true, kind: true },
  });
  if (!doc || doc.ownerClientId !== client.id || doc.kind !== "MEDICAL_REPORT") {
    // Silent no-op — don't leak whether the row exists.
    return;
  }

  // deleteDocument() handles S3 + Prisma + audit. We don't pass actorId
  // because the actor is a Client, not a User; audit() requires a User
  // FK. The Document row delete itself is the audit trail we have for
  // client-initiated deletions — see HANDOVER §16 for the gap.
  await deleteDocument(documentId, {
    reason: "Client deleted own medical report via /me/documents",
  });
  revalidatePath("/me/documents");
}
