import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlashToaster } from "@/components/flash-toaster";
import { MeditationMemberList } from "./member-list";

export const metadata = { title: "Meditation Group" };
export const dynamic = "force-dynamic";

export default async function MeditationGroupPage() {
  const members = await prisma.meditationGroupMembership.findMany({
    orderBy: { joinedAt: "desc" },
    include: {
      client: { select: { id: true, name: true, phone: true } },
    },
  });

  const rows = members.map(m => ({
    clientId: m.clientId,
    clientName: m.client.name,
    clientPhone: m.client.phone,
    status: m.status,
    joinedAt: m.joinedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <FlashToaster />
      <header className="flex items-center gap-3">
        <UsersRound className="h-7 w-7 text-primary" />
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-tight">Meditation Group</h1>
          <p className="text-sm text-muted-foreground">Active members and attendance tracking</p>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        {(["ACTIVE", "INACTIVE", "EXITED"] as const).map(s => {
          const count = members.filter(m => m.status === s).length;
          const cls = s === "ACTIVE" ? "text-emerald-600" : s === "INACTIVE" ? "text-amber-600" : "text-rose-500";
          return (
            <Card key={s} className="rounded-xl">
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${cls}`}>{count}</p>
                <p className="text-xs text-muted-foreground capitalize">{s.toLowerCase()}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <MeditationMemberList initialMembers={rows} />
    </div>
  );
}
