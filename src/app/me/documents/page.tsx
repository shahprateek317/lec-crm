// /me/documents — client-portal medical reports.
//
// Lists every Document the client has uploaded with kind = MEDICAL_REPORT.
// Each row shows the filename, upload date, size, and inline view + delete
// affordances. Delete sets off /api/documents/[id] is staff-only — clients
// download via the parallel /api/me/documents/[id] route which checks
// requireClient() ownership.
//
// Why a separate /api route for clients: the existing
// /api/documents/[id]/route.ts uses auth() (staff NextAuth session) and
// would reject a client portal session cookie. Mirroring the route under
// /api/me/* keeps the two auth models cleanly separated.

import Link from "next/link";
import { format } from "date-fns";
import { FileText, ChevronLeft, Trash2, ExternalLink } from "lucide-react";
import { requireClient } from "@/lib/me-session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { MedicalReportUploader } from "@/components/medical-report-uploader";
import { deleteMyDocAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your documents · Life Energy Centre" };

function humanSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function MyDocumentsPage() {
  const client = await requireClient("/me/documents");

  const documents = await prisma.document.findMany({
    where: {
      ownerClientId: client.id,
      kind: "MEDICAL_REPORT",
      // Only show successfully-uploaded rows; PENDING/FAILED rows are
      // dangling intents we don't want to expose. The reconciler sweeps
      // them out (Phase 2c).
      status: "UPLOADED",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      contentType: true,
      sizeBytes: true,
      uploadedAt: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/me"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3 w-3" />
          Back to portal
        </Link>
        <h1 className="flex items-center gap-2 font-serif text-2xl font-medium tracking-tight text-foreground">
          <FileText className="h-6 w-6 text-primary" />
          Your documents
        </h1>
        <p className="text-sm text-muted-foreground">
          Upload medical reports here so the centre can adapt your healing
          plan. Only you and the centre&apos;s clinical staff can see these.
        </p>
      </header>

      <MedicalReportUploader />

      <Card className="rounded-2xl">
        <CardContent className="py-2">
          {documents.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No documents yet. Use the uploader above to add your first
              medical report.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-2 py-3">
                  <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {d.filename}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {humanSize(d.sizeBytes)} ·{" "}
                      {format(d.uploadedAt ?? d.createdAt, "d MMM yyyy")}
                    </p>
                  </div>
                  <a
                    href={`/api/me/documents/${d.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View
                  </a>
                  <form action={deleteMyDocAction}>
                    <input type="hidden" name="documentId" value={d.id} />
                    <SubmitButton
                      pendingLabel="Deleting…"
                      className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground/70">
        Files are stored securely in our private S3 bucket and only
        accessible via short-lived signed URLs. Deletes are immediate.
      </p>
    </div>
  );
}
