"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { GripVertical } from "lucide-react";
import type { PipelineStage } from "@prisma/client";
import { STAGE_TONE, allowedNextStages } from "@/lib/pipeline";
import { kanbanMoveAction } from "@/app/(app)/leads/actions";

type LeadCard = {
  id: string;
  name: string;
  phone: string;
  stage: PipelineStage;
  createdAt: string; // ISO
  assignedToName: string | null;
  leadScore: number;
};

const COLUMNS: ReadonlyArray<PipelineStage> = [
  "NEW",
  "CONTACTED",
  "COUNSELING_SCHEDULED",
  "COUNSELING_DONE",
  "VISIT_SCHEDULED",
  "VISIT_DONE",
  "HEALING_ACTIVE",
  "CONVERTED",
];

export function KanbanBoard({ leads: initial }: { leads: ReadonlyArray<LeadCard> }) {
  const [leads, setLeads] = useState<LeadCard[]>(() => initial.slice());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<PipelineStage | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const byStage = useMemo(() => {
    const m = new Map<PipelineStage, LeadCard[]>();
    for (const c of COLUMNS) m.set(c, []);
    for (const l of leads) {
      if (m.has(l.stage)) m.get(l.stage)!.push(l);
    }
    return m;
  }, [leads]);

  const move = (lead: LeadCard, toStage: PipelineStage) => {
    if (lead.stage === toStage) return;
    const allowed = allowedNextStages(lead.stage);
    if (!allowed.includes(toStage)) {
      toast.error(
        `Can't move from "${STAGE_TONE[lead.stage].label}" to "${STAGE_TONE[toStage].label}".`,
        {
          description: allowed.length
            ? `Allowed next: ${allowed.map((s) => STAGE_TONE[s].label).join(", ")}`
            : "This lead is at the end of the pipeline.",
        },
      );
      return;
    }
    // Optimistic update
    const fromStage = lead.stage;
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage: toStage } : l)));
    startTransition(async () => {
      try {
        await kanbanMoveAction({ clientId: lead.id, toStage, fromStage });
        toast.success(`Moved ${lead.name} → ${STAGE_TONE[toStage].label}`);
        router.refresh();
      } catch (err) {
        // Revert
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage: fromStage } : l)));
        toast.error(err instanceof Error ? err.message : "Move failed");
      }
    });
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max gap-3">
        {COLUMNS.map((stage) => {
          const tone = STAGE_TONE[stage];
          const list = byStage.get(stage) ?? [];
          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverColumn(stage);
              }}
              onDragLeave={() => setDragOverColumn((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverColumn(null);
                const id = e.dataTransfer.getData("text/plain");
                const lead = leads.find((l) => l.id === id);
                if (lead) move(lead, stage);
              }}
              className={
                "flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30 transition-colors " +
                (dragOverColumn === stage ? "ring-2 ring-primary/50" : "")
              }
            >
              <div className="sticky top-0 z-10 rounded-t-xl border-b border-border bg-card px-3 py-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tone.bg} ${tone.fg}`}
                  >
                    {tone.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{list.length}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 p-2">
                {list.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    Empty
                  </p>
                )}
                {list.slice(0, 30).map((lead) => (
                  <article
                    key={lead.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", lead.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggedId(lead.id);
                    }}
                    onDragEnd={() => setDraggedId(null)}
                    className={
                      "group cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm transition-opacity active:cursor-grabbing " +
                      (draggedId === lead.id ? "opacity-50" : "opacity-100")
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="flex min-w-0 items-start gap-2"
                      >
                        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium hover:underline">{lead.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{lead.phone}</p>
                        </div>
                      </Link>
                      {lead.leadScore > 0 && (
                        <span
                          className={
                            "shrink-0 rounded-full px-1.5 text-[10px] font-medium " +
                            (lead.leadScore >= 50
                              ? "bg-emerald-100 text-emerald-900"
                              : lead.leadScore >= 30
                                ? "bg-amber-100 text-amber-900"
                                : "bg-muted text-muted-foreground")
                          }
                          title="Lead score"
                        >
                          ★{lead.leadScore}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}</span>
                      {lead.assignedToName && <span>→ {lead.assignedToName}</span>}
                    </div>
                    {/* Mobile-friendly fallback: tap to choose target stage */}
                    <details className="mt-2 sm:hidden">
                      <summary className="cursor-pointer text-[11px] text-primary">Move to…</summary>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {allowedNextStages(lead.stage).map((next) => (
                          <button
                            key={next}
                            type="button"
                            onClick={() => move(lead, next)}
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STAGE_TONE[next].bg} ${STAGE_TONE[next].fg}`}
                          >
                            {STAGE_TONE[next].label}
                          </button>
                        ))}
                      </div>
                    </details>
                  </article>
                ))}
                {list.length > 30 && (
                  <p className="px-2 py-2 text-center text-xs text-muted-foreground">
                    +{list.length - 30} more — narrow filters or open list view
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
