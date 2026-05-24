// Per-healer scorecard + cert verification.
//
// Phase 1b scope:
//   • Identity card
//   • 30-day session count + avg improvement + missed-confirmation rate
//   • Certifications list with Verify / Unverify controls
//   • Recent sessions audit table (link out to /quality/sessions/[id])
//
// Healer earnings + full scorecard ranking ships in Phase 2.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format, subDays, startOfDay } from "date-fns";
import {
  ChevronLeft,
  ShieldCheck,
  Hourglass,
  Activity,
  Sparkles,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { canAuditQuality } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { FlashToaster } from "@/components/flash-toaster";
import {
  verifyCertificationAction,
  unverifyCertificationAction,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function QualityHealerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || !canAuditQuality(session.user.role)) redirect("/dashboard");
  const { id: healerId } = await params;

  const since = subDays(startOfDay(new Date()), 30);

  const [healer, sessions30, recent] = await Promise.all([
    prisma.user.findUnique({
      where: { id: healerId },
      include: {
        healerProfile: true,
        certifications: {
          orderBy: { createdAt: "desc" },
          include: { document: true },
        },
      },
    }),
    prisma.healingSession.findMany({
      where: { healerId, date: { gte: since } },
      select: {
        id: true,
        improvementScore: true,
        clientConfirmedStartAt: true,
        clientConfirmedEndAt: true,
        endedAt: true,
      },
    }),
    prisma.healingSession.findMany({
      where: { healerId },
      orderBy: { date: "desc" },
      take: 15,
      include: {
        client: { select: { id: true, name: true } },
      },
    }),
  ]);

  if (!healer) notFound();

  const sessionsCount = sessions30.length;
  const avgImprovement =
    sessionsCount > 0
      ? (sessions30.reduce((s, x) => s + x.improvementScore, 0) / sessionsCount).toFixed(1)
      : "—";
  // Sessions that were marked ended but never confirmed by the client.
  const missedEndConfirmations = sessions30.filter(
    (s) => s.endedAt && !s.clientConfirmedEndAt,
  ).length;
  const missRate = sessionsCount > 0
    ? Math.round((missedEndConfirmations / sessionsCount) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <FlashToaster />

      <Link href="/quality" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Back to Quality
      </Link>

      <header>
        <h1 className="font-serif text-2xl font-medium tracking-tight">{healer.name}</h1>
        <p className="text-sm text-muted-foreground">
          {healer.role.replace(/_/g, " ").toLowerCase()} ·{" "}
          {healer.email}
          {healer.employeeCode && <> · {healer.employeeCode}</>}
        </p>
      </header>

      {/* Headline metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Sessions (30d)" value={sessionsCount} icon={<Activity className="h-4 w-4" />} />
        <Metric label="Avg improvement" value={avgImprovement} icon={<Sparkles className="h-4 w-4" />} />
        <Metric
          label="Missed end-confirms"
          value={`${missedEndConfirmations} (${missRate}%)`}
          icon={<Hourglass className="h-4 w-4" />}
          highlight={missRate > 20}
        />
      </div>

      {/* Certifications */}
      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            Certifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 py-2">
          {healer.certifications.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No certifications on file yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {healer.certifications.map((c) => (
                <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.issuingBody ?? "—"}
                      {c.issuedAt ? ` · issued ${format(c.issuedAt, "MMM yyyy")}` : ""}
                      {c.expiresAt ? ` · expires ${format(c.expiresAt, "MMM yyyy")}` : ""}
                    </p>
                    <p className="mt-1 inline-flex flex-wrap items-center gap-1 text-[11px]">
                      {c.verifiedAt ? (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-900">
                          Verified {format(c.verifiedAt, "dd MMM yyyy")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">
                          <Hourglass className="h-3 w-3" /> Pending verification
                        </span>
                      )}
                      {c.documentId ? (
                        <Link
                          href={`/api/documents/${c.documentId}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary hover:bg-primary/20"
                        >
                          View file
                        </Link>
                      ) : (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">
                          No file attached
                        </span>
                      )}
                    </p>
                    {c.notes && (
                      <p className="mt-1 text-[11px] italic text-muted-foreground">{c.notes}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {c.verifiedAt ? (
                      <form action={unverifyCertificationAction}>
                        <input type="hidden" name="certId" value={c.id} />
                        <SubmitButton
                          pendingLabel="…"
                          className="h-8 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
                        >
                          Unverify
                        </SubmitButton>
                      </form>
                    ) : (
                      <form action={verifyCertificationAction} className="flex flex-col items-end gap-1.5">
                        <input type="hidden" name="certId" value={c.id} />
                        <input
                          name="notes"
                          placeholder="Notes (optional)"
                          className="h-8 w-48 rounded-md border border-border bg-card px-2 text-xs"
                        />
                        <SubmitButton
                          pendingLabel="Verifying…"
                          className="h-8 rounded-md bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          Mark verified
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Recent sessions */}
      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Recent sessions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No sessions yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/quality/sessions/${s.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{s.client.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(s.date, "dd MMM, HH:mm")} ·{" "}
                        {s.mode === "IN_PERSON" ? "in person" : "distant"}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Δ {s.improvementScore}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className={`rounded-xl ${highlight ? "border-amber-300 bg-amber-50/50" : ""}`}>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 font-serif text-2xl font-medium tabular-nums">{value}</p>
        </div>
        <span className={`rounded-full p-2 ${highlight ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}>
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}
