// "My schedule" — every staff member sees their own upcoming sessions
// across the next 7 days, plus their declared blocks. Healers, counsellors,
// and admins all use this; the queries adapt to which session types apply
// to their role.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listBlocksInRange } from "@/lib/schedule-blocks";
import { Card, CardContent } from "@/components/ui/card";
import { FlashToaster } from "@/components/flash-toaster";
import { EmptyState } from "@/components/empty-state";
import { CalendarDays, Sparkles, Stethoscope, Ban, Plus } from "lucide-react";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { createBlockAction, deleteBlockAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "My schedule" };

const REASON_LABEL: Record<string, string> = {
  EMERGENCY: "Emergency",
  PERSONAL: "Personal",
  TRAVEL: "Travel",
  SICK_LEAVE: "Sick leave",
  TRAINING: "Training",
  OTHER: "Other",
};

export default async function MySchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?callbackUrl=/my-schedule");
  const userId = session.user.id;
  const role = session.user.role;
  const sp = await searchParams;
  const days = Math.max(1, Math.min(30, Number(sp.days) || 7));

  const today = startOfDay(new Date());
  const horizon = addDays(today, days);

  const [counselling, visits, healings, blocks] = await Promise.all([
    prisma.counselingSession.findMany({
      where: { counsellorId: userId, scheduledAt: { gte: today, lt: horizon } },
      orderBy: { scheduledAt: "asc" },
      include: { client: { select: { id: true, name: true } } },
    }),
    prisma.visit.findMany({
      where: { assignedHealerId: userId, scheduledAt: { gte: today, lt: horizon } },
      orderBy: { scheduledAt: "asc" },
      include: { client: { select: { id: true, name: true } } },
    }),
    prisma.healingSession.findMany({
      where: { healerId: userId, date: { gte: today, lt: horizon } },
      orderBy: { date: "asc" },
      include: { client: { select: { id: true, name: true } } },
    }),
    listBlocksInRange(userId, today, days),
  ]);

  // Group everything by day for the calendar layout.
  type Item =
    | { kind: "counselling"; at: Date; clientName: string; clientId: string; href: string }
    | { kind: "visit"; at: Date; clientName: string; clientId: string; href: string }
    | { kind: "healing"; at: Date; clientName: string; clientId: string; href: string };

  const itemsByDay = new Map<string, Item[]>();
  const blocksByDay = new Map<string, typeof blocks>();
  for (let d = 0; d < days; d++) {
    const day = addDays(today, d);
    itemsByDay.set(day.toDateString(), []);
    blocksByDay.set(day.toDateString(), []);
  }
  for (const c of counselling) {
    itemsByDay.get(c.scheduledAt.toDateString())?.push({
      kind: "counselling", at: c.scheduledAt, clientName: c.client.name, clientId: c.client.id,
      href: `/leads/${c.client.id}/counselling/${c.id}/complete`,
    });
  }
  for (const v of visits) {
    itemsByDay.get(v.scheduledAt.toDateString())?.push({
      kind: "visit", at: v.scheduledAt, clientName: v.client.name, clientId: v.client.id,
      href: `/leads/${v.client.id}/visits/${v.id}/complete`,
    });
  }
  for (const h of healings) {
    itemsByDay.get(h.date.toDateString())?.push({
      kind: "healing", at: h.date, clientName: h.client.name, clientId: h.client.id,
      href: `/leads/${h.client.id}`,
    });
  }
  for (const b of blocks) {
    let cursor = startOfDay(b.startsAt);
    while (cursor < b.endsAt && cursor < horizon) {
      blocksByDay.get(cursor.toDateString())?.push(b);
      cursor = addDays(cursor, 1);
    }
  }

  const totalCount =
    counselling.length + visits.length + healings.length;

  return (
    <div className="space-y-6">
      <FlashToaster />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
            <CalendarDays className="h-7 w-7 text-primary" />
            My schedule
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your sessions across the next {days} days, plus any time you've blocked off.
          </p>
        </div>
        <nav className="flex gap-2">
          {[1, 7, 14, 30].map((n) => (
            <Link
              key={n}
              href={`/my-schedule?days=${n}`}
              className={
                "inline-flex h-9 items-center rounded-md px-3 text-xs font-medium transition-colors " +
                (days === n
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-card text-foreground hover:bg-muted")
              }
            >
              {n === 1 ? "Today" : `${n} days`}
            </Link>
          ))}
        </nav>
      </header>

      <Card className="rounded-xl">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Ban className="h-4 w-4 text-amber-700" />
            <p className="text-sm font-medium">Block time off</p>
            <p className="text-xs text-muted-foreground">
              When the auto-assignment engine considers you, blocked windows are skipped.
            </p>
          </div>
          <form action={createBlockAction} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <input type="hidden" name="userId" value={userId} />
            <input
              name="startsAt"
              type="datetime-local"
              required
              className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <input
              name="endsAt"
              type="datetime-local"
              required
              className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <select
              name="reason"
              defaultValue="OTHER"
              className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {Object.entries(REASON_LABEL).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Block
            </button>
          </form>
        </CardContent>
      </Card>

      {totalCount === 0 && blocks.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent className="p-0">
            <EmptyState
              icon={<CalendarDays className="h-5 w-5" />}
              title="Nothing on your calendar"
              description={
                role === "HEALER" || role === "SENIOR_HEALER"
                  ? "Once a coordinator schedules a visit or healing for you, it shows up here."
                  : role === "COUNSELLOR" || role === "SENIOR_COUNSELLOR"
                    ? "When a coordinator books a counselling with you, it shows up here."
                    : "No sessions in this window."
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {Array.from(itemsByDay.entries()).map(([dayKey, items]) => {
            const day = new Date(dayKey);
            const dayBlocks = blocksByDay.get(dayKey) ?? [];
            const isEmpty = items.length === 0 && dayBlocks.length === 0;
            return (
              <Card key={dayKey} className="rounded-xl">
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <p className="font-serif text-base font-medium">
                      {format(day, "EEEE, dd MMM")}
                    </p>
                    {isSameDay(day, new Date()) && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Today</span>
                    )}
                  </div>
                  {isEmpty && <p className="text-xs text-muted-foreground">Free</p>}
                  <div className="space-y-1.5">
                    {items.sort((a, b) => a.at.getTime() - b.at.getTime()).map((item, i) => {
                      const Icon = item.kind === "healing" ? Sparkles : item.kind === "visit" ? Sparkles : Stethoscope;
                      return (
                        <Link
                          key={i}
                          href={item.href}
                          className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:bg-muted/40"
                        >
                          <Icon className="h-4 w-4 shrink-0 text-primary" />
                          <span className="font-mono text-xs text-muted-foreground">{format(item.at, "HH:mm")}</span>
                          <span className="text-sm">{item.clientName}</span>
                          <span className="ml-auto text-[11px] capitalize text-muted-foreground">{item.kind}</span>
                        </Link>
                      );
                    })}
                    {dayBlocks.map((b) => (
                      <form action={deleteBlockAction} key={b.id} className="flex items-center gap-3 rounded-md bg-amber-50 px-3 py-2 text-amber-900">
                        <input type="hidden" name="id" value={b.id} />
                        <Ban className="h-4 w-4 shrink-0" />
                        <span className="font-mono text-xs">
                          {format(b.startsAt, "HH:mm")}–{format(b.endsAt, "HH:mm")}
                        </span>
                        <span className="text-sm">{REASON_LABEL[b.reason] ?? b.reason}</span>
                        {b.note && <span className="text-xs italic text-amber-800">· {b.note}</span>}
                        <button type="submit" className="ml-auto text-[11px] underline hover:no-underline">
                          Remove
                        </button>
                      </form>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
