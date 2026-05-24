// Coordinator inbox — Phase 1b MVP.
//
// One row per WhatsApp thread (per-client). Tabs filter by triage state:
//   • All open   — every active thread
//   • Mine       — assigned to the current user
//   • Waiting    — unreadCount > 0 (the centre owes a response)
//   • Snoozed    — paused with a wake time
//   • Escalated  — flagged for admin attention
//   • Resolved   — closed out (last 30 days)
//   • Unknown    — orphan inbound messages (clientId IS NULL)

import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  MessagesSquare,
  Inbox as InboxIcon,
  AlertTriangle,
  Clock,
  CheckCircle,
  HelpCircle,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { canUseInbox } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { OrphanAttachRow } from "@/components/orphan-attach-row";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inbox · LEC CRM" };

type Tab = "open" | "mine" | "waiting" | "snoozed" | "escalated" | "resolved" | "unknown";

const TABS: Array<{ key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "open",      label: "All open",  icon: InboxIcon },
  { key: "mine",      label: "Mine",      icon: MessagesSquare },
  { key: "waiting",   label: "Waiting",   icon: Clock },
  { key: "snoozed",   label: "Snoozed",   icon: Clock },
  { key: "escalated", label: "Escalated", icon: AlertTriangle },
  { key: "resolved",  label: "Resolved",  icon: CheckCircle },
  { key: "unknown",   label: "Unknown",   icon: HelpCircle },
];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !canUseInbox(session.user.role)) redirect("/dashboard");

  const sp = await searchParams;
  const tab: Tab = (TABS.find((t) => t.key === sp.tab)?.key) ?? "open";

  // Per-tab counts shown as small numbers on the tabs themselves.
  const [openCount, mineCount, waitingCount, snoozedCount, escalatedCount, unknownCount] = await Promise.all([
    prisma.whatsAppThread.count({ where: { status: "OPEN" } }),
    prisma.whatsAppThread.count({ where: { status: "OPEN", assigneeId: session.user.id } }),
    prisma.whatsAppThread.count({ where: { status: "OPEN", unreadCount: { gt: 0 } } }),
    prisma.whatsAppThread.count({ where: { status: "SNOOZED" } }),
    prisma.whatsAppThread.count({ where: { escalated: true } }),
    prisma.whatsAppMessage.groupBy({
      by: ["phone"],
      where: { clientId: null, direction: "INBOUND" },
      _count: { _all: true },
    }).then((rows) => rows.length),
  ]);

  const tabCounts: Record<Tab, number> = {
    open: openCount,
    mine: mineCount,
    waiting: waitingCount,
    snoozed: snoozedCount,
    escalated: escalatedCount,
    resolved: 0, // not surfaced (always available)
    unknown: unknownCount,
  };

  // ── Tab-specific query ──
  // Unknown is rendered from WhatsAppMessage groupBy, not WhatsAppThread.
  let threads: Array<{
    clientId: string;
    clientName: string;
    clientPhone: string;
    status: string;
    assigneeId: string | null;
    assigneeName: string | null;
    snoozeUntil: Date | null;
    escalated: boolean;
    lastInboundAt: Date | null;
    lastOutboundAt: Date | null;
    unreadCount: number;
    lastMessageBody: string | null;
  }> = [];
  let unknownGroups: Array<{ phone: string; count: number; latestAt: Date; latestBody: string }> = [];

  if (tab === "unknown") {
    const groups = await prisma.whatsAppMessage.groupBy({
      by: ["phone"],
      where: { clientId: null, direction: "INBOUND" },
      _count: { _all: true },
      _max: { sentAt: true },
      orderBy: { _max: { sentAt: "desc" } },
      take: 50,
    });
    // For each phone, grab the latest message body for context.
    const latestBodies = await Promise.all(
      groups.map((g) =>
        prisma.whatsAppMessage.findFirst({
          where: { phone: g.phone, clientId: null, direction: "INBOUND" },
          orderBy: { sentAt: "desc" },
          select: { body: true },
        }),
      ),
    );
    unknownGroups = groups.map((g, i) => ({
      phone: g.phone,
      count: g._count._all,
      latestAt: g._max.sentAt ?? new Date(0),
      latestBody: latestBodies[i]?.body ?? "",
    }));
  } else {
    // Per-tab where clause; rest of the query is identical so we get
    // a single inferred row shape (no cast needed).
    const where =
      tab === "mine"      ? { status: "OPEN" as const, assigneeId: session.user.id }
    : tab === "waiting"   ? { status: "OPEN" as const, unreadCount: { gt: 0 } }
    : tab === "snoozed"   ? { status: "SNOOZED" as const }
    : tab === "escalated" ? { escalated: true }
    : tab === "resolved"  ? {
        status: "RESOLVED" as const,
        resolvedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }
    : { status: "OPEN" as const };

    const orderBy =
      tab === "waiting" ? [{ lastInboundAt: "desc" as const }]
    : tab === "snoozed" ? [{ snoozeUntil: "asc" as const }]
    :                     [{ updatedAt: "desc" as const }];

    const rows = await prisma.whatsAppThread.findMany({
      where,
      take: 100,
      orderBy,
      include: {
        client: { select: { id: true, name: true, phone: true } },
        assignee: { select: { id: true, name: true } },
      },
    });

    // Pull the latest message body for each thread for one-line preview.
    const previews = await Promise.all(
      rows.map((r) =>
        prisma.whatsAppMessage.findFirst({
          where: { clientId: r.clientId },
          orderBy: { sentAt: "desc" },
          select: { body: true },
        }),
      ),
    );

    threads = rows.map((r, i) => ({
      clientId: r.clientId,
      clientName: r.client.name,
      clientPhone: r.client.phone,
      status: r.status,
      assigneeId: r.assigneeId,
      assigneeName: r.assignee?.name ?? null,
      snoozeUntil: r.snoozeUntil,
      escalated: r.escalated,
      lastInboundAt: r.lastInboundAt,
      lastOutboundAt: r.lastOutboundAt,
      unreadCount: r.unreadCount,
      lastMessageBody: previews[i]?.body ?? null,
    }));
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <InboxIcon className="h-7 w-7 text-primary" />
          Inbox
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Centre WhatsApp conversations. Pick up a thread to reply, snooze
          for later, escalate to admin, or resolve once handled.
        </p>
      </header>

      {/* Tabs */}
      <div className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.key === tab;
          const count = tabCounts[t.key];
          return (
            <Link
              key={t.key}
              href={`/inbox?tab=${t.key}`}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-foreground text-background"
                  : "bg-muted text-foreground hover:bg-muted/70"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-background/20" : "bg-foreground/10"}`}>
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {tab === "unknown" ? (
        <Card className="rounded-xl">
          <CardContent className="py-2">
            {unknownGroups.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No unknown senders — every inbound message is matched to a client.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {unknownGroups.map((g) => (
                  <OrphanAttachRow key={g.phone} {...g} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl">
          <CardContent className="py-2">
            {threads.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing here. Empty inbox is a happy inbox.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {threads.map((t) => (
                  <li key={t.clientId}>
                    <Link
                      href={`/inbox/${t.clientId}`}
                      className="flex items-start gap-3 px-2 py-3 transition-colors hover:bg-muted/30"
                    >
                      {/* Unread dot */}
                      <span
                        className={`mt-2 inline-block h-2 w-2 rounded-full ${
                          t.unreadCount > 0 ? "bg-primary" : "bg-transparent"
                        }`}
                        aria-hidden
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {t.clientName}
                            {t.escalated && (
                              <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Escalated
                              </span>
                            )}
                          </p>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {t.lastInboundAt
                              ? formatDistanceToNow(t.lastInboundAt, { addSuffix: true })
                              : "—"}
                          </span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {t.clientPhone}
                          {t.assigneeName && <> · assigned to {t.assigneeName}</>}
                          {t.status === "SNOOZED" && t.snoozeUntil && (
                            <> · snoozed until {formatDistanceToNow(t.snoozeUntil, { addSuffix: true })}</>
                          )}
                        </p>
                        {t.lastMessageBody && (
                          <p className="mt-1 truncate text-xs text-muted-foreground/80">
                            {t.lastMessageBody}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
