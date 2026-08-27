import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UsersRound, Plus, CheckCircle2, XCircle, Clock } from "lucide-react";
import { createPranicSessionAction } from "./actions";
import { FlashToaster } from "@/components/flash-toaster";

export const metadata = { title: "Pranic Intro Group" };
export const dynamic = "force-dynamic";

export default async function PranicGroupPage() {
  const sessions = await prisma.pranicGroupSession.findMany({
    orderBy: { scheduledAt: "desc" },
    include: {
      _count: { select: { attendances: true } },
      attendances: { select: { status: true } },
    },
  });

  return (
    <div className="space-y-6">
      <FlashToaster />
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UsersRound className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-serif text-2xl font-medium tracking-tight">Introduction to Pranic Healing Group</h1>
            <p className="text-sm text-muted-foreground">Weekly sessions — track registration and attendance</p>
          </div>
        </div>
      </header>

      {/* Create new session */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Schedule new session</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createPranicSessionAction} className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Date & Time</label>
              <input type="datetime-local" name="scheduledAt" required className={inputCls} />
            </div>
            <div className="flex-1 min-w-40 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
              <input type="text" name="notes" placeholder="Topic, venue…" className={inputCls} />
            </div>
            <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Create session
            </button>
          </form>
        </CardContent>
      </Card>

      {/* Sessions list */}
      <div className="space-y-3">
        {sessions.length === 0 && (
          <p className="text-sm text-muted-foreground">No sessions yet. Create one above.</p>
        )}
        {sessions.map((s) => {
          const attended = s.attendances.filter(a => a.status === "ATTENDED").length;
          const registered = s.attendances.filter(a => a.status === "REGISTERED").length;
          const absent = s.attendances.filter(a => a.status === "DID_NOT_ATTEND").length;
          return (
            <Link key={s.id} href={`/groups/pranic/${s.id}`} className="block">
              <Card className="rounded-xl hover:border-primary/50 transition-colors">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{format(s.scheduledAt, "EEEE, dd MMM yyyy · HH:mm")}</p>
                    {s.notes && <p className="text-xs text-muted-foreground mt-0.5">{s.notes}</p>}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-blue-600"><Clock className="h-3.5 w-3.5" />{registered} registered</span>
                    <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />{attended} attended</span>
                    <span className="flex items-center gap-1 text-rose-500"><XCircle className="h-3.5 w-3.5" />{absent} absent</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const inputCls = "flex h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
