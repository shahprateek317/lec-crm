// TOTP enrollment grace page for ADMIN/SUPER_ADMIN users.
//
// Reached only when an admin signs in with a valid password but no TOTP
// configured. The sign-in action issues a short-lived HttpOnly cookie
// (not a URL param) containing a HMAC-signed enrollment token. This page:
//
//   1. Reads + verifies that cookie.
//   2. Looks up the admin user and generates a TOTP secret if none exists.
//   3. Renders a QR code + manual entry key.
//   4. Accepts the 6-digit confirmation code via a server action.
//
// This page is in the public allowlist (no NextAuth session required)
// but is effectively gated by the enrollment cookie.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { encryptForStorage, decryptFromStorage } from "@/lib/crypto";
import {
  generateTotpSecret,
  buildOtpAuthUrl,
  TOTP_ISSUER,
} from "@/lib/totp";
import { SubmitButton } from "@/components/submit-button";
import { verifyEnrollmentToken, ENROLLMENT_COOKIE } from "@/lib/enrollment-token";
import { confirmAdminEnrollmentAction } from "./actions";

export const metadata = { title: "Set up two-factor authentication" };

const ERROR_MESSAGES: Record<string, string> = {
  wrong_code: "That code didn't match — try the latest 6-digit code from your app.",
  invalid_code: "Please enter a 6-digit number.",
  secret_corrupted: "The enrollment data was corrupted. Please sign in again to restart.",
  no_secret: "Enrollment not started — please sign in again.",
  enrollment_expired: "The enrollment link expired. Please sign in again.",
};

export default async function AdminEnrollPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  // ── Verify enrollment cookie ──────────────────────────────────────────
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(ENROLLMENT_COOKIE)?.value ?? "";
  const tokenResult = verifyEnrollmentToken(rawToken, { consume: false });

  if (!tokenResult.ok) {
    // Cookie missing, expired, or tampered — bounce to sign-in.
    redirect("/sign-in?error=enrollment_expired");
  }
  const { email } = tokenResult;

  // ── Look up user ──────────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, name: true, roles: true, totpSecret: true, totpEnabledAt: true },
  });

  if (
    !user ||
    (!user.roles.includes("ADMIN") && !user.roles.includes("SUPER_ADMIN")) ||
    user.totpEnabledAt
  ) {
    redirect("/sign-in");
  }

  // ── Ensure a pending TOTP secret exists ───────────────────────────────
  // Reuse an in-progress secret if present (avoids invalidating a QR
  // the admin already scanned). Generate a fresh one if not.
  let encryptedSecret = user.totpSecret;
  if (!encryptedSecret) {
    const newSecret = generateTotpSecret();
    encryptedSecret = encryptForStorage(newSecret);
    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: encryptedSecret, totpEnabledAt: null },
    });
  }

  // ── Build QR code ─────────────────────────────────────────────────────
  let qrSvg: string;
  let chunkedSecret: string;
  try {
    const secret = decryptFromStorage(encryptedSecret);
    const otpUrl = buildOtpAuthUrl(secret, user.email);
    qrSvg = await QRCode.toString(otpUrl, {
      type: "svg",
      margin: 1,
      width: 224,
      color: { dark: "#1a1624", light: "#ffffff" },
    });
    chunkedSecret = secret.match(/.{1,4}/g)?.join(" ") ?? secret;
  } catch {
    redirect("/sign-in?error=enrollment_expired");
  }

  const errorMsg = sp.error ? (ERROR_MESSAGES[sp.error] ?? "Something went wrong — please sign in again.") : null;

  return (
    <main className="pranic-glow flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        {/* Header */}
        <div className="mb-6 text-center">
          <Link href="/" className="font-serif text-2xl font-medium text-foreground hover:opacity-80">
            Life Energy Centre
          </Link>
          <p className="mt-2 text-sm font-medium text-foreground">
            Set up two-factor authentication
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Admin accounts require an authenticator app. This takes about 1 minute.
          </p>
        </div>

        {/* Step 1: QR code */}
        <div className="mb-5 space-y-3">
          <p className="text-sm font-medium">Step 1 · Scan with your authenticator app</p>
          <p className="text-xs text-muted-foreground">
            Open Google Authenticator, Authy, or 1Password and tap
            &ldquo;Add account&rdquo; → &ldquo;Scan QR code&rdquo;.
          </p>

          <div className="flex justify-center">
            <div
              className="rounded-lg border border-border bg-white p-2"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          </div>

          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Can&apos;t scan? Enter the key manually
            </summary>
            <div className="mt-2 space-y-1 rounded-md bg-muted/50 p-3">
              <p className="font-mono text-xs tracking-wider break-all">{chunkedSecret}</p>
              <p className="text-muted-foreground">Issuer: {TOTP_ISSUER} · Type: Time-based · Digits: 6</p>
            </div>
          </details>
        </div>

        {/* Step 2: Confirm code */}
        <form action={confirmAdminEnrollmentAction} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="code" className="text-sm font-medium">
              Step 2 · Enter the 6-digit code from your app
            </label>
            <input
              id="code"
              name="code"
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

          {errorMsg && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMsg}
            </p>
          )}

          <SubmitButton
            pendingLabel="Verifying…"
            className="h-11 w-full rounded-lg bg-primary font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            Confirm and continue
          </SubmitButton>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link href="/sign-in" className="hover:text-foreground">
            ← Back to sign-in
          </Link>
        </p>
      </div>
    </main>
  );
}
