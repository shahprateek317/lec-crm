// /me/sessions — client's full session history (healing + demo visits).

import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft, Sparkles, CheckCircle, Hourglass, Eye } from "lucide-react";
import { requireClient } from "@/lib/me-session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your sessions · Life Energy Centre" };

export default async function MeSessionsPage() {
  const client = await requireClient("/me/sessions");

  const [healingSessions, visits] = await Promise.all([
    prisma.healingSession.findMany({
      where: { clientId: client.id },
      orderBy: { date: "desc" },
      take: 50,
      select: {
        id: true,
        date: true,
        mode: true,
        improvementScore: true,
        durationMinutes: true,
        healer: { select: { name: true } },
        clientConfirmedStartAt: true,
        clientConfirmedEndAt: true,
      },
    }),
    prisma.visit.findMany({
      where: { clientId: client.id },
      orderBy: { scheduledAt: "desc" },
      take: 50,
      select: {
        id: true,
        scheduledAt: true,
        visitedAt: true,
        demoHealingDone: true,
        initialFeedback: true,
        assignedHealer: { select: { name: true } },
      },
    }),
  ]);

  // Merge into a single timeline sorted newest first
  type TimelineItem =
    | { kind: "healing"; date: Date; data: (typeof healingSessions)[number] }
    | { kind: "visit"; date: Date; data: (typeof visits)[number] };

  const timeline: TimelineItem[] = [
    ...healingSessions.map((s) => ({ kind: "healing" as const, date: s.date, data: s })),
    ...visits.map((v) => ({ kind: "visit" as const, date: v.visitedAt ?? v.scheduledAt, data: v })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="space-y-6">
      <Link
        href="/me"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to your portal
      </Link>

      <header>
        <h1 className="flex items-center gap-2 font-serif text-2xl font-medium tracking-tight">
          <Sparkles className="h-6 w-6 text-primary" />
          Your sessions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your complete journey — demo visits and healing sessions.
        </p>
      </header>

      {timeline.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No sessions yet. Once you&rsquo;ve had your first visit or healing, it&rsquo;ll appear here.
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl">
          <CardContent className="py-2">
            <ul className="divide-y divide-border">
              {timeline.map((item) => {
                if (item.kind === "healing") {
                  const s = item.data;
                  const confirmed = s.clientConfirmedEndAt != null;
                  return (
                    <li key={`h-${s.id}`} className="flex items-start justify-between gap-3 py-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                            Healing
                          </span>
                        </div>
                        <p className="mt-1 font-medium text-foreground">
                          {format(s.date, "EEEE, d MMM yyyy")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(s.date, "h:mm a")} · {s.mode === "IN_PERSON" ? "in person" : "distant"} · with {s.healer.name}
                          {s.durationMinutes ? <> · {s.durationMinutes} min</> : null}
                        </p>
                        <p className="mt-1 inline-flex items-center gap-1.5 text-[11px]">
                          {confirmed ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-900">
                              <CheckCircle className="h-3 w-3" />
                              Confirmed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">
                              <Hourglass className="h-3 w-3" />
                              Pending confirmation
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Lift</p>
                        <p
                          className={`font-serif text-xl font-medium ${
                            s.improvementScore > 0
                              ? "text-emerald-700"
                              : s.improvementScore < 0
                              ? "text-amber-700"
                              : "text-muted-foreground"
                          }`}
                        >
                          {s.improvementScore > 0 ? "+" : ""}
                          {s.improvementScore}
                        </p>
                      </div>
                    </li>
                  );
                }

                // Visit / demo session
                const v = item.data;
                const attended = v.visitedAt != null;
                return (
                  <li key={`v-${v.id}`} className="flex items-start justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-violet-700">
                          Demo visit
                        </span>
                      </div>
                      <p className="mt-1 font-medium text-foreground">
                        {format(item.date, "EEEE, d MMM yyyy")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(item.date, "h:mm a")}
                        {v.assignedHealer ? <> · with {v.assignedHealer.name}</> : null}
                        {v.demoHealingDone ? " · demo healing done" : null}
                      </p>
                      {v.initialFeedback && (
                        <p className="mt-1 text-xs italic text-muted-foreground line-clamp-2">
                          &ldquo;{v.initialFeedback}&rdquo;
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {attended ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-900">
                          <Eye className="h-3 w-3" />
                          Attended
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                          Scheduled
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
