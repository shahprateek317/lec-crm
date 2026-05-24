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
import type { AuditAction, Prisma } from "@prisma/client";

export type AuditMeta = Prisma.InputJsonValue;

/**
 * Append a row to the audit log.
 *
 * Failure modes:
 *  - If the audit-log write itself fails, we console.error and swallow —
 *    audit writes must never break the primary user flow.
 *  - If the actor can't be resolved (no session, no opts.actorId), we
 *    emit a `console.warn` and skip the write. Phase 2 will surface this
 *    as a Prometheus counter / Slack alert so unattributable reads are
 *    visible to ops. We deliberately do NOT silently swallow that case
 *    because access without a tracked actor is the exact insider-risk
 *    we're guarding against.
 */
export async function audit(
  action: AuditAction,
  targetType: string,
  targetId: string,
  opts: { actorId?: string; meta?: AuditMeta } = {},
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
      try {
        const session = await auth();
        actorId = session?.user?.id;
      } catch (err) {
        console.warn("[audit] session resolution failed", { action, targetType, targetId }, err);
      }
    }
    if (!actorId) {
      console.warn("[audit] skipping write — no actor resolved", { action, targetType, targetId });
      return;
    }

    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        targetType,
        targetId,
        ip: ip ?? null,
        meta: opts.meta,
      },
    });
  } catch (err) {
    console.error("[audit] write failed", { action, targetType, targetId }, err);
  }
}
