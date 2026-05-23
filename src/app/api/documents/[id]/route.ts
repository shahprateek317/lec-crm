// GET /api/documents/[id] — issues a presigned S3 GET URL and 302's the
// browser to it. Ownership checks are role-aware:
//   • Owner (user or client) can always view their own.
//   • ADMIN / SUPER_ADMIN / QUALITY_CONTROLLER can view any.
//   • Other staff: forbidden.
//
// Every read is recorded in AuditLog. The presigned URL is generated
// per request, valid 15 minutes, then expires — no need to cache it.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDownloadUrl } from "@/lib/uploads";

const ELEVATED_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "QUALITY_CONTROLLER"]);

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: documentId } = await ctx.params;

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, ownerUserId: true, ownerClientId: true, status: true },
  });
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (doc.status !== "UPLOADED") {
    return NextResponse.json({ error: "upload_incomplete" }, { status: 409 });
  }

  const isOwner = doc.ownerUserId && doc.ownerUserId === session.user.id;
  const isElevated = ELEVATED_ROLES.has(session.user.role);
  // Client portal viewers don't reach this route in Phase 1a (they sign
  // in via a separate cookie); they'll get their own /me/api/documents
  // endpoint in Phase 1b that checks the client session.
  if (!isOwner && !isElevated) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = await getDownloadUrl(documentId, { actorId: session.user.id });
  if (!url.ok) {
    return NextResponse.json({ error: url.error }, { status: 500 });
  }

  return NextResponse.redirect(url.url, 302);
}
