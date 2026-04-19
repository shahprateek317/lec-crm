import Link from "next/link";
import { t } from "@/lib/i18n";

export const metadata = { title: "Thank you" };

export default function ThanksPage() {
  return (
    <main className="pranic-glow flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-7 w-7">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l4 4L19 6" />
          </svg>
        </div>
        <h1 className="font-serif text-3xl font-medium tracking-tight">
          {t.enquiry.success}
        </h1>
        <p className="mt-3 text-balance text-muted-foreground">
          {t.enquiry.successDetails}
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card px-6 font-medium text-foreground transition-colors hover:bg-muted"
        >
          {t.common.backHome}
        </Link>
      </div>
    </main>
  );
}
