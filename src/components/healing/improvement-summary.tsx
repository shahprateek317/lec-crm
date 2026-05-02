"use client";

import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  CHAKRA_LABEL,
  STATE_LABEL,
  computeImprovement,
  type ChakraStateMap,
} from "@/lib/healing";

/**
 * Live improvement preview shown beneath the "after" section. Recomputes
 * as the user toggles after-states. Drives the same number that the server
 * action stores in HealingSession.improvementScore.
 */
export function ImprovementSummary({
  before,
  after,
}: {
  before: ChakraStateMap;
  after: ChakraStateMap;
}) {
  const { total, perChakra } = computeImprovement(before, after);
  const tone =
    total > 0 ? "text-emerald-700" : total < 0 ? "text-rose-700" : "text-muted-foreground";
  const Icon = total > 0 ? TrendingUp : total < 0 ? TrendingDown : Minus;

  if (perChakra.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Mark chakra states above to see the improvement summary.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Improvement
          </p>
          <p className={`mt-1 font-serif text-2xl font-medium ${tone}`}>
            {total > 0 ? "+" : ""}
            {total}
          </p>
        </div>
        <Icon className={`h-8 w-8 ${tone}`} />
      </div>

      <ul className="space-y-1.5">
        {perChakra
          .sort((a, b) => b.delta - a.delta)
          .map((p) => {
            const itemTone =
              p.delta > 0 ? "text-emerald-700" : p.delta < 0 ? "text-rose-700" : "text-muted-foreground";
            return (
              <li
                key={p.key}
                className="flex items-center justify-between gap-2 rounded-lg bg-card px-3 py-1.5 text-xs ring-1 ring-border"
              >
                <span className="font-medium">{CHAKRA_LABEL[p.key]}</span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span>{p.before ? STATE_LABEL[p.before] : "—"}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>{p.after ? STATE_LABEL[p.after] : "—"}</span>
                  <span className={`ml-2 font-medium ${itemTone}`}>
                    {p.delta > 0 ? `+${p.delta}` : p.delta}
                  </span>
                </span>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
