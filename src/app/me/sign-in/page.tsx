// /me/sign-in — passwordless client portal entry.
// Phase 1 of the flow: user enters phone → we send WhatsApp.
// Phase 2: user enters the OTP from WhatsApp (or taps the link, which
//          bypasses this page entirely via /me/auth/[token]).
//
// Two-phase implemented as a single page parameterised by ?phase= so
// back/forward navigation is sensible and there are no spinner-flicker
// transitions.

import Link from "next/link";
import { redirect } from "next/navigation";
import { Phone, ShieldCheck, ArrowLeft } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { getClient } from "@/lib/me-session";
import { requestSignInAction, verifyOtpAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · Life Energy Centre" };

const inputCls =
  "flex h-12 w-full rounded-lg border border-input bg-card px-4 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

const ERRORS: Record<string, string> = {
  invalid_phone: "That doesn't look like a valid phone number.",
  invalid_code:  "Please enter the 6-digit code from your WhatsApp message.",
  wrong:         "Wrong code. Try again.",
  wrong_code:    "Wrong code. Try again.",
  expired:       "That code expired. Please request a new one.",
  no_challenge:  "We couldn't find a sign-in request for that number — please start again.",
  locked:        "Too many wrong attempts. Please request a new code.",
  rate_limited:  "Too many sign-in requests. Please wait an hour and try again.",
};

export default async function MeSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ phase?: string; phone?: string; error?: string; next?: string }>;
}) {
  // Already signed in? Bounce to the dashboard (or the `next` deep link).
  const existing = await getClient();
  const sp = await searchParams;
  if (existing) {
    redirect(sp.next && sp.next.startsWith("/me") ? sp.next : "/me");
  }

  const phase = sp.phase === "verify" ? "verify" : "request";
  const errorMessage = sp.error ? ERRORS[sp.error] ?? null : null;

  if (phase === "request") {
    return (
      <div className="mx-auto max-w-sm space-y-6 py-8">
        <header className="text-center">
          <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
            Sign in to your portal
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your phone number and we&rsquo;ll send a sign-in code to your
            WhatsApp.
          </p>
        </header>

        {errorMessage && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        <form action={requestSignInAction} className="space-y-4">
          <label htmlFor="phone" className="block">
            <span className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-medium">
              <Phone className="h-3.5 w-3.5 text-primary" />
              Phone number
            </span>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              placeholder="98XXXXXXXX"
              className={inputCls}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Indian numbers only — country code (+91) is added automatically.
            </p>
          </label>

          <SubmitButton
            pendingLabel="Sending…"
            className="h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground hover:bg-primary/90"
          >
            Send sign-in code
          </SubmitButton>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          New here? Visit the centre or{" "}
          <Link href="/enquiry" className="text-primary hover:underline">
            request a session
          </Link>{" "}
          first — your portal opens once we have your details.
        </p>
      </div>
    );
  }

  // Verify phase
  const phone = sp.phone ?? "";
  return (
    <div className="mx-auto max-w-sm space-y-6 py-8">
      <header className="text-center">
        <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          Check your WhatsApp
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a 6-digit code to <strong>{phone || "your phone"}</strong>.
          You can also just tap the sign-in link in the message — same thing,
          one less step.
        </p>
      </header>

      {errorMessage && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <form action={verifyOtpAction} className="space-y-4">
        <input type="hidden" name="phone" value={phone} />
        <label htmlFor="otp" className="block">
          <span className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            6-digit code
          </span>
          <input
            id="otp"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            placeholder="••••••"
            className={`${inputCls} text-center text-2xl tracking-[0.4em]`}
          />
        </label>

        <SubmitButton
          pendingLabel="Verifying…"
          className="h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground hover:bg-primary/90"
        >
          Sign in
        </SubmitButton>
      </form>

      <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
        <p>Didn&rsquo;t get the code? Check that WhatsApp is delivering.</p>
        <Link
          href="/me/sign-in"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <ArrowLeft className="h-3 w-3" />
          Use a different number
        </Link>
      </div>
    </div>
  );
}
