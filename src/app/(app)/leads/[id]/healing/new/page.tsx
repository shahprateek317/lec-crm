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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [client, healers, balance, suggestions] = await Promise.all([
    prisma.client.findUnique({ where: { id }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { active: true, role: { in: ["HEALER", "SENIOR_HEALER", "ADMIN"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getCreditBalance(id),
    suggestHealers(id, "IN_PERSON", undefined, 1),
  ]);
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/leads/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to {client.name}
      </Link>

      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <Sparkles className="h-7 w-7 text-primary" />
          Log healing session
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Capture chakra states, actions taken, and the auto-computed improvement.
        </p>
      </header>

      <FlashToaster />

      <HealingFormV2
        clientId={client.id}
        clientName={client.name}
        healers={healers}
        defaultHealerId={suggestions[0]?.user.id}
        creditBalance={balance}
      />
    </div>
  );
}
