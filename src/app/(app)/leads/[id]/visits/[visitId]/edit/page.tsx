import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { parseChakraStates } from "@/lib/healing";
import { DemoHealingSection } from "@/components/healing/demo-healing-section";
import { updateVisitDetailsAction } from "./actions";
import { sendVisitFollowupAction } from "./send-followup-action";

export const metadata = { title: "Edit visit details" };

export default async function EditVisitPage({
  params,
}: {
  params: Promise<{ id: string; visitId: string }>;
}) {
  const { id, visitId } = await params;

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
        <h1 className="font-serif text-3xl font-medium tracking-tight">Visit details</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {visit.client.name} · {format(visit.scheduledAt, "dd MMM yyyy, HH:mm")}
          {visit.assignedHealer && ` · with ${visit.assignedHealer.name}`}
          {visit.visitedAt && ` · Done ${format(visit.visitedAt, "dd MMM yyyy")}`}
        </p>
      </header>

      <form
        action={updateVisitDetailsAction}
        className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <input type="hidden" name="visitId" value={visit.id} />
        <input type="hidden" name="clientId" value={visit.clientId} />

        <Field id="problemsDiscussed" label="Problems & concerns discussed">
          <textarea
            id="problemsDiscussed"
            name="problemsDiscussed"
            rows={5}
            defaultValue={visit.problemsDiscussed ?? ""}
            className={`${inputCls} min-h-28 resize-y py-2`}
            placeholder="Describe the client's health issues, concerns, and background discussed during the visit…"
          />
        </Field>

        <Field id="healingExplained" label="Pranic healing information shared">
          <textarea
            id="healingExplained"
            name="healingExplained"
            rows={3}
            defaultValue={visit.healingExplained ?? ""}
            className={`${inputCls} min-h-20 resize-y py-2`}
            placeholder="What was explained about pranic healing — how it works, benefits, process…"
          />
        </Field>

        <DemoHealingSection
          defaultDone={visit.demoHealingDone}
          defaultChakrasBefore={parseChakraStates(visit.demoChakrasBefore)}
          defaultChakrasAfter={parseChakraStates(visit.demoChakrasAfter)}
          defaultNotes={visit.demoHealingNotes ?? ""}
        />

        <Field id="initialFeedback" label="Client's feedback after the session">
          <textarea
            id="initialFeedback"
            name="initialFeedback"
            rows={3}
            defaultValue={visit.initialFeedback ?? ""}
            className={`${inputCls} min-h-20 resize-y py-2`}
            placeholder="How did they feel? Any immediate response or comments?"
          />
        </Field>

        <Field id="notes" label="Internal notes (staff only)">
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={visit.notes ?? ""}
            className={`${inputCls} min-h-20 resize-y py-2`}
            placeholder="Private observations — not visible to client."
          />
        </Field>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Save details
          </button>
          <Link href={`/leads/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </Link>
        </div>
      </form>

      {/* ── WhatsApp follow-up ── */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Send follow-up WhatsApp to {visit.client.name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Select the recommended next steps — a personalised message will be sent via WhatsApp.
          </p>
        </div>

        <form action={sendVisitFollowupAction} className="space-y-4">
          <input type="hidden" name="visitId" value={visit.id} />
          <input type="hidden" name="clientId" value={visit.clientId} />

          <div className="space-y-2">
            {[
              { name: "step_demo", label: "Further demo pranic healing session" },
              { name: "step_meditation", label: "Join our meditation group" },
              { name: "step_counselling", label: "Counselling session with our counsellor" },
              { name: "step_paid", label: "Full paid healing package" },
            ].map((s) => (
              <label key={s.name} className="flex items-center gap-2.5 cursor-pointer text-sm">
                <input type="checkbox" name={s.name} value="1" defaultChecked={s.name === "step_demo"} className="h-4 w-4 rounded accent-primary" />
                {s.label}
              </label>
            ))}
          </div>

          <Field id="step_custom" label="Additional recommendation (optional)">
            <input id="step_custom" name="step_custom" className={inputCls} placeholder="e.g. Distant healing, home visit…" />
          </Field>

          <button
            type="submit"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            📲 Send WhatsApp follow-up
          </button>
        </form>
      </div>
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
