import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, MessagesSquare, ExternalLink } from "lucide-react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSettingPreview, SETTING_KEYS } from "@/lib/settings";
import { saveWhatsAppAction, testWhatsAppAction, generateVerifyTokenAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "WhatsApp Business" };

export default async function WhatsAppSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; test?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) redirect("/dashboard");
  const sp = await searchParams;

  const [provider, phoneId, token, verifyToken] = await Promise.all([
    getSettingPreview(SETTING_KEYS.whatsappProvider),
    getSettingPreview(SETTING_KEYS.whatsappPhoneId),
    getSettingPreview(SETTING_KEYS.whatsappToken),
    getSettingPreview(SETTING_KEYS.whatsappVerifyToken),
  ]);

  // Build absolute webhook URL from the current request host.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "lec-crm.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const webhookUrl = `${proto}://${host}/api/webhook/whatsapp`;

  const isLive = provider.preview === "meta" && phoneId.isSet && token.isSet;

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Back to settings
      </Link>

      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <MessagesSquare className="h-7 w-7 text-primary" />
          WhatsApp Business
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Connect the centre's official WhatsApp Business number so lead
          welcomes, counselling confirmations, visit reminders, and payment
          links go out automatically.
        </p>
      </header>

      <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs">
        <span className={`inline-block h-2 w-2 rounded-full ${isLive ? "bg-emerald-500" : "bg-amber-500"}`} />
        <span className="font-medium">
          {isLive ? "Live — sending real WhatsApp messages" : "Demo mode — messages logged only, not sent"}
        </span>
      </div>

      {sp.ok && <p className="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-900">Saved.</p>}
      {sp.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}
      {sp.test && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${sp.test.startsWith("ok") ? "bg-emerald-100 text-emerald-900" : "bg-destructive/10 text-destructive"}`}
        >
          {decodeURIComponent(sp.test.replace(/^(ok|err):/, ""))}
        </p>
      )}

      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Step 1 — Set up Meta Business (one-time)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Verify your centre at <a className="text-primary hover:underline" href="https://business.facebook.com" target="_blank" rel="noreferrer">business.facebook.com</a> (PAN / GST / registration doc).</li>
            <li>At <a className="text-primary hover:underline" href="https://developers.facebook.com" target="_blank" rel="noreferrer">developers.facebook.com</a>, create an App → add the WhatsApp Business product.</li>
            <li>Register a new phone number for the API (can&apos;t be used on the regular WhatsApp app at the same time).</li>
            <li>Submit the message templates for approval — you&apos;ll find them in the admin&apos;s <em>Settings → Templates</em> section (each is a UTILITY template, approval is usually 24 hours).</li>
            <li>In System Users, generate a <strong>permanent access token</strong> with <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code> scopes.</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Full Meta documentation:{" "}
            <a className="text-primary hover:underline" href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noreferrer">
              Cloud API — Get Started <ExternalLink className="inline h-3 w-3" />
            </a>
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Step 2 — Point Meta to this app&apos;s webhook
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            In the Meta App → WhatsApp → Configuration, paste the URL and Verify Token below.
            Subscribe to fields: <code>messages</code>, <code>message_status</code>.
          </p>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Webhook URL</p>
            <code className="block rounded-md bg-muted px-3 py-2 text-xs">{webhookUrl}</code>
          </div>

          <form action={generateVerifyTokenAction} className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Verify Token</p>
              <code className="block rounded-md bg-muted px-3 py-2 text-xs">
                {verifyToken.isSet ? verifyToken.preview : "(not set — click Generate)"}
              </code>
            </div>
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
            >
              Generate new
            </button>
          </form>
          <p className="text-[11px] text-muted-foreground">
            Same Verify Token is entered in Meta&apos;s dashboard. Regenerating it means you need to
            update Meta&apos;s configuration too.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Step 3 — Paste your credentials + go live
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveWhatsAppAction} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="provider" className="text-sm font-medium">Mode</label>
              <select id="provider" name="provider" defaultValue={provider.preview || "stub"} className={inputCls}>
                <option value="stub">Demo (don&apos;t send real messages)</option>
                <option value="meta">Live (send via Meta Cloud API)</option>
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="phoneNumberId" className="text-sm font-medium">Phone Number ID</label>
                <input
                  id="phoneNumberId"
                  name="phoneNumberId"
                  placeholder={phoneId.isSet ? phoneId.preview : "e.g. 123456789012345"}
                  className={inputCls}
                />
                <p className="text-[11px] text-muted-foreground">
                  Find in Meta → WhatsApp → API Setup.
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="accessToken" className="text-sm font-medium">Permanent Access Token</label>
                <input
                  id="accessToken"
                  name="accessToken"
                  type="password"
                  placeholder={token.isSet ? token.preview : "EAAxxxx…"}
                  className={inputCls}
                  autoComplete="off"
                />
                <p className="text-[11px] text-muted-foreground">
                  Leave blank to keep the existing token.
                </p>
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
                formAction={testWhatsAppAction}
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
