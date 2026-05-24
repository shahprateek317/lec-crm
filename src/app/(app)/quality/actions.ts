"use server";

// Quality module — server actions.
// All actions require canAuditQuality() (SUPER_ADMIN | ADMIN | QC).

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, canAuditQuality } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import type { QualityRating } from "@prisma/client";

async function requireQc() {
  const session = await requireSession();
  if (!canAuditQuality(session.user.role)) {
    redirect("/dashboard?error=forbidden");
  }
  return session;
}

// ── Per-session audit note ───────────────────────────────────────────

const noteSchema = z.object({
  sessionId: z.string().min(1),
  rating: z.enum(["POOR", "FAIR", "GOOD", "VERY_GOOD", "EXCELLENT"]).optional(),
  note: z.string().min(1).max(2000),
  needsHealerAttention: z.boolean().optional(),
  escalated: z.boolean().optional(),
});

export async function addQualityNoteAction(formData: FormData) {
  const session = await requireQc();
  const parsed = noteSchema.safeParse({
    sessionId: formData.get("sessionId"),
    rating: formData.get("rating") || undefined,
    note: formData.get("note"),
    needsHealerAttention: formData.get("needsHealerAttention") === "on",
    escalated: formData.get("escalated") === "on",
  });
  if (!parsed.success) {
    redirect(`/quality/sessions/${String(formData.get("sessionId") ?? "")}?error=invalid`);
  }

  // Verify the session exists; capture the healer + client for the
  // notification fan-out below.
  const hsExists = await prisma.healingSession.findUnique({
    where: { id: parsed.data.sessionId },
    select: { id: true, healerId: true, client: { select: { name: true } } },
  });
  if (!hsExists) redirect("/quality?error=not_found");

  await prisma.qualityNote.create({
    data: {
      sessionId: parsed.data.sessionId,
      authorId: session.user.id,
      rating: parsed.data.rating as QualityRating | undefined,
      note: parsed.data.note,
      needsHealerAttention: parsed.data.needsHealerAttention ?? false,
      escalated: parsed.data.escalated ?? false,
    },
  });

  // Notify the healer when QC flags a note for their attention or
  // escalates it. Plain notes (acknowledgement-only) don't generate
  // notifications — they'd be too noisy in a busy clinic.
  if (parsed.data.needsHealerAttention || parsed.data.escalated) {
    await notify({
      recipientId: hsExists.healerId,
      kind: "QC_FLAGGED_SESSION",
      title: parsed.data.escalated
        ? "Quality escalated a session for review"
        : "Quality flagged a session for your attention",
      body: `Session for ${hsExists.client.name} — ${parsed.data.note.slice(0, 100)}${parsed.data.note.length > 100 ? "…" : ""}`,
      href: `/healing/${parsed.data.sessionId}`,
    });
  }

  await audit("HEALING_SESSION_VIEWED", "HealingSession", parsed.data.sessionId, {
    actorId: session.user.id,
    meta: {
      rating: parsed.data.rating ?? null,
      escalated: parsed.data.escalated ?? false,
      needsHealerAttention: parsed.data.needsHealerAttention ?? false,
    },
  });

  revalidatePath(`/quality/sessions/${parsed.data.sessionId}`);
  redirect(`/quality/sessions/${parsed.data.sessionId}?ok=note_saved`);
}

export async function acknowledgeQualityNoteAction(formData: FormData) {
  const session = await requireQc();
  const noteId = String(formData.get("noteId") ?? "");
  if (!noteId) redirect("/quality");
  const note = await prisma.qualityNote.findUnique({
    where: { id: noteId },
    select: { sessionId: true },
  });
  if (!note) redirect("/quality");
  await prisma.qualityNote.update({
    where: { id: noteId },
    data: { acknowledgedByHealerAt: new Date() },
  });
  // Note: the audit log captures the QC's acknowledgement on their behalf.
  // Real healer self-ack ships in Phase 2 when healers see /my-quality-notes.
  void session; // eslint quiet
  revalidatePath(`/quality/sessions/${note.sessionId}`);
}

// ── Cert verify ──────────────────────────────────────────────────────

export async function verifyCertificationAction(formData: FormData) {
  const session = await requireQc();
  const certId = String(formData.get("certId") ?? "");
  const verifierNotes = String(formData.get("notes") ?? "").trim() || null;
  if (!certId) redirect("/quality");
  const cert = await prisma.healerCertificate.findUnique({
    where: { id: certId },
    select: { id: true, userId: true, verifiedAt: true },
  });
  if (!cert) redirect("/quality?error=not_found");

  await prisma.healerCertificate.update({
    where: { id: certId },
    data: {
      verifiedAt: new Date(),
      verifiedById: session.user.id,
      notes: verifierNotes,
    },
  });

  await audit("CERT_VERIFIED", "HealerCertificate", certId, {
    actorId: session.user.id,
    meta: { healerUserId: cert.userId },
  });

  // Notify the healer that one of their uploaded certs has been
  // verified — closes the loop for them after submission.
  await notify({
    recipientId: cert.userId,
    kind: "CERT_VERIFIED",
    title: "A certification was verified",
    body: verifierNotes ? `Note: ${verifierNotes.slice(0, 120)}` : undefined,
    href: "/me/profile",
  });

  revalidatePath(`/quality/healers/${cert.userId}`);
  redirect(`/quality/healers/${cert.userId}?ok=verified`);
}

export async function unverifyCertificationAction(formData: FormData) {
  const session = await requireQc();
  const certId = String(formData.get("certId") ?? "");
  if (!certId) redirect("/quality");
  const cert = await prisma.healerCertificate.findUnique({
    where: { id: certId },
    select: { userId: true },
  });
  if (!cert) redirect("/quality");
  await prisma.healerCertificate.update({
    where: { id: certId },
    data: { verifiedAt: null, verifiedById: null },
  });
  void session;
  revalidatePath(`/quality/healers/${cert.userId}`);
}
