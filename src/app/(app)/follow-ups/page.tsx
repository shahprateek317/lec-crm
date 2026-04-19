import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { generateFollowUps } from "@/lib/follow-ups";
import { format, formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { updateFollowUpAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Follow-ups" };

const REASON_LABEL: Record<string, string> = {
  MISSED_COUNSELING: "Missed counselling",
  MISSED_VISIT: "Missed visit",
  POST_VISIT: "Post-visit check-in",
  PAYMENT_REMINDER: "Payment reminder",
  LOW_CREDITS: "Low credits",
  COURSE_CONVERSION: "Course conversion",
  CUSTOM: "Custom",
};

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  // Opportunistic regeneration. Idempotent.
  await generateFollowUps();

  const sp = await searchParams;
  const status = sp.status?.toUpperCase() as
    | "PENDING" | "INTERESTED" | "DELAYED" | "NOT_RESPONDING" | "DONE" | "CANCELLED" | undefined;

  const followUps = await prisma.followUp.findMany({
    where: status ? { status } : { status: { in: ["PENDING", "INTERESTED", "DELAYED"] } },
    orderBy: { dueAt: "asc" },
    take: 200,
    include: {
      client: { select: { id: true, name: true, phone: true } },
      assignedTo: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <Clock className="h-7 w-7 text-primary" />
          Follow-ups
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Auto-generated from missed sessions, stale payments, and low credits.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {[
          { v: "",            label: "Open" },
          { v: "PENDING",     label: "Pending" },
          { v: "INTERESTED",  label: "Interested" },
          { v: "DELAYED",     label: "Delayed" },
          { v: "NOT_RESPONDING", label: "Not responding" },
          { v: "DONE",        label: "Done" },
        ].map((t) => (
          <Link
            key={t.v}
            href={t.v ? `/follow-ups?status=${t.v}` : "/follow-ups"}
            className={
              "inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium transition-colors " +
              ((sp.status ?? "") === t.v
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-card text-foreground hover:bg-muted")
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <Card className="rounded-xl">
        <CardContent className="divide-y divide-border p-0">
          {followUps.length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">
              Nothing open. Lovely.
            </p>
          )}
          {followUps.map((f) => {
            const overdue = f.dueAt.getTime() < Date.now();
            return (
              <div key={f.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/leads/${f.clientId}`} className="font-medium hover:underline">
                      {f.client.name}
                    </Link>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {REASON_LABEL[f.reason] ?? f.reason}
                    </span>
                    {overdue && f.status === "PENDING" && (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        overdue
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    due {formatDistanceToNow(f.dueAt, { addSuffix: true })} · {format(f.dueAt, "dd MMM, HH:mm")}
                    {f.assignedTo && ` · ${f.assignedTo.name}`}
                  </p>
                  {f.note && <p className="mt-1 text-xs text-muted-foreground">{f.note}</p>}
                </div>
                <form action={updateFollowUpAction} className="flex shrink-0 items-center gap-2">
                  <input type="hidden" name="id" value={f.id} />
                  <select
                    name="status"
                    defaultValue={f.status}
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-xs outline-none"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="INTERESTED">Interested</option>
                    <option value="DELAYED">Delayed</option>
                    <option value="NOT_RESPONDING">Not responding</option>
                    <option value="DONE">Done</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
                  >
                    Update
                  </button>
                </form>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
