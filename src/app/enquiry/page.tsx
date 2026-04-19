import { t } from "@/lib/i18n";
import Link from "next/link";
import { submitEnquiry } from "./actions";

export const metadata = { title: "New enquiry" };

export default async function EnquiryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="pranic-glow min-h-screen px-6 py-12">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="font-serif text-2xl font-medium text-foreground hover:opacity-80"
          >
            {t.common.appName}
          </Link>
          <h1 className="mt-4 font-serif text-3xl font-medium tracking-tight">
            {t.enquiry.title}
          </h1>
          <p className="mt-2 text-balance text-muted-foreground">
            {t.enquiry.subtitle}
          </p>
        </div>

        <form
          action={submitEnquiry}
          className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <Field id="name" label={t.enquiry.name} required>
            <input
              id="name"
              name="name"
              required
              minLength={2}
              className={inputCls}
              autoComplete="name"
            />
          </Field>

          <Field id="phone" label={t.enquiry.phone} required>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              className={inputCls}
              autoComplete="tel"
              placeholder="+91 98765 43210"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field id="age" label={t.enquiry.age}>
              <input
                id="age"
                name="age"
                type="number"
                min={1}
                max={120}
                className={inputCls}
              />
            </Field>
            <Field id="area" label={t.enquiry.area}>
              <input
                id="area"
                name="area"
                className={inputCls}
                placeholder="e.g. Salt Lake, New Town"
              />
            </Field>
          </div>

          <Field id="issue" label={t.enquiry.issue}>
            <textarea
              id="issue"
              name="issue"
              rows={4}
              className={`${inputCls} min-h-24 resize-y py-2`}
              placeholder={t.enquiry.issuePlaceholder}
            />
          </Field>

          <Field id="issueDuration" label={t.enquiry.duration}>
            <input
              id="issueDuration"
              name="issueDuration"
              className={inputCls}
              placeholder={t.enquiry.durationPlaceholder}
            />
          </Field>

          <input type="hidden" name="source" value="MANUAL" />

          {sp.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {sp.error}
            </p>
          )}

          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            {t.enquiry.submit}
          </button>
        </form>
      </div>
    </main>
  );
}

const inputCls =
  "flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

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
