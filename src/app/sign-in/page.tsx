// Staff sign-in. Two-step when 2FA is enabled:
//
//   Step 1 (default):           email + password.
//   Step 2 (?error=totp_*):     email (readonly), hidden password
//                               carried forward, 6-digit code field.
//
// We don't carry state in a cookie/session — the form just re-renders
// with the same password in a hidden input and adds the code field.
// Simpler than a stateful half-session and safer (no half-session to
// expire / revoke).

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
  searchParams: Promise<{ error?: string; callbackUrl?: string; email?: string; enrolled?: string; codes?: string }>;
}) {
  const sp = await searchParams;
  const isDemo = env.WHATSAPP_PROVIDER === "stub" && env.RAZORPAY_PROVIDER === "stub";

  // One-time backup codes display after admin enrollment via /admin-enroll.
  let enrollmentBackupCodes: string[] | null = null;
  if (sp.enrolled === "1" && sp.codes) {
    try {
      enrollmentBackupCodes = JSON.parse(Buffer.from(sp.codes, "base64url").toString("utf8")) as string[];
    } catch { /* ignore malformed */ }
  }

  // 2FA step gate. The action redirects with the user's email in the
  // query so we can pre-fill + show it read-only on the TOTP step.
  // Note: we have no way to carry the password through the URL safely.
  // The form renders a hidden password input that the BROWSER preserved
  // from the prior submission via autofill / page state — but since we
  // can't rely on that across a redirect, we re-render the full form
  // and ask the user to re-enter password + code together. The signIn
  // action handles both fields in one call.
  const needsTotp = sp.error === "totp_required" || sp.error === "totp_invalid";

  return (
    <main className="pranic-glow flex min-h-screen items-center justify-center px-6 py-12">
      <div className={`w-full rounded-2xl border border-border bg-card p-8 shadow-sm ${enrollmentBackupCodes ? "max-w-lg" : "max-w-sm"}`}>
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="font-serif text-2xl font-medium text-foreground hover:opacity-80"
          >
            {t.common.appName}
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            {needsTotp ? t.signIn.totpPrompt : t.signIn.subtitle}
          </p>
        </div>

        {/* Demo one-tap buttons — only on step 1 so the TOTP step
            stays focused. */}
        {isDemo && !needsTotp && (
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
                    value={sp.callbackUrl ?? "/"}
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
              defaultValue={sp.email ?? ""}
              readOnly={needsTotp}
              className={`flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring ${
                needsTotp ? "cursor-not-allowed bg-muted/40 text-muted-foreground" : ""
              }`}
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
              autoFocus={!needsTotp}
              className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {needsTotp && (
            <div className="space-y-1.5">
              <label htmlFor="totpCode" className="text-sm font-medium">
                {t.signIn.totpLabel}
              </label>
              <input
                id="totpCode"
                name="totpCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9 ]*"
                autoComplete="one-time-code"
                maxLength={7}
                required
                autoFocus
                placeholder="123 456"
                className="flex h-12 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-center font-mono text-lg tracking-widest outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}

          {sp.enrolled === "1" && !enrollmentBackupCodes && (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 border border-emerald-200">
              Two-factor authentication is now active. Please sign in.
            </p>
          )}

          {enrollmentBackupCodes && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 space-y-3">
              <p className="text-sm font-medium text-emerald-900">
                ✓ Two-factor authentication is active
              </p>
              <p className="text-xs text-emerald-800">
                Save these 10 backup codes — each can be used <strong>once</strong> to sign
                in if you lose your phone. They won&apos;t be shown again.
              </p>
              <div className="grid grid-cols-2 gap-1 rounded bg-white border border-emerald-200 p-2 font-mono text-xs">
                {enrollmentBackupCodes.map((code) => (
                  <span key={code} className="text-center tracking-wider">{code}</span>
                ))}
              </div>
              <p className="text-xs text-emerald-700">Now sign in below with your authenticator app.</p>
            </div>
          )}

          {sp.error === "invalid" && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {t.signIn.invalid}
            </p>
          )}
          {sp.error === "totp_invalid" && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {t.signIn.totpInvalid}
            </p>
          )}

          <SubmitButton
            pendingLabel="Signing in…"
            className="h-11 w-full rounded-lg bg-primary font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            {needsTotp ? t.signIn.totpVerify : t.signIn.submit}
          </SubmitButton>

          {needsTotp && (
            <Link
              href={sp.callbackUrl ? `/sign-in?callbackUrl=${encodeURIComponent(sp.callbackUrl)}` : "/sign-in"}
              className="block text-center text-xs text-muted-foreground hover:text-foreground"
            >
              {t.signIn.totpBack}
            </Link>
          )}
        </form>
      </div>
    </main>
  );
}
