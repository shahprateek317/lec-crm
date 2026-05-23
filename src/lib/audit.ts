// Audit log helper — who accessed what, when, from where.
//
// Required by India's DPDP Act 2025 (if ever questioned), but more
// practically: cheap insider-risk insurance. The CRM gives QC and admin
// users access to every client's medical documents, healing transcripts,
// and WhatsApp history. If a record ever needs to be made of "who looked
// at X," we have it.
//
// Pattern: at the top of every server action / page route that touches
// sensitive data, call `await audit("ACTION", "TargetType", id)`. Failure
// is silent and console-logged — we never want a failed audit write to
// break the user's primary flow. (If audit writes start failing in
// production, surface it via a separate health alert.)

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import type { AuditAction } from "@prisma/client";

export async function audit(
  action: AuditAction,
  targetType: string,
  targetId: string,
  opts: { actorId?: string; meta?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    let actorId = opts.actorId;
    let ip: string | undefined;
    try {
      const h = await headers();
      ip =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        undefined;
    } catch {
      // headers() throws outside a request scope — fine for background jobs.
    }
    if (!actorId) {
      // Lazy import to avoid pulling next-auth into Edge bundles via this file.
      const { auth } = await import("@/lib/auth");
      const session = await auth().catch(() => null);
      actorId = session?.user?.id;
    }
    if (!actorId) return; // No actor → not auditable. Background jobs pass actorId explicitly.

    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        targetType,
        targetId,
        ip: ip ?? null,
        meta: opts.meta as never,
      },
    });
  } catch (err) {
    console.error("[audit] write failed", { action, targetType, targetId }, err);
  }
}
