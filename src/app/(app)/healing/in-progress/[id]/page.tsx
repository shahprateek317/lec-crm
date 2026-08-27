// In-progress healing session — the screen the healer sees between
// pressing Start and the post-session log. Shows check-in status, an End
// button that triggers the end check-in token + WhatsApp, and a "Log
// session details" CTA that hands off to the existing chakras-and-colours
// form for completion.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Hourglass, Play, Square, ChevronLeft, FileText, Copy } from "lucide-react";
import { buildConfirmUrl } from "@/lib/check-in";
import { endSessionAction } from "./actions";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Session in progress" };

export default async function InProgressSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?callbackUrl=/my-schedule");

  const { id } = await params;
  const hs = await prisma.healingSession.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      healer: { select: { id: true, name: true } },
    },
  });
  if (!hs) notFound();

  const startUrl = hs.startCheckInToken ? buildConfirmUrl(hs.startCheckInToken) : null;
  const endUrl   = hs.endCheckInToken   ? buildConfirmUrl(hs.endCheckInToken)   : null;

  const phase: "started" | "ended" | "logged" =
    !hs.endedAt ? "started" : hs.improvementScore !== 0 || hs.chakraStatesBefore !== null ? "logged" : "ended";

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
          Session in progress
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {hs.client.name} · {hs.mode === "IN_PERSON" ? "in person" : "distant"} · {hs.sessionType.toLowerCase()}
        </p>
      </header>

      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Check-in status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatusRow
            label="Session started"
            time={hs.startedAt}
            badge={
              hs.clientConfirmedStartAt
                ? { kind: "confirmed", at: hs.clientConfirmedStartAt }
                : { kind: "awaiting", testUrl: startUrl }
            }
          />
          <StatusRow
            label="Session ended"
            time={hs.endedAt}
            badge={
              hs.endedAt
                ? hs.clientConfirmedEndAt
                  ? { kind: "confirmed", at: hs.clientConfirmedEndAt }
                  : { kind: "awaiting", testUrl: endUrl }
                : { kind: "not-yet" }
            }
          />
        </CardContent>
      </Card>

      {phase === "started" && (
        <div className="space-y-3">
          {/* Step 1: healer must log chakras/remarks before ending */}
          <Link
            href={`/leads/${hs.client.id}/healing/new?inProgressSessionId=${hs.id}`}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl border-2 border-primary text-base font-medium text-primary hover:bg-primary/5"
          >
            <FileText className="mr-2 h-4 w-4" /> Step 1 — Log session details
          </Link>
          <form action={endSessionAction}>
            <input type="hidden" name="sessionId" value={hs.id} />
            <SubmitButton
              pendingLabel="Ending…"
              className="h-12 w-full rounded-xl bg-primary text-base font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Square className="mr-2 h-4 w-4" /> Step 2 — Mark session ended
            </SubmitButton>
          </form>
          <p className="text-center text-[11px] text-muted-foreground">
            Please log chakra details first, then mark ended. This sends the client a WhatsApp link to confirm.
          </p>
        </div>
      )}

      {phase === "ended" && (
        <Link
          href={`/leads/${hs.client.id}/healing/new?inProgressSessionId=${hs.id}`}
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary text-base font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <FileText className="mr-2 h-4 w-4" /> Log session details
        </Link>
      )}

      {phase === "logged" && (
        <Card className="rounded-xl border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="text-sm text-emerald-900">
              Session complete and logged. Client has been asked for feedback.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusRow({
  label,
  time,
  badge,
}: {
  label: string;
  time: Date | null;
  badge:
    | { kind: "confirmed"; at: Date }
    | { kind: "awaiting"; testUrl: string | null }
    | { kind: "not-yet" };
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">
          {time ? format(time, "EEE dd MMM, h:mm a") : "—"}
        </p>
      </div>
      {badge.kind === "confirmed" ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900">
          <CheckCircle2 className="h-3 w-3" />
          Confirmed {format(badge.at, "h:mm a")}
        </span>
      ) : badge.kind === "awaiting" ? (
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
            <Hourglass className="h-3 w-3" />
            Awaiting client tap
          </span>
          {badge.testUrl && (
            <a
              href={badge.testUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              title="Open the client's confirmation link — useful for testing before WhatsApp is live"
            >
              <Copy className="h-3 w-3" /> test link
            </a>
          )}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">Not yet</span>
      )}
    </div>
  );
}
