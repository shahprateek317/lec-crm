// GET /api/me/documents/[id] — client-portal mirror of /api/documents/[id].
//
// The staff route uses NextAuth (auth()) and would reject a client
// portal cookie. This route uses requireClient() instead and enforces
// owner === session.client.id. Same outcome (302 → presigned S3 GET)
// but a clean separation of the two auth models.
//
// Audit log: uses the polymorphic actorType="Client" path introduced in
// Phase 2d item 3b so client-initiated downloads are now tracked.

import { NextResponse } from "next/server";
import { requireClient } from "@/lib/me-session";
import { prisma } from "@/lib/prisma";
import { getDownloadUrl } from "@/lib/uploads";
import { audit } from "@/lib/audit";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const client = await requireClient(`/me/documents`);
  const { id: documentId } = await ctx.params;

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, ownerClientId: true, status: true },
  });
  // Return 404 for both "doesn't exist" AND "exists but not yours" so
  // a client can't enumerate other clients' documentIds by probing
  // 404 vs 403. The collapse is intentional — see review #6.
  if (!doc || doc.ownerClientId !== client.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (doc.status !== "UPLOADED") {
    return NextResponse.json({ error: "upload_incomplete" }, { status: 409 });
  }

  // Write audit log before redirecting — client actors now supported
  // via the polymorphic actorType column added in Phase 2d item 3b.
  await audit("DOCUMENT_DOWNLOADED", "Document", documentId, {
    actorType:     "Client",
    actorClientId: client.id,
  });

  const url = await getDownloadUrl(documentId, { actorId: "" });
  if (!url.ok) {
    return NextResponse.json({ error: url.error }, { status: 500 });
  }
  return NextResponse.redirect(url.url, 302);
}
