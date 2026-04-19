import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { createLeadAction } from "./actions";

export const metadata = { title: "Add lead" };

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const staff = await prisma.user.findMany({
    where: { active: true, role: { in: ["COORDINATOR", "COUNSELLOR"] } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/leads"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to leads
      </Link>

      <header>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Add lead</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Capture an enquiry received by phone, walk-in, or referral.
        </p>
      </header>

      <form
        action={createLeadAction}
        className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <Field id="name" label="Full name" required>
          <input id="name" name="name" required minLength={2} className={inputCls} />
        </Field>

        <Field id="phone" label="Phone (WhatsApp)" required>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            className={inputCls}
            placeholder="+91 98765 43210"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field id="age" label="Age">
            <input id="age" name="age" type="number" min={1} max={120} className={inputCls} />
          </Field>
          <Field id="area" label="Area / locality">
            <input id="area" name="area" className={inputCls} />
          </Field>
        </div>

        <Field id="email" label="Email (optional)">
          <input id="email" name="email" type="email" className={inputCls} />
        </Field>

        <Field id="issue" label="What brings them to us?">
          <textarea
            id="issue"
            name="issue"
            rows={3}
            className={`${inputCls} min-h-20 resize-y py-2`}
          />
        </Field>

        <Field id="issueDuration" label="How long have they had this?">
          <input
            id="issueDuration"
            name="issueDuration"
            className={inputCls}
            placeholder="e.g. 6 months"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field id="source" label="Enquiry source">
            <select id="source" name="source" defaultValue="MANUAL" className={inputCls}>
              <option value="MANUAL">Manual entry</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="FACEBOOK">Facebook ad</option>
              <option value="INSTAGRAM">Instagram ad</option>
              <option value="WALK_IN">Walk-in</option>
              <option value="REFERRAL">Referral</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field id="assignedToId" label="Assign to">
            <select id="assignedToId" name="assignedToId" defaultValue="" className={inputCls}>
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field id="notes" label="Internal notes (optional)">
          <textarea id="notes" name="notes" rows={2} className={`${inputCls} min-h-16 resize-y py-2`} />
        </Field>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="silent" value="true" />
          Skip WhatsApp welcome message
        </label>

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
            Create lead
          </button>
          <Link
            href="/leads"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
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
