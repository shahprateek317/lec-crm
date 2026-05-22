import { signInAction } from "./actions";
import { t } from "@/lib/i18n";
import Link from "next/link";
import { env } from "@/lib/env";
import { SubmitButton } from "@/components/submit-button";

export const metadata = { title: "Sign in" };

const DEMO_ROLES = [
  { role: "Admin",       email: "admin@lec.app",       tone: "bg-primary/10 text-primary" },
  { role: "Coordinator", email: "coordinator@lec.app", tone: "bg-blue-100 text-blue-900" },
  { role: "Counsellor",  email: "counsellor@lec.app",  tone: "bg-violet-100 text-violet-900" },
  { role: "Healer",      email: "healer@lec.app",      tone: "bg-teal-100 text-teal-900" },
  { role: "Quality",     email: "quality@lec.app",     tone: "bg-amber-100 text-amber-900" },
];

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const isDemo = env.WHATSAPP_PROVIDER === "stub" && env.RAZORPAY_PROVIDER === "stub";

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

        {isDemo && (
          <div className="mb-5 space-y-2 rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Demo · one-tap sign-in
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ROLES.map((r) => (
                <form key={r.email} action={signInAction}>
                  <input type="hidden" name="email" value={r.email} />
                  <input type="hidden" name="password" value="demo1234" />
                  <input
                    type="hidden"
                    name="callbackUrl"
                    value={sp.callbackUrl ?? "/dashboard"}
                  />
                  <SubmitButton
                    pendingLabel="Signing in…"
                    className={`h-10 w-full rounded-md text-sm font-medium hover:opacity-80 ${r.tone}`}
                  >
                    {r.role}
                  </SubmitButton>
                </form>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Or sign in manually below — password for all demo accounts is{" "}
              <code className="rounded bg-background px-1.5 py-0.5">demo1234</code>.
            </p>
          </div>
        )}

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
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
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

          <SubmitButton
            pendingLabel="Signing in…"
            className="h-11 w-full rounded-lg bg-primary font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            {t.signIn.submit}
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}
