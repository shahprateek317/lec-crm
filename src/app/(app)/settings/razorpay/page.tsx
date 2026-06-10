import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Wallet, ExternalLink } from "lucide-react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlashToaster } from "@/components/flash-toaster";
import { getSettingPreview, SETTING_KEYS } from "@/lib/settings";
import { saveRazorpayAction, testRazorpayAction, regenerateWebhookSecretAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Razorpay" };

export default async function RazorpaySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; test?: string; newsecret?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) redirect("/dashboard");
  const sp = await searchParams;

  const [provider, keyId, keySecret, webhookSecret] = await Promise.all([
    getSettingPreview(SETTING_KEYS.razorpayProvider),
    getSettingPreview(SETTING_KEYS.razorpayKeyId),
    getSettingPreview(SETTING_KEYS.razorpayKeySecret),
    getSettingPreview(SETTING_KEYS.razorpayWebhookSecret),
  ]);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "lec-crm.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const webhookUrl = `${proto}://${host}/api/webhook/razorpay`;

  const isLive = provider.preview === "razorpay" && keyId.isSet && keySecret.isSet;
  const mode = keyId.isSet && keyId.preview.startsWith("rzp_test_") ? "TEST" : keyId.isSet ? "LIVE" : null;

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Back to settings
      </Link>

      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <Wallet className="h-7 w-7 text-primary" />
          Razorpay
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Connect Razorpay so payment links for healing packages and course
          fees are generated automatically and credits are granted the moment
          a client pays.
        </p>
      </header>

      <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs">
        <span className={`inline-block h-2 w-2 rounded-full ${isLive ? "bg-emerald-500" : "bg-amber-500"}`} />
        <span className="font-medium">
          {isLive ? `Live — ${mode} mode` : "Demo mode — no real payments"}
        </span>
      </div>

      <FlashToaster />

      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Step 1 — Create Razorpay account (one-time)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Sign up at <a className="text-primary hover:underline" href="https://razorpay.com" target="_blank" rel="noreferrer">razorpay.com</a> with the centre&apos;s bank account and PAN.</li>
            <li>Complete KYC — PAN, bank proof, business proof. Usually activated within 3–7 business days.</li>
            <li>Enable <strong>Payment Links</strong> in Dashboard → Products → Payment Links.</li>
            <li>Grab your Key ID and Key Secret from Dashboard → Settings → API Keys.</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            You can test everything in <strong>Test mode</strong> before switching to live.{" "}
            <a className="text-primary hover:underline" href="https://razorpay.com/docs/api/payments/payment-links/" target="_blank" rel="noreferrer">
              Payment Links docs <ExternalLink className="inline h-3 w-3" />
            </a>
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Step 2 — Configure the webhook in Razorpay
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Dashboard → Settings → Webhooks → Add new. Subscribe to events:{" "}
            <code>payment_link.paid</code>, <code>payment.captured</code>, <code>payment.failed</code>.
          </p>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Webhook URL</p>
            <code className="block rounded-md bg-muted px-3 py-2 text-xs">{webhookUrl}</code>
          </div>

          <form action={regenerateWebhookSecretAction} className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Webhook Secret</p>
              <code className="block rounded-md bg-muted px-3 py-2 text-xs">
                {webhookSecret.isSet ? webhookSecret.preview : "(not set)"}
              </code>
            </div>
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
            >
              Generate new
            </button>
          </form>
          {sp.newsecret && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
              <p className="mb-1 text-xs font-semibold text-amber-900 dark:text-amber-200">
                Copy this secret now — it will not be shown again
              </p>
              <code className="block break-all text-xs font-mono text-amber-800 dark:text-amber-300 select-all">
                {sp.newsecret}
              </code>
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                Paste this into Razorpay → Settings → Webhooks → Secret field.
              </p>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Paste the same secret in Razorpay&apos;s webhook form.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Step 3 — Paste your API keys + go live
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveRazorpayAction} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="provider" className="text-sm font-medium">Mode</label>
              <select id="provider" name="provider" defaultValue={provider.preview || "stub"} className={inputCls}>
                <option value="stub">Demo (no real payments)</option>
                <option value="razorpay">Razorpay (test or live keys)</option>
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="keyId" className="text-sm font-medium">Key ID</label>
                <input
                  id="keyId"
                  name="keyId"
                  placeholder={keyId.isSet ? keyId.preview : "rzp_test_… or rzp_live_…"}
                  className={inputCls}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="keySecret" className="text-sm font-medium">Key Secret</label>
                <input
                  id="keySecret"
                  name="keySecret"
                  type="password"
                  placeholder={keySecret.isSet ? keySecret.preview : "••••••"}
                  className={inputCls}
                  autoComplete="off"
                />
                <p className="text-[11px] text-muted-foreground">Leave blank to keep existing.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Save
              </button>
              <button
                type="submit"
                formAction={testRazorpayAction}
                className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted"
              >
                Test connection
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

const inputCls =
  "flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
