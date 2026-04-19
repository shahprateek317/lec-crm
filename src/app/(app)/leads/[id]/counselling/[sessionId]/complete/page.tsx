import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { completeCounselingAction } from "./actions";

export const metadata = { title: "Complete counselling" };

export default async function CompleteCounsellingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; sessionId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, sessionId } = await params;
  const sp = await searchParams;

  const session = await prisma.counselingSession.findUnique({
    where: { id: sessionId },
    include: { client: true, counsellor: true },
  });
  if (!session || session.clientId !== id) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        href={`/leads/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to {session.client.name}
      </Link>

      <header>
        <h1 className="font-serif text-3xl font-medium tracking-tight">
          Complete counselling
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Counselling with {session.counsellor.name} on{" "}
          {format(session.scheduledAt, "dd MMM yyyy, HH:mm")}
        </p>
      </header>

      <form
        action={completeCounselingAction}
        className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <input type="hidden" name="sessionId" value={session.id} />
        <input type="hidden" name="clientId" value={session.clientId} />

        <Field id="issueRefined" label="Refined understanding of the issue">
          <textarea
            id="issueRefined"
            name="issueRefined"
            rows={4}
            defaultValue={session.client.issueRefined ?? session.client.issue ?? ""}
            className={`${inputCls} min-h-24 resize-y py-2`}
            placeholder="Post-counselling, how would you describe the root concern?"
          />
        </Field>

        <Field id="severity" label="Severity (1 = mild, 10 = severe)">
          <input
            id="severity"
            name="severity"
            type="number"
            min={1}
            max={10}
            defaultValue={session.client.severity ?? ""}
            className={inputCls}
          />
        </Field>

        <Field id="keyNotes" label="Key notes for healers">
          <textarea
            id="keyNotes"
            name="keyNotes"
            rows={4}
            className={`${inputCls} min-h-24 resize-y py-2`}
            placeholder="Anything the healer should know before the first visit."
          />
        </Field>

        {sp.error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {decodeURIComponent(sp.error)}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Mark done &amp; invite for visit
          </button>
          <Link href={`/leads/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({ id, label, required, children }: { id: string; label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}
