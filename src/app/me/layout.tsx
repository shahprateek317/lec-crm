// /me — the client portal. Lives outside the (app) staff workspace.
// Different visual identity (warm, calm, less dense), different auth
// (passwordless via WhatsApp), different navigation (smaller, mobile-first).
//
// We don't share the staff layout because the mental model is different:
// staff are in this all day; clients open it weekly. Density vs warmth.

import Link from "next/link";
import { Suspense } from "react";

export const metadata = {
  title: "Life Energy Centre",
  description: "Your healing journey, gently tracked.",
};

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pranic-glow min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/me" className="flex items-baseline gap-2">
            <span className="font-serif text-base font-medium text-foreground">
              Life Energy Centre
            </span>
            <span className="text-[11px] text-muted-foreground">your portal</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Suspense fallback={null}>{children}</Suspense>
      </main>
      <footer className="mx-auto max-w-3xl px-4 py-10 text-center text-xs text-muted-foreground">
        Pecon Tower · New Town · Kolkata
      </footer>
    </div>
  );
}
