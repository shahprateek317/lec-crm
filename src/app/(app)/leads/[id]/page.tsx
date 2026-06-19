import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, User, Phone, MapPin, Clock, MessagesSquare, ArrowRight, Calendar, CheckCircle2, Wallet, Sparkles, UsersRound, Gift, AlertTriangle, Trash2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { allowedNextStages, STAGE_TONE } from "@/lib/pipeline";
import { StageBadge } from "@/components/leads/stage-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { getCreditBalance } from "@/lib/credits";
import {
  assignLeadAction,
  transitionStageAction,
  updateLeadNotesAction,
  sendTemplateAction,
  softDeleteClientAction,
} from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id }, select: { name: true } });
  return { title: client ? client.name : "Lead" };
}

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  const viewerIsAdmin = !!session?.user && isAdmin(session.user.role);

  const creditBalance = await getCreditBalance(id);
  const [client, staff, templates, counsellings, visits, recentPayments, recentHealing] = await Promise.all([
    prisma.client.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true } },
        stageTransitions: {
          orderBy: { at: "desc" },
          take: 50,
          include: { byUser: { select: { name: true } } },
        },
        whatsappMessages: {
          orderBy: { createdAt: "desc" },
          take: 30,
        },
        referrer:  { select: { id: true, name: true, phone: true } },
        referrals: { select: { id: true, name: true, stage: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.user.findMany({
      where: { active: true, role: { in: ["COORDINATOR", "COUNSELLOR", "HEALER"] } },
      orderBy: { name: "asc" },
    }),
    prisma.whatsAppTemplate.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.counselingSession.findMany({
      where: { clientId: id },
      orderBy: { scheduledAt: "desc" },
      include: { counsellor: { select: { name: true } } },
    }),
    prisma.visit.findMany({
      where: { clientId: id },
      orderBy: { scheduledAt: "desc" },
      include: { assignedHealer: { select: { name: true } } },
    }),
    prisma.payment.findMany({
      where: { clientId: id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.healingSession.findMany({
      where: { clientId: id },
      orderBy: { date: "desc" },
      take: 5,
      include: { healer: { select: { name: true } } },
    }),
  ]);

  if (!client) notFound();

  const nextStages = allowedNextStages(client.stage);
  const openCounselling = counsellings.find((c) => !c.doneAt);
  const openVisit = visits.find((v) => !v.visitedAt);

  // Interleave events for the timeline.
  type Event =
    | { kind: "stage"; at: Date; label: string; detail: string }
    | { kind: "whatsapp"; at: Date; label: string; detail: string; status: string };

  const events: Event[] = [
    ...client.stageTransitions.map<Event>((t) => ({
      kind: "stage",
      at: t.at,
      label: `${t.fromStage ? STAGE_TONE[t.fromStage].label : "Created"} → ${STAGE_TONE[t.toStage].label}`,
      detail: `${t.byUser?.name ?? "System"}${t.note ? ` — ${t.note}` : ""}`,
    })),
    ...client.whatsappMessages.map<Event>((m) => ({
      kind: "whatsapp",
      at: m.sentAt ?? m.createdAt,
      label: `WhatsApp ${m.direction.toLowerCase()}`,
      detail: m.body.split("\n")[0].slice(0, 120),
      status: m.status,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <div className="space-y-6">
      <Link
        href="/leads"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to leads
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl font-medium tracking-tight">{client.name}</h1>
            <StageBadge stage={client.stage} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Added {formatDistanceToNow(client.createdAt, { addSuffix: true })} · Source: {client.source.toLowerCase().replace("_", " ")}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main info + stage transition */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Core info
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <InfoRow icon={<User className="h-4 w-4" />} label="Name" value={client.name} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={client.phone} />
              <InfoRow icon={<User className="h-4 w-4" />} label="Age" value={client.age?.toString() ?? "—"} />
              <InfoRow icon={<MapPin className="h-4 w-4" />} label="Area" value={client.area ?? "—"} />
              <InfoRow icon={<Clock className="h-4 w-4" />} label="Duration" value={client.issueDuration ?? "—"} />
              <InfoRow icon={<User className="h-4 w-4" />} label="Severity" value={client.severity?.toString() ?? "—"} />
              <div className="col-span-2 space-y-1">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">Issue</p>
                <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm">{client.issueRefined ?? client.issue ?? "—"}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Scheduling
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {openCounselling && (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      Counselling · {format(openCounselling.scheduledAt, "dd MMM, HH:mm")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      with {openCounselling.counsellor.name}
                    </p>
                    {openCounselling.meetLink && (
                      <a
                        href={openCounselling.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block truncate text-xs font-medium text-primary hover:underline"
                      >
                        🔗 Meeting link
                      </a>
                    )}
                  </div>
                  <Link
                    href={`/leads/${client.id}/counselling/${openCounselling.id}/complete`}
                    className="shrink-0 text-sm text-primary hover:underline"
                  >
                    Mark done
                  </Link>
                </div>
              )}
              {openVisit && (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      Visit · {format(openVisit.scheduledAt, "dd MMM, HH:mm")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {openVisit.assignedHealer ? `with ${openVisit.assignedHealer.name}` : "unassigned healer"}
                    </p>
                  </div>
                  <Link
                    href={`/leads/${client.id}/visits/${openVisit.id}/complete`}
                    className="shrink-0 text-sm text-primary hover:underline"
                  >
                    Mark done
                  </Link>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {!openCounselling && (
                  <Link
                    href={`/leads/${client.id}/counselling/new`}
                    className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    + Schedule counselling
                  </Link>
                )}
                {(client.stage === "COUNSELING_DONE" || client.stage === "VISIT_DONE" || client.stage === "HEALING_ACTIVE") && (
                  <Link
                    href={`/leads/${client.id}/visits/new`}
                    className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    + Schedule visit
                  </Link>
                )}
              </div>

              {counsellings.length + visits.length === 0 && !openCounselling && !openVisit && (
                <p className="text-xs text-muted-foreground">
                  No counselling or visit scheduled yet.
                </p>
              )}

              {(counsellings.some((c) => c.doneAt) || visits.some((v) => v.visitedAt)) && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground">Past sessions</summary>
                  <ul className="mt-2 space-y-1">
                    {counsellings.filter((c) => c.doneAt).map((c) => (
                      <li key={c.id} className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        Counselling — {format(c.doneAt!, "dd MMM yyyy")}
                      </li>
                    ))}
                    {visits.filter((v) => v.visitedAt).map((v) => (
                      <li key={v.id} className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        Visit — {format(v.visitedAt!, "dd MMM yyyy")}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Move to next stage
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nextStages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This client is at the end of the pipeline.
                </p>
              ) : (
                <form action={transitionStageAction} className="space-y-3">
                  <input type="hidden" name="clientId" value={client.id} />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">From</span>
                    <StageBadge stage={client.stage} />
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <select
                      name="toStage"
                      required
                      defaultValue=""
                      className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="" disabled>Select next stage…</option>
                      {nextStages.map((s) => (
                        <option key={s} value={s}>{STAGE_TONE[s].label}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    name="note"
                    rows={2}
                    placeholder="Optional note about this transition…"
                    className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-16 resize-y"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Update stage
                  </button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Internal notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateLeadNotesAction} className="space-y-3">
                <input type="hidden" name="clientId" value={client.id} />
                <textarea
                  name="notes"
                  defaultValue={client.notes ?? ""}
                  rows={4}
                  className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-24 resize-y"
                  placeholder="Private notes — visible to staff only."
                />
                <button
                  type="submit"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Save notes
                </button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: assignment + credits + quick actions + timeline */}
        <div className="space-y-6">
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Wallet className="h-4 w-4" />
                Credits &amp; payments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className={"font-serif text-2xl font-medium " + (creditBalance <= 0 ? "text-destructive" : "text-foreground")}>
                  {creditBalance}
                </p>
              </div>
              {recentPayments.length > 0 && (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {recentPayments.slice(0, 3).map((p) => (
                    <li key={p.id} className="flex items-center justify-between">
                      <span>₹{p.amount.toLocaleString("en-IN")} · {p.status.toLowerCase()}</span>
                      <span>{format(p.createdAt, "dd MMM")}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  href={`/leads/${client.id}/payments/new`}
                  className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  + Payment
                </Link>
                <Link
                  href={`/leads/${client.id}/healing/new`}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Log healing
                </Link>
                <Link
                  href={`/leads/${client.id}/distant-healing`}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <MessagesSquare className="h-3.5 w-3.5" /> Distant healing
                </Link>
                <Link
                  href={`/leads/${client.id}/courses`}
                  className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Courses
                </Link>
              </div>
              {recentHealing.length > 0 && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground">Recent sessions</summary>
                  <ul className="mt-2 space-y-1">
                    {recentHealing.map((h) => (
                      <li key={h.id}>
                        {format(h.date, "dd MMM")} · {h.healer.name}
                        {h.creditUsed ? "" : " · complimentary"}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <UsersRound className="h-4 w-4" />
                Referrals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {client.referrer ? (
                <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Referred by</p>
                    <Link href={`/leads/${client.referrer.id}`} className="truncate font-medium hover:underline">
                      {client.referrer.name}
                    </Link>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{client.referrer.phone}</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No referrer recorded.</p>
              )}

              <div className="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Healing credits earned</p>
                  <p className="font-serif text-xl font-medium tabular-nums">{client.healingCreditsEarned}</p>
                </div>
                <Gift className="h-5 w-5 text-primary" aria-hidden />
              </div>

              {client.referrals.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                    Referrals made ({client.referrals.length})
                  </p>
                  <ul className="space-y-1.5">
                    {client.referrals.slice(0, 6).map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                        <Link href={`/leads/${r.id}`} className="min-w-0 truncate hover:underline">
                          {r.name}
                        </Link>
                        <StageBadge stage={r.stage} />
                      </li>
                    ))}
                  </ul>
                  {client.referrals.length > 6 && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      +{client.referrals.length - 6} more
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No referrals sent in yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Assigned to
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={assignLeadAction} className="space-y-3">
                <input type="hidden" name="clientId" value={client.id} />
                <select
                  name="assignedToId"
                  defaultValue={client.assignedToId ?? ""}
                  className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Unassigned</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Assign
                </button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MessagesSquare className="h-4 w-4" />
                Send WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={sendTemplateAction} className="space-y-3">
                <input type="hidden" name="clientId" value={client.id} />
                <select
                  name="templateName"
                  required
                  defaultValue=""
                  className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="" disabled>Choose template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.name}>{t.name.replace(/_/g, " ")}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Non-parameterised templates only. Variables can be filled from a deeper view later.
                </p>
                <button
                  type="submit"
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Send
                </button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {events.length === 0 && (
                <p className="text-xs text-muted-foreground">Nothing yet.</p>
              )}
              {events.slice(0, 20).map((e, i) => (
                <div key={i} className="border-l-2 border-border pl-3">
                  <p className="text-xs font-medium">
                    {e.label}
                    {e.kind === "whatsapp" && (
                      <span className="ml-1.5 text-muted-foreground">· {e.status.toLowerCase()}</span>
                    )}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{e.detail}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {format(e.at, "dd MMM yyyy, HH:mm")}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Soft-delete banner — visible to everyone (the lead is in a
          tombstone window). */}
      {client.deletedAt && (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/60">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="text-sm">
              <p className="font-medium text-amber-900">
                This client was soft-deleted on {format(client.deletedAt, "d MMM yyyy")}
              </p>
              <p className="mt-0.5 text-amber-900/80">
                Their portal access is revoked. Identifying fields will be
                anonymised by the nightly reconciler 30 days after deletion.
                Until then, an admin can restore them by clearing
                <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 text-[11px]">deletedAt</code>
                directly in the database.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Danger zone — admin only, only shown if the client isn't
          already soft-deleted. Requires a typed confirmation phrase
          (first name) to avoid accidental clicks. */}
      {viewerIsAdmin && !client.deletedAt && (
        <Card className="rounded-2xl border-destructive/30">
          <CardContent className="space-y-3 py-5">
            <div className="space-y-1">
              <p className="flex items-center gap-2 font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Danger zone — soft-delete this client
              </p>
              <p className="text-sm text-muted-foreground">
                Marks the client deleted and revokes their /me portal
                access immediately. Their healing history stays in the
                database (so healer revenue records are preserved) but
                identity fields will be anonymised by the nightly
                reconciler after 30 days. Medical-report files are
                deleted from S3 at that time too. Type
                <strong className="mx-1 text-foreground">{client.name.split(" ")[0]}</strong>
                to confirm.
              </p>
              {sp.error === "confirm_mismatch" && (
                <p className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
                  The confirmation phrase didn&apos;t match. Type the
                  client&apos;s first name exactly.
                </p>
              )}
              {sp.error === "forbidden" && (
                <p className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
                  Admin role required to soft-delete a client.
                </p>
              )}
            </div>
            <form action={softDeleteClientAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="clientId" value={client.id} />
              <input
                type="text"
                name="confirm"
                autoComplete="off"
                spellCheck={false}
                placeholder={`Type "${client.name.split(" ")[0]}" to confirm`}
                className="h-10 w-64 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <SubmitButton
                pendingLabel="Deleting…"
                className="inline-flex h-10 items-center gap-1.5 rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Soft-delete client
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
