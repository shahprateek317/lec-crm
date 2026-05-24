// /me — client portal dashboard.
//
// Phase 1b scope: identity card + upcoming-session widget + credit balance
// + referrals teaser + privacy controls (sign out, delete account).
// Sessions list / referral page / messages thread are Phase 1c.

import Link from "next/link";
import { format } from "date-fns";
import {
  CalendarHeart,
  Coins,
  Gift,
  LogOut,
  Shield,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { requireClient } from "@/lib/me-session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { signOutAction, signOutAllAction, requestAccountDeletionAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your portal · Life Energy Centre" };

export default async function MeDashboardPage() {
  const client = await requireClient("/me");

  // Pull the snapshot data the dashboard needs in a single round-trip.
  const [creditBalance, nextSession, referralCount] = await Promise.all([
    creditBalanceFor(client.id),
    prisma.healingSession.findFirst({
      where: { clientId: client.id, date: { gte: new Date() } },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        mode: true,
        healer: { select: { name: true } },
      },
    }),
    prisma.client.count({
      where: { referrerClientId: client.id, deletedAt: null },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Namaste</p>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground">
          {client.name.split(" ")[0]} 🙏
        </h1>
      </header>

      {/* Next session */}
      <Card className="rounded-2xl border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
            <CalendarHeart className="h-3.5 w-3.5" />
            Your next session
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-1">
          {nextSession ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-medium text-foreground">
                  {format(nextSession.date, "EEEE, d MMM · h:mm a")}
                </p>
                <p className="text-sm text-muted-foreground">
                  with {nextSession.healer.name} ·{" "}
                  {nextSession.mode === "IN_PERSON" ? "in person" : "distant"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No upcoming sessions. The centre will be in touch over WhatsApp
              when your next slot opens.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-full bg-amber-100 p-2 text-amber-900">
              <Coins className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Healing credits
              </p>
              <p className="text-2xl font-medium text-foreground">{creditBalance}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-full bg-rose-100 p-2 text-rose-900">
              <Gift className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Friends referred
              </p>
              <p className="text-2xl font-medium text-foreground">
                {referralCount}
                {client.healingCreditsEarned > 0 && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({client.healingCreditsEarned} credits earned)
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coming soon teasers — these turn into live pages in Phase 1c. */}
      <Card className="rounded-2xl">
        <CardContent className="divide-y divide-border py-1">
          <RowLink
            href="/me/sessions"
            icon={<Sparkles className="h-4 w-4 text-primary" />}
            label="Past sessions"
          />
          <RowLink
            href="/me/refer"
            icon={<Gift className="h-4 w-4 text-rose-700" />}
            label="Refer a friend"
          />
          <RowLink
            href="/me/messages"
            icon={<CalendarHeart className="h-4 w-4 text-emerald-700" />}
            label="Messages with the centre"
          />
        </CardContent>
      </Card>

      {/* Privacy + account controls */}
      <Card className="rounded-2xl border-muted bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            Your account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-1 text-sm">
          <p className="text-muted-foreground">
            Signed in as <strong className="text-foreground">{client.phone}</strong>
          </p>
          <div className="flex flex-wrap gap-2">
            <form action={signOutAction}>
              <SubmitButton
                pendingLabel="Signing out…"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </SubmitButton>
            </form>
            <form action={signOutAllAction}>
              <SubmitButton
                pendingLabel="Signing out everywhere…"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
              >
                Sign out of all devices
              </SubmitButton>
            </form>
          </div>

          <details className="pt-2 text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Delete my account
            </summary>
            <div className="mt-3 space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <p className="text-foreground">
                Deletes your personal details from the portal. Your healing
                history is retained anonymously for centre records. You can
                cancel within 30 days by contacting the centre.
              </p>
              <form action={requestAccountDeletionAction}>
                <SubmitButton
                  pendingLabel="Deleting…"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-destructive px-3 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
                >
                  I understand — delete my account
                </SubmitButton>
              </form>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

function RowLink({
  href,
  icon,
  label,
  comingSoon,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  comingSoon?: boolean;
}) {
  const inner = (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      {comingSoon ? (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Soon
        </span>
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
  return comingSoon ? <div>{inner}</div> : <Link href={href}>{inner}</Link>;
}

/** Sum of CreditLedgerEntry.delta for the client. Cheap query — no need
 *  for a denormalised balance column yet. */
async function creditBalanceFor(clientId: string): Promise<number> {
  const rows = await prisma.creditLedgerEntry.findMany({
    where: { clientId },
    select: { delta: true },
  });
  return rows.reduce((sum, r) => sum + r.delta, 0);
}
