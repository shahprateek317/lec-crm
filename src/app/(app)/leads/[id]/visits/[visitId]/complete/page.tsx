import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { completeVisitAction } from "./actions";

export const metadata = { title: "Complete visit" };

export default async function CompleteVisitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; visitId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, visitId } = await params;
  const sp = await searchParams;

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { client: true, assignedHealer: true },
  });
  if (!visit || visit.clientId !== id) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        href={`/leads/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to {visit.client.name}
      </Link>

      <header>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Complete visit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {visit.client.name} · {format(visit.scheduledAt, "dd MMM yyyy, HH:mm")}
          {visit.assignedHealer && ` · with ${visit.assignedHealer.name}`}
        </p>
      </header>

      <form
        action={completeVisitAction}
        className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <input type="hidden" name="visitId" value={visit.id} />
        <input type="hidden" name="clientId" value={visit.clientId} />

        <Field id="initialFeedback" label="Initial feedback from the client">
          <textarea
            id="initialFeedback"
            name="initialFeedback"
            rows={4}
            className={`${inputCls} min-h-24 resize-y py-2`}
            placeholder="How did they feel after the session?"
          />
        </Field>

        <Field id="notes" label="Internal notes">
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className={`${inputCls} min-h-20 resize-y py-2`}
            placeholder="Private observations for staff."
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
            Mark visit done
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
