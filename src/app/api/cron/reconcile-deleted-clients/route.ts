// Nightly DPDP tombstone reconciler.
//
// Triggered by Vercel Cron (see vercel.json). Vercel sends an
// `Authorization: Bearer <CRON_SECRET>` header — we reject anything
// without a matching secret. CRON_SECRET is set as a Vercel
// environment variable; an unset secret means we fail closed.
//
// What it does:
//   1. Finds Client rows with deletedAt > 30 days ago that haven't
//      already been anonymized.
//   2. Anonymizes each in place (name → "Deleted Client #...", phone
//      → "deleted-<id>" so the @unique survives, identity fields
//      nulled).
//   3. Removes the bytes of every associated Document from S3 and
//      flips the row to FAILED with a sentinel storageKey.
//   4. Writes one CLIENT_HARD_DELETED audit row per anonymized client.
//
// Idempotent: re-running is a no-op because anonymized rows are
// detected via their sentinel name/phone and skipped.
//
// The reconciler library itself is pure-ish + unit-tested
// (src/lib/reconciler.test.ts). This route just wires Auth +
// Prisma store + audit log.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { reconcileDeletedClients } from "@/lib/reconciler";
import { prismaReconcilerStore } from "@/lib/reconciler-store";

export const dynamic = "force-dynamic";
// Cron jobs should run on Node.js, not Edge — Prisma + AWS SDK need it.
export const runtime = "nodejs";
// Allow up to 5 minutes; nightly runs should be well under but
// occasional backlog can grow.
export const maxDuration = 300;

export async function GET(): Promise<NextResponse> {
  const h = await headers();
  const provided = h.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "";

  // Fail closed: no secret configured means no one can trigger.
  if (!secret) {
    console.error("[cron/reconcile-deleted-clients] CRON_SECRET not set — refusing to run");
    return NextResponse.json({ ok: false, error: "cron_secret_unset" }, { status: 500 });
  }
  if (provided !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const result = await reconcileDeletedClients(prismaReconcilerStore);

  // Per-client CLIENT_HARD_DELETED audit entries. Cron has no actor
  // session, so we attribute these to a synthetic SYSTEM actor — the
  // schema requires a real User row, so we look up the first
  // SUPER_ADMIN as the canonical "system" attribution. If none exists
  // (fresh install), we skip the audit write but still log the run.
  const systemActor = await prisma.user.findFirst({
    where: { roles: { has: "SUPER_ADMIN" }, active: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (systemActor) {
    for (const c of result.perClient) {
      await prisma.auditLog.create({
        data: {
          actorId: systemActor.id,
          action: "CLIENT_HARD_DELETED",
          targetType: "Client",
          targetId: c.clientId,
          meta: {
            via: "cron/reconcile-deleted-clients",
            documentsScrubbed: c.documentsScrubbed,
            storageFailures: c.storageFailures,
          },
        },
      }).catch((err) => console.error("[cron/reconcile-deleted-clients] audit write failed", c.clientId, err));
    }
  } else if (result.clientsAnonymized > 0) {
    console.warn("[cron/reconcile-deleted-clients] no SUPER_ADMIN found — skipping audit writes for", result.clientsAnonymized, "clients");
  }

  const elapsedMs = Date.now() - started;
  console.log("[cron/reconcile-deleted-clients] run complete", { ...result, elapsedMs });

  return NextResponse.json({
    ok: true,
    elapsedMs,
    ...result,
  });
}
