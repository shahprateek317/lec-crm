import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft, IndianRupee, Plus, Trash2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlashToaster } from "@/components/flash-toaster";
import { currentPeriod, periodLabel, computePendingPeriods, type PendingPeriod } from "@/lib/payout";
import { bucketEarnings, type EarningsProfile } from "@/lib/earnings";
import { Prisma } from "@prisma/client";
import { recordPayoutAction, deletePayoutAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Healer payouts · Settings" };

function inr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

const HEALER_ROLES: Prisma.EnumRoleFilter["in"] = ["HEALER", "SENIOR_HEALER"];

// Typed select so Prisma infers the result shape correctly.
const healerSelect = {
  id: true,
  name: true,
  role: true,
  healerProfile: {
    select: { perSessionCharge: true, revenueSharePercent: true, acceptsDemoFree: true },
  },
  healerPayouts: {
    orderBy: { period: "desc" as const },
    select: { id: true, period: true, gross: true, deductions: true, net: true, paidAt: true, paymentRef: true, notes: true },
  },
  healingSessions: {
    select: { date: true, sessionType: true, endedAt: true },
  },
} satisfies Prisma.UserSelect;

type HealerRow = Prisma.UserGetPayload<{ select: typeof healerSelect }>;

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ healer?: string; error?: string; ok?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) redirect("/dashboard");

  const sp = await searchParams;
  const selectedHealerId = sp.healer;

  // Load all active healers with their profiles and payouts
  const healers: HealerRow[] = await prisma.user.findMany({
    where: { role: { in: HEALER_ROLES }, active: true },
    orderBy: { name: "asc" },
    select: healerSelect,
  });

  const today = new Date();
  const thisPeriod = currentPeriod(today);

  const healerRows = healers.map((h) => {
    const profile: EarningsProfile = {
      perSessionCharge:    h.healerProfile?.perSessionCharge ?? null,
      revenueSharePercent: h.healerProfile?.revenueSharePercent ?? null,
      acceptsDemoFree:     h.healerProfile?.acceptsDemoFree ?? true,
    };
    const sessions = h.healingSessions.map((s) => ({
      ...s,
      date: new Date(s.date),
      endedAt: s.endedAt ? new Date(s.endedAt) : null,
    }));
    const buckets = bucketEarnings(profile, sessions, today);
    const pending = computePendingPeriods(profile, sessions, h.healerPayouts);
    const thisMonthPayout = h.healerPayouts.find((p) => p.period === thisPeriod);
    return { ...h, profile, buckets, pending, thisMonthPayout };
  });

  const selected = selectedHealerId
    ? healerRows.find((h) => h.id === selectedHealerId)
    : null;

  return (
    <div className="space-y-6">
      <FlashToaster />
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Back to settings
      </Link>

      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <IndianRupee className="h-7 w-7 text-primary" />
          Healer payouts
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record actual payments made to healers. Earnings are computed from sessions; payouts track what&apos;s been disbursed.
        </p>
      </header>

      {/* Healer summary table */}
      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">This month — {periodLabel(thisPeriod)}</CardTitle>
        </CardHeader>
        <CardContent className="px-2 py-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Healer</th>
                <th className="px-3 py-2 font-medium text-right">Earned (this month)</th>
                <th className="px-3 py-2 font-medium text-right">Paid out</th>
                <th className="px-3 py-2 font-medium text-right">Pending</th>
                <th className="px-3 py-2 font-medium text-right">Total pending periods</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {healerRows.map((h) => {
                const paidThisMonth = h.thisMonthPayout?.net ?? 0;
                const pendingThisMonth = Math.max(0, h.buckets.thisMonth - paidThisMonth);
                const totalPending = h.pending.reduce((s, p) => s + p.pending, 0);
                return (
                  <tr key={h.id} className="hover:bg-muted/30">
                    <td className="px-3 py-3">
                      <p className="font-medium">{h.name}</p>
                      <p className="text-[11px] text-muted-foreground">{h.role === "SENIOR_HEALER" ? "Senior healer" : "Healer"}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{inr(h.buckets.thisMonth)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {h.thisMonthPayout
                        ? <span className="text-emerald-700 font-medium">{inr(h.thisMonthPayout.net)}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {pendingThisMonth > 0
                        ? <span className="font-medium text-amber-700">{inr(pendingThisMonth)}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {totalPending > 0
                        ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                            {h.pending.length} period{h.pending.length !== 1 ? "s" : ""} · {inr(totalPending)}
                          </span>
                        : <span className="text-muted-foreground text-xs">up to date</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link href={`/settings/payouts?healer=${h.id}`}>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          <Plus className="mr-1 h-3 w-3" />
                          Record
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {healerRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No active healers. Add a healer in <Link href="/settings/users" className="underline">Staff accounts</Link>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Record payout panel — shown when a healer is selected */}
      {selected && (
        <Card className="rounded-xl border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Record payout for {selected.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={recordPayoutAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <input type="hidden" name="healerId" value={selected.id} />

              <div className="space-y-1">
                <label htmlFor="period" className="text-xs font-medium text-muted-foreground">Period</label>
                <select id="period" name="period" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {/* Current month + last 5 months */}
                  {Array.from({ length: 6 }, (_, i) => {
                    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                    const p = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                    return <option key={p} value={p}>{periodLabel(p)}</option>;
                  })}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="gross" className="text-xs font-medium text-muted-foreground">
                  Gross earnings (₹)
                  {selected.buckets.thisMonth > 0 && (
                    <span className="ml-1 text-primary">(this month: {inr(selected.buckets.thisMonth)})</span>
                  )}
                </label>
                <input
                  id="gross" name="gross" type="number" min="0" step="1"
                  defaultValue={selected.buckets.thisMonth}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="deductions" className="text-xs font-medium text-muted-foreground">Deductions (₹)</label>
                <input
                  id="deductions" name="deductions" type="number" min="0" step="1" defaultValue={0}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="paidAt" className="text-xs font-medium text-muted-foreground">Payment date</label>
                <input
                  id="paidAt" name="paidAt" type="date"
                  defaultValue={format(today, "yyyy-MM-dd")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="paymentRef" className="text-xs font-medium text-muted-foreground">Payment reference (UPI / NEFT)</label>
                <input
                  id="paymentRef" name="paymentRef" type="text" placeholder="e.g. UPI ref 4239..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="notes" className="text-xs font-medium text-muted-foreground">Notes</label>
                <input
                  id="notes" name="notes" type="text" placeholder="Optional"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3">
                <Button type="submit" size="sm">Save payout</Button>
                <Link href="/settings/payouts">
                  <Button variant="ghost" size="sm">Cancel</Button>
                </Link>
                {sp.error && (
                  <p className="text-sm text-destructive">{decodeURIComponent(sp.error)}</p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Pending periods breakdown */}
      {healerRows.some((h) => h.pending.length > 0) && (
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unpaid periods</CardTitle>
          </CardHeader>
          <CardContent className="px-2 py-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Healer</th>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 font-medium text-right">Earned</th>
                  <th className="px-3 py-2 font-medium text-right">Paid</th>
                  <th className="px-3 py-2 font-medium text-right">Pending</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {healerRows.flatMap((h) =>
                  h.pending.map((p: PendingPeriod) => (
                    <tr key={`${h.id}-${p.period}`} className="hover:bg-muted/30">
                      <td className="px-3 py-2">{h.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{inr(p.earned)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{inr(p.paid)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-amber-700">{inr(p.pending)}</td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/settings/payouts?healer=${h.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs">Pay</Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Payout history */}
      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Payout history</CardTitle>
        </CardHeader>
        <CardContent className="px-2 py-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Healer</th>
                <th className="px-3 py-2 font-medium">Period</th>
                <th className="px-3 py-2 font-medium text-right">Gross</th>
                <th className="px-3 py-2 font-medium text-right">Deductions</th>
                <th className="px-3 py-2 font-medium text-right">Net paid</th>
                <th className="px-3 py-2 font-medium">Paid on</th>
                <th className="px-3 py-2 font-medium">Ref</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {healerRows.flatMap((h) =>
                h.healerPayouts.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">{h.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{periodLabel(p.period)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{inr(p.gross)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {p.deductions > 0 ? inr(p.deductions) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-700">{inr(p.net)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{format(new Date(p.paidAt), "d MMM yyyy")}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{p.paymentRef ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <form action={deletePayoutAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <button
                          type="submit"
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Delete payout record"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
              {healerRows.every((h) => h.healerPayouts.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No payouts recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
