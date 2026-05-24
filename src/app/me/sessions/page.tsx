// /me/sessions — client's healing-session history.
// Read-only timeline of past sessions with improvement scores and
// healer attribution. No notes/audit content (those are internal).

import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft, Sparkles, CheckCircle, Hourglass } from "lucide-react";
import { requireClient } from "@/lib/me-session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your sessions · Life Energy Centre" };

export default async function MeSessionsPage() {
  const client = await requireClient("/me/sessions");

  const sessions = await prisma.healingSession.findMany({
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
  });

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
          A gentle record of your healing journey, with the lift in energy
          captured by your healer.
        </p>
      </header>

      {sessions.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No sessions yet. Once you&rsquo;ve had your first healing, it&rsquo;ll appear here.
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl">
          <CardContent className="py-2">
            <ul className="divide-y divide-border">
              {sessions.map((s) => {
                const confirmed = s.clientConfirmedEndAt != null;
                return (
                  <li key={s.id} className="flex items-start justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
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
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        Lift
                      </p>
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
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
