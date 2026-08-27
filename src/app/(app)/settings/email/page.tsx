import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Mail } from "lucide-react";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlashToaster } from "@/components/flash-toaster";
import { getSettingPreview, SETTING_KEYS } from "@/lib/settings";
import { SubmitButton } from "@/components/submit-button";
import { saveEmailSettingsAction, testEmailAction, clearEmailSettingsAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email settings" };

export default async function EmailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.roles)) redirect("/dashboard");
  await searchParams;

  const [provider, apiKey, fromAddress] = await Promise.all([
    getSettingPreview(SETTING_KEYS.emailProvider),
    getSettingPreview(SETTING_KEYS.emailApiKey),
    getSettingPreview(SETTING_KEYS.emailFromAddress),
  ]);

  const isLive = provider.preview === "resend" && apiKey.isSet && fromAddress.isSet;

  return (
    <div className="space-y-6">
      <FlashToaster />
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Back to settings
      </Link>

      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <Mail className="h-7 w-7 text-primary" />
          Email (daily digest)
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Connect Resend to send each staff member a morning summary of their unread
          notifications at 08:00 IST. In demo mode the digest is logged but not sent.
        </p>
      </header>

      <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs">
        <span className={`h-2 w-2 rounded-full ${isLive ? "bg-emerald-500" : "bg-amber-400"}`} />
        {isLive ? "Live â€” sending via Resend" : "Demo mode â€” emails logged, not sent"}
      </div>

      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveEmailSettingsAction} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Provider</label>
              <select name="provider" defaultValue={provider.preview || "stub"}
                className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="stub">Demo (log only)</option>
                <option value="resend">Resend</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Resend API key</label>
              <input name="apiKey" type="password" autoComplete="off"
                placeholder={apiKey.isSet ? apiKey.preview : "re_..."}
                className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Get yours at <a href="https://resend.com/api-keys" target="_blank" rel="noopener" className="underline">resend.com/api-keys</a>.
                Leave blank to keep the existing key.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">From address</label>
              <input name="fromAddress" type="text"
                placeholder={fromAddress.isSet ? fromAddress.preview : "Life Energy Centre <hello@lifeenergycentre.in>"}
                className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Must be a verified sender in your Resend account. Format: <code>Name &lt;email&gt;</code>
              </p>
            </div>

            <SubmitButton className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90">Save settings</SubmitButton>
          </form>
        </CardContent>
      </Card>

      {apiKey.isSet && (
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Test send</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <form action={testEmailAction}>
              <SubmitButton className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted">Send test to my email</SubmitButton>
            </form>
            <form action={clearEmailSettingsAction}>
              <SubmitButton className="inline-flex h-8 items-center px-3 text-xs font-medium text-destructive hover:underline">
                Clear credentials
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl bg-muted/40">
        <CardContent className="py-4 text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">How it works</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Every day at <strong>08:00 IST</strong> (02:30 UTC) the server emails each active staff member.</li>
            <li>Only users with unread notifications receive a digest â€” no email is sent if there's nothing new.</li>
            <li>After sending, those notifications are marked read so the next digest is fresh.</li>
            <li>Staff can opt out of individual notification types at <Link href="/settings/notifications" className="underline">Settings â†’ Notifications</Link>.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
