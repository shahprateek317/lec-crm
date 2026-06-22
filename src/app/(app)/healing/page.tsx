import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Healing Sessions" };

export default async function HealingPage({
  searchParams,
}: {
  searchParams: Promise<{ healerId?: string; mode?: string }>;
}) {
  const sp = await searchParams;

  const [sessions, healers] = await Promise.all([
    prisma.healingSession.findMany({
      where: {
        healerId: sp.healerId || undefined,
        mode: sp.mode === "IN_PERSON" || sp.mode === "DISTANT" ? sp.mode : undefined,
      },
      orderBy: { date: "desc" },
      take: 200,
      include: {
        client: { select: { id: true, name: true } },
        healer: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: { active: true, roles: { hasSome: ["HEALER", "ADMIN"] } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <Sparkles className="h-7 w-7 text-primary" />
          Healing sessions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every recorded session — in-person or distant.
        </p>
      </header>

      <form
        method="GET"
        className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3"
      >
        <select
          name="healerId"
          defaultValue={sp.healerId ?? ""}
          className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none"
        >
          <option value="">All healers</option>
          {healers.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
        <select
          name="mode"
          defaultValue={sp.mode ?? ""}
          className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none"
        >
          <option value="">Any mode</option>
          <option value="IN_PERSON">In-person</option>
          <option value="DISTANT">Distant</option>
        </select>
        <button type="submit" className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
          Apply
        </button>
      </form>

      <Card className="rounded-xl">
        <CardContent className="divide-y divide-border p-0">
          {sessions.length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">No sessions yet.</p>
          )}
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/leads/${s.clientId}`}
              className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/60"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {s.client.name}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {s.mode === "DISTANT" ? "distant" : "in-person"}
                    {!s.creditUsed && " · complimentary"}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.healer.name}
                  {s.process && ` · ${s.process}`}
                  {s.durationMinutes && ` · ${s.durationMinutes}m`}
                  {s.chakras.length > 0 && ` · ${s.chakras.length} chakra${s.chakras.length > 1 ? "s" : ""}`}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {format(s.date, "dd MMM, HH:mm")}
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
