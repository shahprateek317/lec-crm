// Inbox thread detail. Mirrors the Front / Help Scout layout:
//   • Message history (reverse-chronological), inbound vs outbound bubbles.
//   • Toolbar: assign-to-me, snooze, escalate, resolve, reopen.
//   • Reply panel: template picker (always) + free-text (only inside
//     the 24h customer-care window).

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import {
  ChevronLeft,
  CheckCircle,
  AlertTriangle,
  Clock,
  UserCheck,
  RotateCw,
  Send,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { canUseInbox } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { customerCareWindow } from "@/lib/customer-care-window";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { FlashToaster } from "@/components/flash-toaster";
import {
  assignToMeAction,
  unassignAction,
  resolveThreadAction,
  reopenThreadAction,
  escalateThreadAction,
  snoozeThreadAction,
  sendQuickReplyTextAction,
  sendQuickReplyTemplateAction,
  markThreadReadAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function InboxThreadPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const session = await auth();
  if (!session?.user || !canUseInbox(session.user.role)) redirect("/dashboard");

  const { clientId } = await params;

  // Mark read on view + audit (DPDP: who looked at this client's transcript).
  await markThreadReadAction(clientId).catch(() => {});

  const [client, thread, messages, templates, coordinators] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, phone: true, email: true, stage: true, leadScore: true },
    }),
    prisma.whatsAppThread.findUnique({
      where: { clientId },
      include: { assignee: { select: { id: true, name: true } } },
    }),
    prisma.whatsAppMessage.findMany({
      where: { clientId },
      orderBy: { sentAt: "asc" },
      take: 200,
      select: {
        id: true,
        direction: true,
        body: true,
        status: true,
        sentAt: true,
        templateId: true,
      },
    }),
    prisma.whatsAppTemplate.findMany({
      where: { active: true, category: { not: "AUTHENTICATION" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, bodyTemplate: true },
    }),
    prisma.user.findMany({
      where: { active: true, role: { in: ["COORDINATOR", "COUNSELLOR", "SENIOR_COUNSELLOR"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!client) notFound();

  const window = customerCareWindow(thread?.lastInboundAt);
  const isAssignedToMe = thread?.assigneeId === session.user.id;

  return (
    <div className="space-y-4">
      <FlashToaster />

      <Link
        href="/inbox"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to inbox
      </Link>

      {/* Header: identity + assignment + status */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-tight">{client.name}</h1>
          <p className="text-sm text-muted-foreground">
            {client.phone} ·{" "}
            <Link href={`/leads/${client.id}`} className="text-primary hover:underline">
              Open lead profile
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {thread?.escalated && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
              <AlertTriangle className="h-3 w-3" />
              Escalated
            </span>
          )}
          {thread?.status === "SNOOZED" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-900">
              <Clock className="h-3 w-3" />
              Snoozed
            </span>
          )}
          {thread?.status === "RESOLVED" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-900">
              <CheckCircle className="h-3 w-3" />
              Resolved
            </span>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <Card className="rounded-xl">
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          {!isAssignedToMe ? (
            <form action={assignToMeAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <SubmitButton
                pendingLabel="Assigning…"
                className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <UserCheck className="h-3 w-3" />
                Assign to me
              </SubmitButton>
            </form>
          ) : (
            <form action={unassignAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <SubmitButton
                pendingLabel="…"
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
              >
                Unassign me
              </SubmitButton>
            </form>
          )}

          {thread?.status === "RESOLVED" ? (
            <form action={reopenThreadAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <SubmitButton
                pendingLabel="…"
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
              >
                <RotateCw className="h-3 w-3" />
                Reopen
              </SubmitButton>
            </form>
          ) : (
            <form action={resolveThreadAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <SubmitButton
                pendingLabel="…"
                className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
              >
                <CheckCircle className="h-3 w-3" />
                Resolve
              </SubmitButton>
            </form>
          )}

          {!thread?.escalated && (
            <form action={escalateThreadAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <SubmitButton
                pendingLabel="…"
                className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-medium text-amber-900 hover:bg-amber-100"
              >
                <AlertTriangle className="h-3 w-3" />
                Escalate
              </SubmitButton>
            </form>
          )}

          {/* Snooze presets */}
          <form action={snoozeThreadAction} className="inline-flex items-center gap-1">
            <input type="hidden" name="clientId" value={clientId} />
            <select
              name="preset"
              defaultValue="1h"
              className="h-8 rounded-md border border-border bg-card px-2 text-xs"
            >
              <option value="30m">30 min</option>
              <option value="1h">1 hour</option>
              <option value="4h">4 hours</option>
              <option value="1d">1 day</option>
              <option value="3d">3 days</option>
            </select>
            <SubmitButton
              pendingLabel="…"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
            >
              <Clock className="h-3 w-3" />
              Snooze
            </SubmitButton>
          </form>

          {thread?.assignee && !isAssignedToMe && (
            <span className="ml-auto text-xs text-muted-foreground">
              Assigned to {thread.assignee.name}
            </span>
          )}
        </CardContent>
      </Card>

      {/* Conversation */}
      <Card className="rounded-xl">
        <CardContent className="space-y-3 py-4">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No messages yet.
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.direction === "INBOUND" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                    m.direction === "INBOUND"
                      ? "bg-muted text-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      m.direction === "INBOUND"
                        ? "text-muted-foreground"
                        : "text-primary-foreground/70"
                    }`}
                  >
                    {m.sentAt ? format(m.sentAt, "d MMM · HH:mm") : "—"}
                    {m.direction === "OUTBOUND" && (
                      <> · {m.status.toLowerCase()}{m.templateId ? " · template" : ""}</>
                    )}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Reply panel */}
      <Card className="rounded-xl border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5 text-primary" />
              Reply
            </span>
            <span className={window.open ? "text-emerald-700" : "text-amber-700"}>
              {window.label}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          {window.open && (
            <form action={sendQuickReplyTextAction} className="space-y-2">
              <input type="hidden" name="clientId" value={clientId} />
              <textarea
                name="body"
                required
                rows={3}
                placeholder="Type a reply…"
                className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <SubmitButton
                pendingLabel="Sending…"
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </SubmitButton>
            </form>
          )}

          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">
              {window.open ? "Or pick a template" : "Pick a template to re-engage"}
            </p>
            <form action={sendQuickReplyTemplateAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="clientId" value={clientId} />
              <select
                name="templateName"
                required
                defaultValue=""
                className="h-9 rounded-md border border-border bg-card px-2 text-sm"
              >
                <option value="" disabled>Choose a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
              <SubmitButton
                pendingLabel="Sending…"
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
              >
                <Send className="h-3.5 w-3.5" />
                Send template
              </SubmitButton>
            </form>
            <p className="text-[11px] text-muted-foreground">
              Templates with variables (eg payment link, healer name) are
              wired via the /leads/[id] detail page — quick-reply uses
              defaults. Coordinators with a variable-heavy reply should
              jump to the lead page for the full template form.
            </p>
          </div>

          {/* Unused — present for typecheck of coordinators list, future "assign to colleague" UI */}
          <input type="hidden" name="_coordinators_count" value={coordinators.length} hidden readOnly />
        </CardContent>
      </Card>
    </div>
  );
}
