import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SessionAttendancePanel } from "./attendance-panel";

export const dynamic = "force-dynamic";

export default async function PranicSessionPage({ params }: { params: { sessionId: string } }) {
  const { sessionId } = params;

  const session = await prisma.pranicGroupSession.findUnique({
    where: { id: sessionId },
    include: {
      attendances: {
        include: { client: { select: { id: true, name: true, phone: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!session) notFound();

  const attendances = session.attendances.map(a => ({
    clientId: a.clientId,
    clientName: a.client.name,
    clientPhone: a.client.phone,
    status: a.status,
  }));

  return (
    <div className="space-y-6">
      <Link href="/groups/pranic" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All sessions
      </Link>

      <header>
        <h1 className="font-serif text-2xl font-medium">
          {format(session.scheduledAt, "EEEE, dd MMM yyyy · HH:mm")}
        </h1>
        {session.notes && <p className="mt-1 text-sm text-muted-foreground">{session.notes}</p>}
      </header>

      <SessionAttendancePanel sessionId={sessionId} initialAttendances={attendances} />
    </div>
  );
}
