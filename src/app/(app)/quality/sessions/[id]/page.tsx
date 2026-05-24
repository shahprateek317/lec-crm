// Per-session audit drill-down. QC views the full picture and leaves
// a structured note (rating + free-text + escalation flag). The note is
// append-only; prior notes are visible above the form.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import {
  ChevronLeft,
  ClipboardList,
  AlertTriangle,
  CheckCircle,
  Smile,
  Frown,
  Activity,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { canAuditQuality } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { FlashToaster } from "@/components/flash-toaster";
import { addQualityNoteAction } from "../../actions";

export const dynamic = "force-dynamic";

const RATING_LABELS: Record<string, string> = {
  POOR: "Poor",
  FAIR: "Fair",
  GOOD: "Good",
  VERY_GOOD: "Very good",
  EXCELLENT: "Excellent",
};

export default async function QualitySessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || !canAuditQuality(session.user.role)) redirect("/dashboard");
  const { id } = await params;

  const hs = await prisma.healingSession.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      healer: { select: { id: true, name: true } },
      feedback: true,
      qualityNotes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!hs) notFound();

  // Skew between healer-claimed start and client confirmation.
  const startSkewMin =
    hs.startedAt && hs.clientConfirmedStartAt
      ? Math.round((hs.clientConfirmedStartAt.getTime() - hs.startedAt.getTime()) / 60_000)
      : null;
  const endSkewMin =
    hs.endedAt && hs.clientConfirmedEndAt
      ? Math.round((hs.clientConfirmedEndAt.getTime() - hs.endedAt.getTime()) / 60_000)
      : null;

  return (
    <div className="space-y-6">
      <FlashToaster />

      <Link href="/quality" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Back to Quality
      </Link>

      <header>
        <h1 className="flex items-center gap-2 font-serif text-2xl font-medium tracking-tight">
          <ClipboardList className="h-6 w-6 text-primary" />
          Session audit — {hs.client.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {format(hs.date, "EEEE, d MMM yyyy · HH:mm")} ·{" "}
          {hs.mode === "IN_PERSON" ? "in person" : "distant"} ·{" "}
          healer {hs.healer.name} ·{" "}
          <Link href={`/leads/${hs.client.id}`} className="text-primary hover:underline">
            Open lead profile
          </Link>
        </p>
      </header>

      {/* Session at-a-glance */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl">
          <CardContent className="space-y-1 py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Improvement score</p>
            <p className="font-serif text-3xl font-medium">{hs.improvementScore}</p>
            <p className="text-xs text-muted-foreground">Sum of after–before across chakras</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="space-y-1 py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Duration</p>
            <p className="font-serif text-3xl font-medium">
              {hs.durationMinutes ?? "—"}
              {hs.durationMinutes != null && <span className="ml-1 text-sm text-muted-foreground">min</span>}
            </p>
          </CardContent>
        </Card>
        <Card className={`rounded-xl ${(startSkewMin && Math.abs(startSkewMin) > 5) || (endSkewMin && Math.abs(endSkewMin) > 5) ? "border-amber-300 bg-amber-50/50" : ""}`}>
          <CardContent className="space-y-1 py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Client confirmation</p>
            <p className="text-sm">
              <strong>Start:</strong>{" "}
              {hs.clientConfirmedStartAt ? `${startSkewMin}m skew` : "not confirmed"}
            </p>
            <p className="text-sm">
              <strong>End:</strong>{" "}
              {hs.clientConfirmedEndAt ? `${endSkewMin}m skew` : "not confirmed"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chakra map */}
      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Chakra readings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {hs.chakras.length === 0 ? (
            <p className="text-muted-foreground">No chakras recorded.</p>
          ) : (
            <p className="text-foreground">{hs.chakras.join(", ")}</p>
          )}
          {hs.cleansingActions.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <strong>Cleansing:</strong> {hs.cleansingActions.join(", ")}
            </p>
          )}
          {hs.energisingActions.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <strong>Energising:</strong> {hs.energisingActions.join(", ")}
            </p>
          )}
          {hs.remarks && (
            <p className="border-t border-border pt-2 text-xs italic text-muted-foreground">
              {hs.remarks}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Client feedback */}
      {hs.feedback && (
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Smile className="h-4 w-4" />
              Client feedback
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{hs.feedback.content || <em className="text-muted-foreground">No comment</em>}</p>
            <p className="text-xs text-muted-foreground">
              Rating: {hs.feedback.rating ?? "—"} ·{" "}
              {format(hs.feedback.submittedAt, "dd MMM HH:mm")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Prior QC notes */}
      {hs.qualityNotes.length > 0 && (
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Previous audit notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 py-2">
            {hs.qualityNotes.map((n) => (
              <div key={n.id} className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">
                    {n.author.name}
                    {n.rating && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-900">
                        {RATING_LABELS[n.rating]}
                      </span>
                    )}
                    {n.needsHealerAttention && (
                      <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                        <Activity className="h-2.5 w-2.5" />
                        Healer follow-up
                      </span>
                    )}
                    {n.escalated && (
                      <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-900">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Escalated
                      </span>
                    )}
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    {format(n.createdAt, "dd MMM HH:mm")}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{n.note}</p>
                {n.acknowledgedByHealerAt && (
                  <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-700">
                    <CheckCircle className="h-3 w-3" />
                    Healer acknowledged on {format(n.acknowledgedByHealerAt, "dd MMM")}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Add a new audit note */}
      <Card className="rounded-xl border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Add audit note</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addQualityNoteAction} className="space-y-4">
            <input type="hidden" name="sessionId" value={hs.id} />

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Rating (optional)
              </p>
              <div className="grid grid-cols-5 gap-2">
                {(["POOR", "FAIR", "GOOD", "VERY_GOOD", "EXCELLENT"] as const).map((r, i) => (
                  <label
                    key={r}
                    className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-border bg-card p-2 text-center text-xs hover:bg-muted"
                  >
                    <input type="radio" name="rating" value={r} className="hidden peer" />
                    <span className="peer-checked:scale-125 transition-transform">
                      {i < 2 ? <Frown className="h-5 w-5 text-amber-700" /> : <Smile className="h-5 w-5 text-emerald-700" />}
                    </span>
                    <span className="font-medium">{RATING_LABELS[r]}</span>
                  </label>
                ))}
              </div>
            </div>

            <label htmlFor="note" className="block">
              <span className="mb-1.5 inline-block text-xs font-medium text-muted-foreground">
                Note
              </span>
              <textarea
                id="note"
                name="note"
                required
                rows={4}
                placeholder="What did you notice? Anything the healer should know?"
                className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            <div className="flex flex-wrap gap-4 text-xs">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" name="needsHealerAttention" />
                Needs healer follow-up
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" name="escalated" />
                Escalate to admin
              </label>
            </div>

            <SubmitButton
              pendingLabel="Saving…"
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Save audit note
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
