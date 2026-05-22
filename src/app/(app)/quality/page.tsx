// Quality Controller — audit dashboard.
//
// Per dad's "Update the existing Healing" doc (May 2026): a new Quality
// Controller role that audits healing sessions, reviews healer records,
// gives ratings + quality feedback, and generates healer quality reports.
//
// This page is the entry point. The full audit-on-a-session UX (drill-down,
// rating slider, comment thread, healer quality report rollup) is the next
// chunk of work — see docs/HANDOVER.md "Known limitations & follow-ups".

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAuditQuality } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ClipboardList, Star, AlertTriangle, Activity } from "lucide-react";
import { format, startOfDay, subDays } from "date-fns";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quality" };

export default async function QualityPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?callbackUrl=/quality");
  if (!canAuditQuality(session.user.role)) redirect("/dashboard");

  const since = subDays(startOfDay(new Date()), 30);

  const [totalSessions, recentSessions, healerActivity, feedbackCount] = await Promise.all([
    prisma.healingSession.count({ where: { date: { gte: since } } }),
    prisma.healingSession.findMany({
      where: { date: { gte: since } },
      include: {
        client: { select: { id: true, name: true } },
        healer: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      take: 10,
    }),
    prisma.healingSession.groupBy({
      by: ["healerId"],
      where: { date: { gte: since } },
      _count: true,
      _avg: { improvementScore: true },
      orderBy: { _count: { healerId: "desc" } },
      take: 10,
    }),
    prisma.clientFeedback.count({ where: { submittedAt: { gte: since } } }),
  ]);

  // Resolve healer names for the activity table.
  const healerIds = healerActivity.map((h) => h.healerId);
  const healers = await prisma.user.findMany({
    where: { id: { in: healerIds } },
    select: { id: true, name: true },
  });
  const healerName = new Map(healers.map((h) => [h.id, h.name]));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <ClipboardList className="h-7 w-7 text-primary" />
          Quality
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Audit recent healing sessions and review healer activity over the
          last 30 days. Drill into any session to leave quality feedback.
        </p>
      </header>

      {/* Headline metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Sessions (30 days)" value={totalSessions} icon={<Activity className="h-4 w-4" />} />
        <Metric label="Client feedback entries" value={feedbackCount} icon={<Star className="h-4 w-4" />} />
        <Metric
          label="Avg improvement"
          value={
            healerActivity.length
              ? (
                  healerActivity.reduce((s, h) => s + (h._avg.improvementScore ?? 0), 0) /
                  healerActivity.length
                ).toFixed(1)
              : "—"
          }
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      {/* Healer activity rollup */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Healer activity (last 30 days)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {healerActivity.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-5 w-5" />}
              title="No healing sessions yet"
              description="Once healers start logging sessions, you'll see their activity rolled up here."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Healer</th>
                  <th className="px-4 py-2 text-right">Sessions</th>
                  <th className="px-4 py-2 text-right">Avg improvement</th>
                </tr>
              </thead>
              <tbody>
                {healerActivity.map((row) => (
                  <tr key={row.healerId} className="border-t border-border">
                    <td className="px-4 py-2">{healerName.get(row.healerId) ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{row._count}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {row._avg.improvementScore?.toFixed(1) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Recent sessions */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Recent sessions to audit
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentSessions.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="h-5 w-5" />}
              title="Nothing to audit"
              description="No healing sessions have been logged in the last 30 days."
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentSessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/leads/${s.client.id}`} className="font-medium hover:underline">
                      {s.client.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.healer.name} · {format(s.date, "dd MMM, HH:mm")} ·{" "}
                      {s.sessionType.toLowerCase()}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Δ {s.improvementScore ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Per-session rating + comment audit, healer quality reports, and
        escalation workflow — coming next.
      </p>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card className="rounded-xl">
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 font-serif text-2xl font-medium tabular-nums">{value}</p>
        </div>
        <span className="rounded-full bg-primary/10 p-2 text-primary">{icon}</span>
      </CardContent>
    </Card>
  );
}
