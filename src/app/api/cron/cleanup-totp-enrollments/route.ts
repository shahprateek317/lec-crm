// Nightly cron: clear abandoned TOTP enrollment secrets.
//
// When an ADMIN/SUPER_ADMIN starts TOTP enrollment but never completes it
// (navigated away, session expired, device lost), their User row holds a
// totpSecret with totpEnabledAt = NULL indefinitely. This cron clears
// those secrets after 24 hours so stale QR codes can't be replayed.
//
// Safe to re-run (idempotent). The 24h window matches the enrollment
// token TTL (15 min) plus generous margin for slow completions.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(): Promise<NextResponse> {
  const h = await headers();
  const provided = h.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "";

  if (!secret) {
    console.error("[cron/cleanup-totp-enrollments] CRON_SECRET not set — refusing to run");
    return NextResponse.json({ ok: false, error: "cron_secret_unset" }, { status: 500 });
  }
  if (provided !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { count } = await prisma.user.updateMany({
    where: {
      totpEnabledAt: null,
      totpSecret:    { not: null },
      updatedAt:     { lt: cutoff },
    },
    data: { totpSecret: null },
  });

  console.log("[cron/cleanup-totp-enrollments] cleared abandoned secrets", { count });
  return NextResponse.json({ ok: true, clearedCount: count });
}
