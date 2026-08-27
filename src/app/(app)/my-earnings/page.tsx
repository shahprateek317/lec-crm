// /my-earnings — healer-only earnings dashboard.
//
// Read-only view computed from HealingSession (where healerId = me) +
// HealerProfile (perSessionCharge, revenueSharePercent, acceptsDemoFree).
// The math lives in src/lib/earnings.ts so this page, an admin payroll
// export (future), and any audit query all agree on the formula.
//
// Buckets shown: this month / last month / this year / lifetime.
// Below that: a table of the most recent 30 completed sessions with
// per-session earnings and the client + session-type breakdown.
//
// Earnings are advisory until payouts are tracked (Phase 2c — see
// HANDOVER §17). The number on screen is what payroll *should* pay,
// not what's been paid out yet.

import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Wallet, TrendingUp, AlertCircle } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { bucketEarnings, computeSessionEarning, type EarningsProfile } from "@/lib/earnings";
import { computePendingPeriods, periodLabel } from "@/lib/payout";
import { CheckCircle2, Clock } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "My earnings · LEC CRM" };

const HEALER_ROLES = new Set(["HEALER", "SENIOR_HEALER"]);

function inr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default async function MyEarningsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?callbackUrl=/my-earnings");
  if (!session.user.roles.some(r => HEALER_ROLES.has(r))) redirect("/dashboard");

  const [profile, sessions, payouts] = await Promise.all([
    prisma.healerProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        perSessionCharge: true,
        revenueSharePercent: true,
        acceptsDemoFree: true,
      },
    }),
    // Past sessions. Order desc for the table; the bucketer doesn't care.
    prisma.healingSession.findMany({
      where: { healerId: session.user.id },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        sessionType: true,
        endedAt: true,
        mode: true,
        client: { select: { name: true } },
      },
    }),
    prisma.healerPayout.findMany({
      where: { healerId: session.user.id },
      orderBy: { period: "desc" },
      select: { id: true, period: true, gross: true, deductions: true, net: true, paidAt: true, paymentRef: true },
    }),
  ]);

  // If the profile isn't configured we can still render — buckets will
  // be 0 and we explain why in a banner.
  const earningsProfile: EarningsProfile = {
    perSessionCharge: profile?.perSessionCharge ?? null,
    revenueSharePercent: profile?.revenueSharePercent ?? null,
    acceptsDemoFree: profile?.acceptsDemoFree ?? true,
  };

  const buckets = bucketEarnings(earningsProfile, sessions);
  const pendingPeriods = computePendingPeriods(earningsProfile, sessions, payouts);

  const profileConfigured =
    (earningsProfile.perSessionCharge ?? 0) > 0 &&
    (earningsProfile.revenueSharePercent ?? 0) > 0;

  const recent = sessions.slice(0, 30);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <Wallet className="h-7 w-7 text-primary" />
          My earnings
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Computed from completed healing sessions and your profile&apos;s
          per-session fee × revenue-share. Advisory — payouts are tracked
          separately by the centre&apos;s accountant.
        </p>
      </header>

      {!profileConfigured && (
        <Card className="rounded-xl border-amber-200 bg-amber-50/60">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="text-sm">
              <p className="font-medium text-amber-900">Your fee + share aren&apos;t set yet</p>
              <p className="mt-0.5 text-amber-900/80">
                Earnings will read as ₹0 until an admin sets your
                <em> per-session charge</em> and <em>revenue-share %</em> in
                the staff settings. Reach out to the centre admin to
                configure these.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Buckets. `Last year` only surfaces when non-zero so the grid
          doesn't waste a column most of the year. The Jan-1 edge case
          where Dec 31 earnings live ONLY in lastYear is exactly when
          we want it visible. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BucketCard label="This month" value={buckets.thisMonth} />
        <BucketCard label="Last month" value={buckets.lastMonth} />
        <BucketCard label="This year"  value={buckets.thisYear} />
        <BucketCard label="Lifetime"   value={buckets.lifetime} highlight />
      </div>
      {buckets.lastYear > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <BucketCard label="Last year" value={buckets.lastYear} />
        </div>
      )}

      {/* Payout status */}
      {(payouts.length > 0 || pendingPeriods.length > 0) && (
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Payout status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4">
            {pendingPeriods.map((p) => (
              <div key={p.period} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-amber-900">
                  <Clock className="h-3.5 w-3.5" />
                  {p.label} — pending payment
                </span>
                <span className="font-medium tabular-nums text-amber-900">
                  {inr(p.pending)}
                  {p.paid > 0 && <span className="ml-1 text-xs font-normal text-amber-700">({inr(p.paid)} paid)</span>}
                </span>
              </div>
            ))}
            {payouts.map((p) => {
              const isPending = pendingPeriods.some((pp) => pp.period === p.period);
              if (isPending) return null; // already shown above
              return (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 text-emerald-900">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {periodLabel(p.period)} — paid
                    {p.paymentRef && <span className="text-xs text-emerald-700">· ref: {p.paymentRef}</span>}
                  </span>
                  <span className="font-medium tabular-nums text-emerald-900">{inr(p.net)}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Per-session breakdown */}
      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Recent sessions
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              (last {recent.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 py-2">
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No sessions yet. Once you log one, it&apos;ll appear here.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-medium">Date</th>
                  <th className="px-2 py-2 font-medium">Client</th>
                  <th className="px-2 py-2 font-medium">Type</th>
                  <th className="px-2 py-2 font-medium">Mode</th>
                  <th className="px-2 py-2 text-right font-medium">Earning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recent.map((s) => {
                  const earning = computeSessionEarning(earningsProfile, s);
                  const isUnpaid =
                    s.sessionType === "DEMO" && earningsProfile.acceptsDemoFree;
                  const isPending = !s.endedAt;
                  return (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {format(s.date, "d MMM yyyy")}
                      </td>
                      <td className="px-2 py-2">
                        <Link href={`/healing/${s.id}`} className="text-sm hover:underline">
                          {s.client.name}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {s.sessionType}
                      </td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {s.mode === "IN_PERSON" ? "in person" : "distant"}
                      </td>
                      <td className="px-2 py-2 text-right text-sm">
                        {isPending ? (
                          <span className="text-xs text-muted-foreground">pending</span>
                        ) : isUnpaid ? (
                          <span className="text-xs text-muted-foreground">free demo</span>
                        ) : (
                          <span className="font-medium tabular-nums">{inr(earning)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {profileConfigured && (
        <p className="text-center text-[11px] text-muted-foreground/70">
          Formula: ₹{earningsProfile.perSessionCharge!.toLocaleString("en-IN")}
          {" × "}
          {earningsProfile.revenueSharePercent}% per completed session.
          {earningsProfile.acceptsDemoFree && " Demo sessions are free."}
        </p>
      )}
    </div>
  );
}

function BucketCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card className={`rounded-xl ${highlight ? "border-primary/30 bg-primary/5" : ""}`}>
      <CardContent className="py-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-medium tabular-nums text-foreground">
          ₹{value.toLocaleString("en-IN")}
        </p>
      </CardContent>
    </Card>
  );
}
