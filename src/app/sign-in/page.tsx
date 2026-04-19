import { signInAction } from "./actions";
import { t } from "@/lib/i18n";
import Link from "next/link";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="pranic-glow flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="font-serif text-2xl font-medium text-foreground hover:opacity-80"
          >
            {t.common.appName}
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">{t.signIn.subtitle}</p>
        </div>

        <form action={signInAction} className="space-y-4">
          <input
            type="hidden"
            name="callbackUrl"
            value={sp.callbackUrl ?? "/dashboard"}
          />

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              {t.signIn.email}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              {t.signIn.password}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {sp.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {t.signIn.invalid}
            </p>
          )}

          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            {t.signIn.submit}
          </button>
        </form>
      </div>
    </main>
  );
}
