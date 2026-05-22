// "Start a healing session now" — minimum-friction entry for the live
// check-in flow (replaces dad's OTP-at-start). Healer picks the client,
// confirms mode + type, and taps Start. We create the HealingSession with
// `startedAt` = now, generate the start token, send the client a one-tap
// WhatsApp link, then redirect the healer to the in-progress detail page.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { ChevronLeft, Play } from "lucide-react";
import { startSessionAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Start a session" };

export default async function StartSessionPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?callbackUrl=/healing/start");

  // Show recent clients first so healers can find people quickly.
  const clients = await prisma.client.findMany({
    where: { stage: { in: ["VISIT_DONE", "HEALING_ACTIVE", "CONVERTED"] } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, name: true, phone: true, stage: true },
  });

  return (
    <div className="space-y-6">
      <Link
        href="/my-schedule"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to schedule
      </Link>

      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <Play className="h-7 w-7 text-primary" />
          Start a healing session
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Pick the client and tap Start. They'll get a one-tap WhatsApp link
          to confirm the session has begun. After the session, you'll mark
          End and then log the chakra states + colours used.
        </p>
      </header>

      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Choose client
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No clients in active healing yet. Visits and demo healing
              sessions move people into this list.
            </p>
          ) : (
            <form action={startSessionAction} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="clientId" className="text-sm font-medium">Client</label>
                <select
                  id="clientId"
                  name="clientId"
                  required
                  className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="mode" className="text-sm font-medium">Mode</label>
                  <select
                    id="mode"
                    name="mode"
                    defaultValue="IN_PERSON"
                    className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="IN_PERSON">In person (at centre)</option>
                    <option value="DISTANT">Distant (remote)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="sessionType" className="text-sm font-medium">Type</label>
                  <select
                    id="sessionType"
                    name="sessionType"
                    defaultValue="PAID"
                    className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="PAID">Paid</option>
                    <option value="DEMO">Demo (complimentary)</option>
                    <option value="FOLLOW_UP">Follow-up</option>
                  </select>
                </div>
              </div>

              <SubmitButton
                pendingLabel="Starting…"
                className="h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <Play className="mr-2 h-4 w-4" /> Start session
              </SubmitButton>
              <p className="text-[11px] text-muted-foreground">
                The client will receive a tap-to-confirm message via WhatsApp.
                You can still proceed if WhatsApp isn't yet live — the link is
                also openable directly from the next screen.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
