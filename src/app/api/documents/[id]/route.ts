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
import { canViewDocument } from "@/lib/document-authz";

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

  if (!canViewDocument(doc, { userId: session.user.id, roles: session.user.roles })) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = await getDownloadUrl(documentId, { actorId: session.user.id });
  if (!url.ok) {
    return NextResponse.json({ error: url.error }, { status: 500 });
  }

  return NextResponse.redirect(url.url, 302);
}
