import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { format, isSameDay, startOfDay, addDays } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, CheckCircle2, Clock } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Counselling & Visits" };

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: "upcoming" | "today" | "past" }>;
}) {
  const sp = await searchParams;
  const view = sp.view ?? "upcoming";

  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const horizon = addDays(todayStart, 30);

  let counsellingsWhere;
  let visitsWhere;
  if (view === "today") {
    counsellingsWhere = { scheduledAt: { gte: todayStart, lt: tomorrowStart } };
    visitsWhere = { scheduledAt: { gte: todayStart, lt: tomorrowStart } };
  } else if (view === "past") {
    counsellingsWhere = { doneAt: { not: null } };
    visitsWhere = { visitedAt: { not: null } };
  } else {
    counsellingsWhere = { doneAt: null, scheduledAt: { gte: todayStart, lte: horizon } };
    visitsWhere = { visitedAt: null, scheduledAt: { gte: todayStart, lte: horizon } };
  }

  const [counsellings, visits] = await Promise.all([
    prisma.counselingSession.findMany({
      where: counsellingsWhere,
      orderBy: { scheduledAt: "asc" },
      include: { client: { select: { id: true, name: true } }, counsellor: { select: { name: true } } },
      take: 100,
    }),
    prisma.visit.findMany({
      where: visitsWhere,
      orderBy: { scheduledAt: "asc" },
      include: { client: { select: { id: true, name: true } }, assignedHealer: { select: { name: true } } },
      take: 100,
    }),
  ]);

  type Item = {
    id: string;
    kind: "counselling" | "visit";
    at: Date;
    clientId: string;
    clientName: string;
    with: string | null;
    done: boolean;
    href: string;
  };

  const items: Item[] = [
    ...counsellings.map<Item>((c) => ({
      id: c.id,
      kind: "counselling",
      at: c.scheduledAt,
      clientId: c.clientId,
      clientName: c.client.name,
      with: c.counsellor.name,
      done: !!c.doneAt,
      href: c.doneAt
        ? `/leads/${c.clientId}`
        : `/leads/${c.clientId}/counselling/${c.id}/complete`,
    })),
    ...visits.map<Item>((v) => ({
      id: v.id,
      kind: "visit",
      at: v.scheduledAt,
      clientId: v.clientId,
      clientName: v.client.name,
      with: v.assignedHealer?.name ?? null,
      done: !!v.visitedAt,
      href: v.visitedAt
        ? `/leads/${v.clientId}`
        : `/leads/${v.clientId}/visits/${v.id}/complete`,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  // Group by day
  const groups = new Map<string, Item[]>();
  for (const it of items) {
    const key = format(it.at, "yyyy-MM-dd");
    const arr = groups.get(key) ?? [];
    arr.push(it);
    groups.set(key, arr);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-medium tracking-tight">
          Counselling &amp; Visits
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upcoming and recent sessions.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {[
          { k: "upcoming" as const, label: "Upcoming" },
          { k: "today" as const,    label: "Today" },
          { k: "past" as const,     label: "Completed" },
        ].map((tab) => (
          <Link
            key={tab.k}
            href={`/schedule?view=${tab.k}`}
            className={
              "inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium transition-colors " +
              (view === tab.k
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-card text-foreground hover:bg-muted")
            }
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {items.length === 0 && (
        <Card className="rounded-xl">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Nothing {view === "past" ? "completed" : "scheduled"} right now.
          </CardContent>
        </Card>
      )}

      {Array.from(groups.entries()).map(([day, list]) => (
        <section key={day} className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {format(new Date(day), "EEEE, dd MMM yyyy")}
            {isSameDay(new Date(day), now) && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                Today
              </span>
            )}
          </h2>
          <Card className="rounded-xl">
            <CardContent className="divide-y divide-border p-0">
              {list.map((it) => (
                <Link
                  key={`${it.kind}-${it.id}`}
                  href={it.href}
                  className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {it.done ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    ) : (
                      <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {it.clientName}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {it.kind === "counselling" ? "· counselling" : "· visit"}
                        </span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {format(it.at, "HH:mm")}
                        {it.with && ` · with ${it.with}`}
                      </p>
                    </div>
                  </div>
                  {!it.done && (
                    <span className="shrink-0 text-xs text-primary">Mark done →</span>
                  )}
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      ))}
    </div>
  );
}
