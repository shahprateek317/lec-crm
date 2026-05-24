import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCreditBalance } from "@/lib/credits";
import { suggestHealers } from "@/lib/assignment";
import { FlashToaster } from "@/components/flash-toaster";
import { HealingFormV2 } from "@/components/healing/healing-form-v2";

export const metadata = { title: "Log healing session" };

export default async function LogHealingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ inProgressSessionId?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const [client, healers, balance, suggestions, inProgress] = await Promise.all([
    prisma.client.findUnique({ where: { id }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { active: true, role: { in: ["HEALER", "SENIOR_HEALER", "ADMIN"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getCreditBalance(id),
    suggestHealers(id, "IN_PERSON", undefined, 1),
    // When the healer clicked "End" on the in-progress page they were
    // routed here with ?inProgressSessionId=… — load the partially-filled
    // row so the form pre-fills mode/type/chakras and updates that row
    // rather than creating a duplicate. Defensive: must match the lead
    // we're editing for, else ignore (treat as a fresh log).
    sp.inProgressSessionId
      ? prisma.healingSession.findFirst({
          where: { id: sp.inProgressSessionId, clientId: id },
          select: {
            id: true,
            healerId: true,
            mode: true,
            sessionType: true,
            chakraStatesBefore: true,
            chakraStatesAfter: true,
          },
        })
      : Promise.resolve(null),
  ]);
  if (!client) notFound();

  // Default the healer dropdown to the in-progress session's healer if
  // we have one, otherwise the auto-assignment suggestion.
  const defaultHealerId = inProgress?.healerId ?? suggestions[0]?.user.id;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={inProgress ? `/healing/in-progress/${inProgress.id}` : `/leads/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {inProgress ? "Back to in-progress session" : `Back to ${client.name}`}
      </Link>

      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <Sparkles className="h-7 w-7 text-primary" />
          {inProgress ? "Log session details" : "Log healing session"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {inProgress
            ? "This session is already started — recording chakra states will close it out."
            : "Capture chakra states, actions taken, and the auto-computed improvement."}
        </p>
      </header>

      <FlashToaster />

      <HealingFormV2
        clientId={client.id}
        clientName={client.name}
        healers={healers}
        defaultHealerId={defaultHealerId}
        creditBalance={balance}
        inProgressSessionId={inProgress?.id}
        initialState={
          inProgress
            ? {
                mode: inProgress.mode,
                sessionType: inProgress.sessionType,
                chakraStatesBefore: (inProgress.chakraStatesBefore as Record<string, string> | null) ?? undefined,
                chakraStatesAfter:  (inProgress.chakraStatesAfter  as Record<string, string> | null) ?? undefined,
              }
            : undefined
        }
      />
    </div>
  );
}
