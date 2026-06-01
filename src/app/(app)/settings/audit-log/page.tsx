// Admin audit-log viewer.
//
// Reads append-only AuditLog rows. Every place we touch sensitive data
// (Documents, WhatsApp threads, Healing sessions, Client export, Client
// soft/hard delete, Cert verify) writes an entry; this page is the only
// place anyone reads them.
//
// Filters (all optional, all combinable, all encoded in the URL so the
// page is bookmarkable):
//   - action      drop-down of AuditAction enum values
//   - targetType  free-text contains (Client / Document / HealingSession / ...)
//   - actorId     drop-down of users who have written at least one entry
//   - from / to   inclusive day boundaries (ISO date)
//
// Pagination: offset/limit, 50/page. AuditLog is admin-only and rarely
// hit, so offset is fine — cursor pagination would be premature.

import Link from "next/link";
import { redirect } from "next/navigation";
import { format, formatDistanceToNow, parseISO, startOfDay, endOfDay } from "date-fns";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
import type { AuditAction, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log · Settings" };

const PAGE_SIZE = 50;

const ALL_ACTIONS: AuditAction[] = [
  "DOCUMENT_VIEWED",
  "DOCUMENT_DOWNLOADED",
  "DOCUMENT_DELETED",
  "CLIENT_DATA_EXPORTED",
  "CLIENT_SOFT_DELETED",
  "CLIENT_HARD_DELETED",
  "WHATSAPP_THREAD_OPENED",
  "HEALING_SESSION_VIEWED",
  "USER_CREATED",
  "USER_DISABLED",
  "USER_ROLE_CHANGED",
  "SETTING_CHANGED",
  "CERT_VERIFIED",
];

// Friendlier labels (matches the enum values 1:1 — show readable names).
const ACTION_LABEL: Record<AuditAction, string> = {
  DOCUMENT_VIEWED:        "Document viewed",
  DOCUMENT_DOWNLOADED:    "Document downloaded",
  DOCUMENT_DELETED:       "Document deleted",
  CLIENT_DATA_EXPORTED:   "Client data exported",
  CLIENT_SOFT_DELETED:    "Client soft-deleted",
  CLIENT_HARD_DELETED:    "Client hard-deleted",
  WHATSAPP_THREAD_OPENED: "WhatsApp thread opened",
  HEALING_SESSION_VIEWED: "Healing session viewed",
  USER_CREATED:           "User created",
  USER_DISABLED:          "User disabled",
  USER_ROLE_CHANGED:      "User role changed",
  SETTING_CHANGED:        "Setting changed",
  CERT_VERIFIED:          "Certification verified",
};

type SearchParams = {
  action?: string;
  actorId?: string;
  targetType?: string;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  page?: string;
};

function parseDateOrNull(s: string | undefined): Date | null {
  if (!s) return null;
  try { return parseISO(s); } catch { return null; }
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?callbackUrl=/settings/audit-log");
  if (!isAdmin(session.user.role)) redirect("/dashboard");

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const action = (ALL_ACTIONS as string[]).includes(sp.action ?? "") ? (sp.action as AuditAction) : null;
  const actorId = sp.actorId?.trim() || null;
  const targetType = sp.targetType?.trim() || null;
  const fromDate = parseDateOrNull(sp.from);
  const toDate = parseDateOrNull(sp.to);

  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(actorId ? { actorId } : {}),
    ...(targetType ? { targetType: { contains: targetType, mode: "insensitive" as const } } : {}),
    ...(fromDate || toDate
      ? {
          at: {
            ...(fromDate ? { gte: startOfDay(fromDate) } : {}),
            ...(toDate ? { lte: endOfDay(toDate) } : {}),
          },
        }
      : {}),
  };

  const [entries, totalCount, actors] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { at: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        actor:       { select: { id: true, name: true, role: true } },
        actorClient: { select: { id: true, name: true } },
      },
    }),
    prisma.auditLog.count({ where }),
    // Distinct actors who have ever written an entry — used to populate
    // the dropdown. Cap at 200 to keep the query cheap.
    prisma.user.findMany({
      where: { auditLogEntries: { some: {} } },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const buildHref = (overrides: Partial<SearchParams>): string => {
    const u = new URLSearchParams();
    const merged = { ...sp, ...overrides };
    if (merged.action) u.set("action", merged.action);
    if (merged.actorId) u.set("actorId", merged.actorId);
    if (merged.targetType) u.set("targetType", merged.targetType);
    if (merged.from) u.set("from", merged.from);
    if (merged.to) u.set("to", merged.to);
    if (merged.page && Number(merged.page) > 1) u.set("page", String(merged.page));
    const qs = u.toString();
    return qs ? `/settings/audit-log?${qs}` : "/settings/audit-log";
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
            <ClipboardList className="h-7 w-7 text-primary" />
            Audit log
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Who accessed what, and when. Every document view, WhatsApp
            thread open, healing-session drill-down, and admin action
            lands here. Append-only — entries can&apos;t be edited or deleted.
          </p>
        </div>
        <Link
          href="/settings"
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
        >
          ← Settings
        </Link>
      </header>

      {/* Filters */}
      <Card className="rounded-xl">
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-5" method="GET">
            <label className="space-y-1 text-xs">
              <span className="font-medium text-muted-foreground">Action</span>
              <select
                name="action"
                defaultValue={action ?? ""}
                className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm"
              >
                <option value="">All</option>
                {ALL_ACTIONS.map((a) => (
                  <option key={a} value={a}>{ACTION_LABEL[a]}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium text-muted-foreground">Actor</span>
              <select
                name="actorId"
                defaultValue={actorId ?? ""}
                className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm"
              >
                <option value="">Anyone</option>
                {actors.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium text-muted-foreground">Target type</span>
              <input
                name="targetType"
                defaultValue={targetType ?? ""}
                placeholder="Client / Document / …"
                className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium text-muted-foreground">From</span>
              <input
                type="date"
                name="from"
                defaultValue={sp.from ?? ""}
                className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium text-muted-foreground">To</span>
              <input
                type="date"
                name="to"
                defaultValue={sp.to ?? ""}
                className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm"
              />
            </label>
            <div className="md:col-span-5 flex items-center justify-end gap-2">
              <Link
                href="/settings/audit-log"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Reset
              </Link>
              <button
                type="submit"
                className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground/90"
              >
                Apply filters
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="rounded-xl">
        <CardContent className="px-3 py-2">
          {entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No entries match these filters. Try widening the date range or
              clearing actor / action.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-medium">When</th>
                  <th className="px-2 py-2 font-medium">Actor</th>
                  <th className="px-2 py-2 font-medium">Action</th>
                  <th className="px-2 py-2 font-medium">Target</th>
                  <th className="px-2 py-2 font-medium">IP</th>
                  <th className="px-2 py-2 font-medium">Meta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td className="px-2 py-2 align-top text-xs text-muted-foreground" title={format(e.at, "PPp")}>
                      {formatDistanceToNow(e.at, { addSuffix: true })}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <div className="text-sm font-medium text-foreground">
                        {e.actor?.name ?? e.actorClient?.name ?? e.actorType}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {e.actor?.role ?? e.actorType}
                      </div>
                    </td>
                    <td className="px-2 py-2 align-top">
                      <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                        {ACTION_LABEL[e.action] ?? e.action}
                      </span>
                    </td>
                    <td className="px-2 py-2 align-top text-xs">
                      <span className="text-muted-foreground">{e.targetType}</span>
                      <span className="ml-1 font-mono text-[11px] text-foreground/80">{e.targetId.slice(0, 12)}…</span>
                    </td>
                    <td className="px-2 py-2 align-top text-[11px] font-mono text-muted-foreground">
                      {e.ip ?? "—"}
                    </td>
                    <td className="px-2 py-2 align-top">
                      {e.meta ? (
                        <details className="text-[11px]">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            view
                          </summary>
                          <pre className="mt-1 max-w-md overflow-x-auto rounded bg-muted p-2 text-[10px] leading-snug">
                            {JSON.stringify(e.meta, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>
            {totalCount.toLocaleString()} {totalCount === 1 ? "entry" : "entries"}
            {totalPages > 1 && ` · page ${page} of ${totalPages}`}
          </span>
          <div className="flex items-center gap-1">
            {page > 1 && (
              <Link
                href={buildHref({ page: String(page - 1) })}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 hover:bg-muted"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildHref({ page: String(page + 1) })}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 hover:bg-muted"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
