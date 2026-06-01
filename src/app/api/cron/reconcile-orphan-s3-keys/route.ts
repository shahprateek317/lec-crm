// Nightly cron: re-delete Document S3 objects that were marked FAILED
// but whose storageKey was never scrubbed to the sentinel value.
//
// This happens when the reconciler's S3 DeleteObject call fails (network
// blip, permissions hiccup). The reconciler scrubs the DB row regardless
// so the document is inaccessible, but the bytes may still live in S3.
// This sweep retries those deletions.
//
// Detection heuristic: FAILED documents whose storageKey does NOT start
// with "scrubbed-" still hold their original S3 key. Documents properly
// scrubbed by the reconciler have storageKey = "scrubbed-<id>".
//
// S3 DeleteObject is idempotent (returns 204 even for missing keys), so
// running this on upload-abandoned docs (never actually in S3) is safe.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const s3 = new S3Client({
  region: env.AWS_REGION,
  ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? { credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY } }
    : {}),
});

export async function GET(): Promise<NextResponse> {
  const h = await headers();
  const provided = h.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "";

  if (!secret) {
    console.error("[cron/reconcile-orphan-s3-keys] CRON_SECRET not set — refusing to run");
    return NextResponse.json({ ok: false, error: "cron_secret_unset" }, { status: 500 });
  }
  if (provided !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Find FAILED docs whose storageKey still looks like a real S3 path
  // (not the "scrubbed-<id>" sentinel written by scrubDocument).
  const orphans = await prisma.document.findMany({
    where: {
      status:     "FAILED",
      storageKey: { not: { startsWith: "scrubbed-" } },
    },
    select: { id: true, storageKey: true },
    take: 500, // safety cap — large backlogs get caught on successive nightly runs
  });

  let deleted = 0;
  let failures = 0;

  for (const doc of orphans) {
    try {
      await s3.send(new DeleteObjectCommand({
        Bucket: env.S3_UPLOADS_BUCKET,
        Key:    doc.storageKey,
      }));
      // Scrub the key so subsequent runs skip this row.
      await prisma.document.update({
        where: { id: doc.id },
        data:  { storageKey: `scrubbed-${doc.id}` },
      });
      deleted += 1;
    } catch (err) {
      console.error("[cron/reconcile-orphan-s3-keys] delete failed", { id: doc.id }, err);
      failures += 1;
    }
  }

  console.log("[cron/reconcile-orphan-s3-keys] run complete", {
    orphansFound: orphans.length,
    deleted,
    failures,
  });
  return NextResponse.json({ ok: true, orphansFound: orphans.length, deleted, failures });
}
