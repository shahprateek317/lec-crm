// /settings/security — TOTP 2FA enrollment + management.
//
// One page, three states (driven by the DB row, not URL state):
//   - off:     "Set up 2FA" CTA
//   - pending: QR code + manual-key + 6-digit verify input
//   - active:  status badge + "Disable 2FA" form (requires a code)
//
// The QR is server-rendered as an inline SVG via the `qrcode` package
// so we don't ship a client-side QR library or leak the secret to a
// CDN. Format is the standard `otpauth://totp/...` URI that every
// authenticator app understands.

import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import QRCode from "qrcode";
import { Shield, ShieldCheck, ShieldOff, AlertCircle, CheckCircle, ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptFromStorage } from "@/lib/crypto";
import { buildOtpAuthUrl, TOTP_ISSUER } from "@/lib/totp";
import { remainingBackupCodeCount, WARN_THRESHOLD } from "@/lib/backup-codes";
import { Card, CardContent } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import {
  startTotpEnrollmentAction,
  confirmTotpEnrollmentAction,
  cancelTotpEnrollmentAction,
  disableTotpAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Security · Settings" };

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string; ok?: string; codes?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?callbackUrl=/settings/security");
  const sp = await searchParams;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, totpSecret: true, totpEnabledAt: true },
  });
  if (!user) redirect("/sign-in?callbackUrl=/settings/security");

  // Parse one-time backup codes passed from the enrollment action.
  let newBackupCodes: string[] | null = null;
  if (sp.codes) {
    try {
      newBackupCodes = JSON.parse(Buffer.from(sp.codes, "base64url").toString("utf8")) as string[];
    } catch { /* ignore malformed param */ }
  }

  // Count remaining backup codes for the low-codes warning.
  const remainingCodes = user.totpEnabledAt
    ? await remainingBackupCodeCount(user.id)
    : null;

  const state: "off" | "pending" | "active" = user.totpEnabledAt
    ? "active"
    : user.totpSecret
    ? "pending"
    : "off";

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3 w-3" />
          Settings
        </Link>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <Shield className="h-7 w-7 text-primary" />
          Security
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Two-factor authentication adds a 6-digit code from an
          authenticator app (Google Authenticator, Authy, 1Password,
          Microsoft Authenticator, etc.) on top of your password. We
          strongly recommend enabling it on every staff account, and it
          will be required for ADMIN accounts in a future release.
        </p>
      </header>

      {sp.ok === "enabled" && !newBackupCodes && <Banner kind="success">Two-factor authentication is now active.</Banner>}
      {sp.ok === "disabled" && <Banner kind="success">Two-factor authentication has been disabled.</Banner>}
      {sp.error === "wrong_code" && <Banner kind="error">That code didn&apos;t match. Try again with the latest 6-digit code.</Banner>}
      {sp.error === "invalid_code" && <Banner kind="error">Please enter the 6-digit code from your authenticator app.</Banner>}
      {sp.error === "secret_corrupted" && <Banner kind="error">The stored secret couldn&apos;t be read. Ask an admin to reset your 2FA.</Banner>}
      {sp.error === "already_active" && <Banner kind="error">2FA is already active. Disable it first if you want to re-enroll.</Banner>}
      {sp.error === "disable_needs_code" && <Banner kind="error">Enter a code to confirm you can still produce one before we disable 2FA.</Banner>}

      {state === "off" && <OffCard />}
      {state === "pending" && (
        <PendingCard userEmail={user.email} encryptedSecret={user.totpSecret!} />
      )}
      {/* One-time backup codes display (shown immediately after enrollment) */}
      {newBackupCodes && (
        <Card className="rounded-2xl border-emerald-200 bg-emerald-50/60">
          <CardContent className="space-y-4 py-5">
            <div>
              <p className="flex items-center gap-2 font-medium text-emerald-900">
                <CheckCircle className="h-4 w-4" />
                Two-factor authentication is now active
              </p>
              <p className="mt-1 text-sm text-emerald-800">
                Save these 10 backup codes somewhere safe (password manager,
                printed paper). Each can be used <strong>once</strong> to sign
                in if you lose your phone. They won&apos;t be shown again.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-emerald-200 bg-white p-3 font-mono text-sm sm:grid-cols-5">
              {newBackupCodes.map((code) => (
                <span key={code} className="text-center tracking-wider text-foreground">
                  {code}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Low backup codes warning */}
      {remainingCodes !== null && remainingCodes <= WARN_THRESHOLD && !newBackupCodes && (
        <Banner kind="error">
          You only have {remainingCodes} backup code{remainingCodes === 1 ? "" : "s"} left.
          {" "}Generate new backup codes from the Security settings — old ones will be invalidated.
        </Banner>
      )}

      {state === "active" && user.totpEnabledAt && (
        <ActiveCard enabledAt={user.totpEnabledAt} remainingCodes={remainingCodes} />
      )}
    </div>
  );
}

// ── State: 2FA off ───────────────────────────────────────────────────

function OffCard() {
  return (
    <Card className="rounded-2xl border-amber-200 bg-amber-50/60">
      <CardContent className="space-y-3 py-5">
        <div className="flex items-start gap-3">
          <ShieldOff className="mt-0.5 h-5 w-5 text-amber-700" />
          <div>
            <p className="font-medium text-amber-900">Two-factor is off</p>
            <p className="text-sm text-amber-900/80">
              Your account is protected only by your password.
            </p>
          </div>
        </div>
        <form action={startTotpEnrollmentAction}>
          <SubmitButton
            pendingLabel="Setting up…"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:bg-foreground/90"
          >
            <Shield className="h-3.5 w-3.5" />
            Set up two-factor
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

// ── State: pending enrollment (secret set, not yet verified) ─────────

async function PendingCard({
  userEmail,
  encryptedSecret,
}: {
  userEmail: string;
  encryptedSecret: string;
}) {
  // Decrypt server-side so we never send the ciphertext to the
  // browser. The plaintext secret leaves this server only as part of
  // the QR code SVG (which is itself just the otpauth:// URI rendered
  // as an image).
  let secret: string;
  try {
    secret = decryptFromStorage(encryptedSecret);
  } catch {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-6 text-center text-sm text-destructive">
          The stored secret couldn&apos;t be read. Cancel + restart enrollment.
          <form action={cancelTotpEnrollmentAction} className="mt-3">
            <SubmitButton
              pendingLabel="Cancelling…"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
            >
              Cancel enrollment
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    );
  }

  const otpUrl = buildOtpAuthUrl(secret, userEmail);
  // Inline SVG QR. Small (256x256) + scalable, no JS dependency.
  const qrSvg = await QRCode.toString(otpUrl, {
    type: "svg",
    margin: 1,
    width: 224,
    color: { dark: "#1a1624", light: "#ffffff" },
  });

  // Manual-entry friendly chunked secret: "ABCD EFGH IJKL MNOP" so
  // users typing it into an app on another device can keep their place.
  const chunkedSecret = secret.match(/.{1,4}/g)?.join(" ") ?? secret;

  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-5 py-6">
        <div className="space-y-1">
          <p className="text-sm font-medium">Step 1 · Scan with your authenticator app</p>
          <p className="text-xs text-muted-foreground">
            Open Google Authenticator / Authy / 1Password / etc. and tap
            &ldquo;Add account&rdquo; → &ldquo;Scan QR code&rdquo;.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div
            className="shrink-0 rounded-lg border border-border bg-white p-2"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <div className="space-y-2 text-sm">
            <div>
              <p className="font-medium">Issuer</p>
              <p className="text-muted-foreground">{TOTP_ISSUER}</p>
            </div>
            <div>
              <p className="font-medium">Account</p>
              <p className="text-muted-foreground">{userEmail}</p>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Can&apos;t scan? Show secret to enter manually
              </summary>
              <code className="mt-1 block break-all rounded bg-muted p-2 font-mono text-[11px]">
                {chunkedSecret}
              </code>
            </details>
          </div>
        </div>

        <div className="space-y-2 border-t border-border pt-5">
          <p className="text-sm font-medium">Step 2 · Enter the current 6-digit code</p>
          <form action={confirmTotpEnrollmentAction} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <input
                type="text"
                name="code"
                inputMode="numeric"
                pattern="[0-9 ]*"
                autoComplete="one-time-code"
                autoFocus
                maxLength={7}
                required
                placeholder="123 456"
                className="h-11 w-36 rounded-lg border border-input bg-transparent px-3 text-center font-mono text-lg tracking-widest outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <SubmitButton
              pendingLabel="Verifying…"
              className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90"
            >
              <ShieldCheck className="h-4 w-4" />
              Verify + activate
            </SubmitButton>
            <form action={cancelTotpEnrollmentAction}>
              <SubmitButton
                pendingLabel="Cancelling…"
                className="inline-flex h-11 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </SubmitButton>
            </form>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

// ── State: 2FA active ────────────────────────────────────────────────

function ActiveCard({ enabledAt, remainingCodes }: { enabledAt: Date; remainingCodes: number | null }) {
  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-emerald-200 bg-emerald-50/60">
        <CardContent className="flex items-start gap-3 py-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" />
          <div className="space-y-1">
            <p className="font-medium text-emerald-900">Two-factor is active</p>
            <p className="text-sm text-emerald-900/80">
              Enabled on {format(enabledAt, "d MMM yyyy")}. You&apos;ll
              be asked for a 6-digit code from your authenticator app
              every time you sign in.
            </p>
            {remainingCodes !== null && (
              <p className={`text-xs ${remainingCodes <= WARN_THRESHOLD ? "font-medium text-destructive" : "text-emerald-900/70"}`}>
                {remainingCodes} backup code{remainingCodes !== 1 ? "s" : ""} remaining
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-destructive/30">
        <CardContent className="space-y-3 py-5">
          <div className="space-y-1">
            <p className="font-medium">Disable two-factor</p>
            <p className="text-sm text-muted-foreground">
              Enter your current 6-digit code to confirm you still have
              access to your authenticator before we turn it off.
            </p>
          </div>
          <form action={disableTotpAction} className="flex flex-wrap items-end gap-3">
            <input
              type="text"
              name="code"
              inputMode="numeric"
              pattern="[0-9 ]*"
              autoComplete="one-time-code"
              maxLength={7}
              required
              placeholder="123 456"
              className="h-11 w-36 rounded-lg border border-input bg-transparent px-3 text-center font-mono text-lg tracking-widest outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <SubmitButton
              pendingLabel="Disabling…"
              className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              <ShieldOff className="h-4 w-4" />
              Disable 2FA
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Shared banner ───────────────────────────────────────────────────

function Banner({ kind, children }: { kind: "success" | "error"; children: React.ReactNode }) {
  const Icon = kind === "success" ? CheckCircle : AlertCircle;
  return (
    <div
      className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
        kind === "success"
          ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200"
          : "bg-destructive/10 text-destructive ring-1 ring-destructive/20"
      }`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
