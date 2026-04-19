import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { format, formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Circle } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Distant Healing" };

export default async function DistantHealingListPage() {
  const groups = await prisma.distantHealingGroup.findMany({
    where: { active: true },
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      _count: { select: { healerUpdates: true } },
      healerUpdates: {
        orderBy: { date: "desc" },
        take: 1,
        include: { healer: { select: { name: true } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <Circle className="h-7 w-7 text-primary" />
          Distant healing
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Active client groups receiving daily distant healing.
        </p>
      </header>

      <Card className="rounded-xl">
        <CardContent className="divide-y divide-border p-0">
          {groups.length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">
              No active distant-healing groups. Open any client and enable from their page.
            </p>
          )}
          {groups.map((g) => {
            const last = g.healerUpdates[0];
            return (
              <Link
                key={g.id}
                href={`/leads/${g.clientId}/distant-healing`}
                className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{g.client.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {g._count.healerUpdates} update{g._count.healerUpdates === 1 ? "" : "s"}
                    {last && ` · last by ${last.healer.name} ${formatDistanceToNow(last.date, { addSuffix: true })}`}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  since {format(g.createdAt, "dd MMM")}
                </span>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
