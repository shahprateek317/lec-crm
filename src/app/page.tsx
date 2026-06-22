import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { landingForRole } from "@/lib/role-landing";
import { InstallAppPrompt } from "@/components/install-app-prompt";

// Authenticated visitors get role-aware redirected — coordinators to /inbox,
// healers to /my-schedule, etc. Guests see the marketing splash + sign-in /
// enquiry CTAs.
export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect(landingForRole(session.user.roles));
  }

  return (
    <main className="pranic-glow min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-8 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="h-9 w-9"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3c2.5 3 2.5 6 0 9-2.5-3-2.5-6 0-9ZM3 12c3 2.5 6 2.5 9 0-3-2.5-6-2.5-9 0Zm18 0c-3 2.5-6 2.5-9 0 3-2.5 6-2.5 9 0ZM12 21c-2.5-3-2.5-6 0-9 2.5 3 2.5 6 0 9Z"
            />
            <circle cx="12" cy="12" r="1.4" fill="currentColor" />
          </svg>
        </div>

        <h1 className="font-serif text-4xl font-medium tracking-tight text-foreground md:text-5xl">
          Life Energy Centre
        </h1>
        <p className="mt-3 max-w-xl text-balance text-lg text-muted-foreground">
          A calm, welcoming space for Pranic Healing — every enquiry to every
          healing session, gently tracked.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sign-in"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Staff sign in
          </Link>
          <Link
            href="/enquiry"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card px-6 font-medium text-foreground transition-colors hover:bg-muted"
          >
            New enquiry
          </Link>
        </div>

        <p className="mt-16 text-sm text-muted-foreground">
          Pecon Tower · New Town · Kolkata
        </p>
      </div>
      <InstallAppPrompt />
    </main>
  );
}
