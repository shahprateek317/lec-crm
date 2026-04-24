import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STAGES, STAGE_TONE } from "@/lib/pipeline";
import { StageBadge } from "@/components/leads/stage-badge";
import { formatDistanceToNow, startOfMonth, subDays } from "date-fns";
import type { PipelineStage } from "@prisma/client";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

const HAPPY_PATH: PipelineStage[] = [
  "NEW", "CONTACTED", "COUNSELING_SCHEDULED", "COUNSELING_DONE",
  "VISIT_SCHEDULED", "VISIT_DONE", "HEALING_ACTIVE", "CONVERTED",
];

const ROLE_HINT: Record<string, { title: string; body: string; href: string; cta: string }> = {
  ADMIN: {
    title: "Admin view",
    body: "You can set up staff, credit packages, courses and prerequisites from the Settings page.",
    href: "/settings",
    cta: "Open settings",
  },
  COORDINATOR: {
    title: "Coordinator view",
    body: "New enquiries appear in Leads. Call clients, book counsellings, and keep follow-ups flowing.",
    href: "/leads?stage=NEW",
    cta: "New leads",
  },
  COUNSELLOR: {
    title: "Counsellor view",
    body: "Your scheduled counsellings and today's sessions are in Counselling & Visits.",
    href: "/schedule?view=today",
    cta: "Today's schedule",
  },
  HEALER: {
    title: "Healer view",
    body: "Healing sessions and distant-healing updates are where you spend your day.",
    href: "/healing",
    cta: "Healing sessions",
  },
};

export default async function DashboardPage() {
  const session = await auth();
  const role = session?.user.role ?? "COORDINATOR";
  const hint = ROLE_HINT[role] ?? ROLE_HINT.COORDINATOR;
  const monthStart = startOfMonth(new Date());
  const thirtyDaysAgo = subDays(new Date(), 30);

  const [
    totalLeads,
    stageCounts,
    counselingsDone,
    visitsDone,
    paymentsThisMonth,
    leadsThisMonth,
    convertedThisMonth,
    healingsThisMonth,
    messagesThisMonth,
    creditsOutstanding,
    recentLeads,
    openFollowUps,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.client.groupBy({ by: ["stage"], _count: { _all: true } }),
    prisma.counselingSession.count({ where: { doneAt: { not: null } } }),
    prisma.visit.count({ where: { visitedAt: { not: null } } }),
    prisma.payment.aggregate({
      where: { status: "PAID", paidAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.client.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.client.count({ where: { convertedAt: { gte: monthStart } } }),
    prisma.healingSession.count({ where: { date: { gte: monthStart } } }),
    prisma.whatsAppMessage.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.creditLedgerEntry.aggregate({ _sum: { delta: true } }),
    prisma.client.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, name: true, phone: true, stage: true, createdAt: true, issue: true },
    }),
    prisma.followUp.count({
      where: { status: { in: ["PENDING", "INTERESTED", "DELAYED"] }, dueAt: { lte: new Date() } },
    }),
  ]);

  const byStage = new Map(stageCounts.map((s) => [s.stage, s._count._all]));
  const visited = byStage.get("VISIT_DONE") ?? 0;
  const healing = byStage.get("HEALING_ACTIVE") ?? 0;
  const converted = byStage.get("CONVERTED") ?? 0;
  const downstream = visited + healing + converted;
  const conversionRate =
    downstream > 0 ? Math.round((converted / downstream) * 100) : 0;

  const maxFunnel = Math.max(...HAPPY_PATH.map((s) => byStage.get(s) ?? 0), 1);

  const metrics = [
    { label: "Leads this month",       value: leadsThisMonth },
    { label: "Conversions this month", value: convertedThisMonth },
    { label: "Healings this month",    value: healingsThisMonth },
    { label: "Paid this month",        value: `₹${(paymentsThisMonth._sum.amount ?? 0).toLocaleString("en-IN")}` },
    { label: "Credits outstanding",    value: creditsOutstanding._sum.delta ?? 0 },
    { label: "WhatsApp msgs sent",     value: messagesThisMonth },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {hint.title}
            </p>
            <h1 className="mt-1 font-serif text-3xl font-medium tracking-tight">
              Welcome, {session?.user.name?.split(" ")[0] ?? "there"}
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {hint.body}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={hint.href}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              {hint.cta} →
            </Link>
            {openFollowUps > 0 && (
              <Link
                href="/follow-ups"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-amber-100 px-3 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-200"
              >
                {openFollowUps} follow-up{openFollowUps === 1 ? "" : "s"} due
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {metrics.map((m) => (
          <Card key={m.label} className="rounded-xl">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {m.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-serif text-2xl font-medium">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-xl lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Funnel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {HAPPY_PATH.map((s) => {
              const count = byStage.get(s) ?? 0;
              const pct = (count / maxFunnel) * 100;
              const tone = STAGE_TONE[s];
              return (
                <div key={s} className="grid grid-cols-[1fr_auto] items-center gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${tone.bg} ${tone.fg}`}>
                        {tone.label}
                      </span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full ${tone.bg.replace("bg-", "bg-").replace("-100", "-300")}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="mt-3 flex items-baseline justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Post-visit conversion to course</span>
              <span className="font-serif text-lg font-medium">{conversionRate}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {counselingsDone} counsellings done · {visitsDone} visits done · all time
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent enquiries
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {recentLeads.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No enquiries yet.
              </p>
            )}
            {recentLeads.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="block p-3 transition-colors hover:bg-muted/60"
              >
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{lead.name}</p>
                  <StageBadge stage={lead.stage} />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDistanceToNow(lead.createdAt, { addSuffix: true })} · {lead.issue ?? "—"}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="text-xs text-muted-foreground">
        Total leads ever: {totalLeads.toLocaleString("en-IN")}
      </section>
    </div>
  );
}
