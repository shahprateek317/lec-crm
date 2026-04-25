import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { STAGES, STAGE_TONE } from "@/lib/pipeline";
import { StageBadge } from "@/components/leads/stage-badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { formatDistanceToNow } from "date-fns";
import { Plus, Search, Users, X } from "lucide-react";
import type { PipelineStage, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads & Clients" };

type Query = {
  q?: string;
  stage?: string;
  assignee?: string;
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const sp = await searchParams;
  const where: Prisma.ClientWhereInput = {};

  if (sp.q) {
    where.OR = [
      { name: { contains: sp.q, mode: "insensitive" } },
      { phone: { contains: sp.q } },
      { email: { contains: sp.q, mode: "insensitive" } },
      { issue: { contains: sp.q, mode: "insensitive" } },
    ];
  }
  if (sp.stage && STAGES.includes(sp.stage as PipelineStage)) {
    where.stage = sp.stage as PipelineStage;
  }
  if (sp.assignee === "unassigned") {
    where.assignedToId = null;
  } else if (sp.assignee) {
    where.assignedToId = sp.assignee;
  }

  const [leads, stageCounts, staff] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    prisma.client.groupBy({ by: ["stage"], _count: { _all: true } }),
    prisma.user.findMany({
      where: { active: true, role: { in: ["COORDINATOR", "COUNSELLOR", "HEALER"] } },
      orderBy: { name: "asc" },
    }),
  ]);

  const countByStage = new Map(stageCounts.map((s) => [s.stage, s._count._all]));

  // Compose a chip for each active filter that's clickable to remove that one.
  const activeChips: Array<{ label: string; href: string }> = [];
  const without = (k: keyof Query) => {
    const next: Record<string, string> = {};
    if (sp.q && k !== "q") next.q = sp.q;
    if (sp.stage && k !== "stage") next.stage = sp.stage;
    if (sp.assignee && k !== "assignee") next.assignee = sp.assignee;
    const qs = new URLSearchParams(next).toString();
    return qs ? `/leads?${qs}` : "/leads";
  };
  if (sp.q) activeChips.push({ label: `Search: "${sp.q}"`, href: without("q") });
  if (sp.stage && STAGES.includes(sp.stage as PipelineStage)) {
    activeChips.push({ label: `Stage: ${STAGE_TONE[sp.stage as PipelineStage].label}`, href: without("stage") });
  }
  if (sp.assignee === "unassigned") {
    activeChips.push({ label: "Unassigned", href: without("assignee") });
  } else if (sp.assignee) {
    const a = staff.find((s) => s.id === sp.assignee);
    if (a) activeChips.push({ label: `Assigned: ${a.name}`, href: without("assignee") });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight">Leads &amp; Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every enquiry, gently tracked from first contact to conversion.
          </p>
        </div>
        <Link
          href="/leads/new"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add lead
        </Link>
      </header>

      {/* Filters */}
      <form
        method="GET"
        className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3"
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search name, phone, email, issue…"
            className="flex h-10 w-full rounded-lg border border-input bg-transparent pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          name="stage"
          defaultValue={sp.stage ?? ""}
          className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_TONE[s].label} ({countByStage.get(s) ?? 0})
            </option>
          ))}
        </select>
        <select
          name="assignee"
          defaultValue={sp.assignee ?? ""}
          className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Any assignee</option>
          <option value="unassigned">Unassigned</option>
          {staff.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Apply
        </button>
      </form>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filters:</span>
          {activeChips.map((c) => (
            <Link
              key={c.label}
              href={c.href}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15"
            >
              {c.label}
              <X className="h-3 w-3" />
            </Link>
          ))}
          <Link href="/leads" className="text-xs text-muted-foreground hover:text-foreground">
            Clear all
          </Link>
        </div>
      )}

      <Card className="rounded-xl">
        <CardContent className="divide-y divide-border p-0">
          {leads.length === 0 && (
            activeChips.length > 0 ? (
              <EmptyState
                icon={<Search className="h-5 w-5" />}
                title="No leads match these filters"
                description="Try removing a filter, broadening the stage, or searching by phone number."
                action={{ href: "/leads", label: "Clear filters" }}
              />
            ) : (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title="No leads yet"
                description="Add a lead manually or share the public enquiry form so leads come in automatically."
                action={{ href: "/leads/new", label: "Add the first lead" }}
              />
            )
          )}
          {leads.map((lead) => (
            <Link
              key={lead.id}
              href={`/leads/${lead.id}`}
              className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/60"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{lead.name}</p>
                  <StageBadge stage={lead.stage} />
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {lead.phone} · {lead.area ?? "—"} · {lead.issue ?? "no issue noted"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(lead.createdAt, { addSuffix: true })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {lead.assignedTo ? `→ ${lead.assignedTo.name}` : "unassigned"}
                </span>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      {leads.length >= 200 && (
        <p className="text-center text-xs text-muted-foreground">
          Showing the 200 most recent. Narrow the filters to find older records.
        </p>
      )}
    </div>
  );
}
