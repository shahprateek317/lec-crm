"use client";

import { cn } from "@/lib/utils";
import type { ChakraKey, ChakraState } from "@/lib/healing";
import { CHAKRA_LABEL, CHAKRA_STATES, STATE_LABEL } from "@/lib/healing";

const TONE: Record<ChakraState, string> = {
  BALANCED:   "bg-emerald-100 text-emerald-900 border-emerald-300",
  OVERACTIVE: "bg-amber-100 text-amber-900 border-amber-300",
  BLOCKED:    "bg-rose-100 text-rose-900 border-rose-300",
  WEAK:       "bg-blue-100 text-blue-900 border-blue-300",
};

/**
 * Single row for a chakra state: name on the left, four single-select
 * pills on the right. Designed to fit ten rows on a phone screen without
 * scrolling within the section.
 */
export function ChakraStateRow({
  chakra,
  value,
  onChange,
}: {
  chakra: ChakraKey;
  value?: ChakraState;
  onChange: (next: ChakraState | undefined) => void;
}) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-center gap-3 sm:grid-cols-[8.5rem_1fr]">
      <p className="text-xs font-medium text-foreground sm:text-sm">{CHAKRA_LABEL[chakra]}</p>
      <div className="flex flex-wrap gap-1">
        {CHAKRA_STATES.map((s) => {
          const on = value === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? undefined : s)}
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-2.5 text-[11px] font-medium transition-colors sm:text-xs",
                on
                  ? TONE[s]
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {STATE_LABEL[s]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
