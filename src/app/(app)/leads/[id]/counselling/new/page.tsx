import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { suggestCounsellors } from "@/lib/assignment";
import { DateTimePicker } from "@/components/date-picker";
import { scheduleCounselingAction } from "./actions";

export const metadata = { title: "Schedule counselling" };

export default async function ScheduleCounsellingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const [client, counsellors, suggestions] = await Promise.all([
    prisma.client.findUnique({ where: { id }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { active: true, role: { in: ["COUNSELLOR", "SENIOR_COUNSELLOR", "ADMIN"] } },
      orderBy: { name: "asc" },
    }),
    suggestCounsellors(id, undefined, 3),
  ]);

  if (!client) notFound();

  const defaultDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        href={`/leads/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to {client.name}
      </Link>
      <header>
        <h1 className="font-serif text-3xl font-medium tracking-tight">
          Schedule online counselling
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {client.name} will receive a WhatsApp confirmation automatically.
        </p>
      </header>
      <form
        action={scheduleCounselingAction}
        className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <input type="hidden" name="clientId" value={client.id} />

        <Field id="scheduledAt" label="Date & time" required>
          <DateTimePicker name="scheduledAt" defaultValue={defaultDate} required fromDate={new Date()} />
        </Field>

        <Field id="counsellorId" label="Counsellor" required>
          <select id="counsellorId" name="counsellorId" required defaultValue={suggestions[0]?.user.id ?? ""} className={inputCls}>
            <option value="" disabled>Select counsellor…</option>
            {counsellors.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {suggestions.length > 0 && suggestions[0].score > 0 && (
            <div className="mt-2 space-y-1.5 rounded-lg border border-dashed border-border bg-muted/30 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Suggested for this client
              </p>
              <ul className="space-y-1">
                {suggestions.filter((s) => s.score > 0).map((s, i) => (
                  <li key={s.user.id} className="text-xs">
                    <span className="font-medium text-foreground">{i + 1}. {s.user.name}</span>
                    <span className="text-muted-foreground"> · {s.reasons.join(" · ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
            Schedule
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
