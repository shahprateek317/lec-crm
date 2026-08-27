"use client";

import { useState } from "react";
import { CHAKRA_KEYS, CHAKRA_LABEL, CHAKRA_STATES, STATE_LABEL, type ChakraKey, type ChakraState, type ChakraStateMap } from "@/lib/healing";
import { cn } from "@/lib/utils";

const inputCls =
  "flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const TONE: Record<ChakraState, string> = {
  BALANCED:   "bg-emerald-100 text-emerald-900 border-emerald-300",
  OVERACTIVE: "bg-amber-100 text-amber-900 border-amber-300",
  BLOCKED:    "bg-rose-100 text-rose-900 border-rose-300",
  WEAK:       "bg-blue-100 text-blue-900 border-blue-300",
};

function StatePills({ value, onChange }: { value?: ChakraState; onChange: (v: ChakraState | undefined) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {CHAKRA_STATES.map((s) => {
        const on = value === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(on ? undefined : s)}
            className={cn(
              "inline-flex h-7 items-center rounded-full border px-2 text-[11px] font-medium transition-colors",
              on ? TONE[s] : "border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {STATE_LABEL[s]}
          </button>
        );
      })}
    </div>
  );
}

export function DemoHealingSection({
  defaultDone = false,
  defaultChakrasBefore = {},
  defaultChakrasAfter = {},
  defaultNotes = "",
}: {
  defaultDone?: boolean;
  defaultChakrasBefore?: ChakraStateMap;
  defaultChakrasAfter?: ChakraStateMap;
  defaultNotes?: string;
}) {
  const [done, setDone] = useState(defaultDone);
  const [before, setBefore] = useState<ChakraStateMap>(defaultChakrasBefore);
  const [after, setAfter] = useState<ChakraStateMap>(defaultChakrasAfter);

  const setBeforeChakra = (k: ChakraKey) => (v: ChakraState | undefined) =>
    setBefore((p) => { const n = { ...p }; if (v) n[k] = v; else delete n[k]; return n; });

  const setAfterChakra = (k: ChakraKey) => (v: ChakraState | undefined) =>
    setAfter((p) => { const n = { ...p }; if (v) n[k] = v; else delete n[k]; return n; });

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="demoHealingDone"
          name="demoHealingDone"
          value="true"
          checked={done}
          onChange={(e) => setDone(e.target.checked)}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        <label htmlFor="demoHealingDone" className="text-sm font-medium">
          Free / demo healing was given during this visit
        </label>
      </div>

      {done && (
        <div className="space-y-4">
          <input type="hidden" name="demoChakrasBefore" value={JSON.stringify(before)} />
          <input type="hidden" name="demoChakrasAfter" value={JSON.stringify(after)} />

          {/* Chakra table */}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Chakra</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Before healing</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">After healing</th>
                </tr>
              </thead>
              <tbody>
                {CHAKRA_KEYS.map((chakra, i) => (
                  <tr key={chakra} className={cn("border-b border-border last:border-0", i % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                    <td className="px-3 py-2.5 text-xs font-medium text-foreground whitespace-nowrap align-middle">
                      {CHAKRA_LABEL[chakra]}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <StatePills value={before[chakra]} onChange={setBeforeChakra(chakra)} />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <StatePills value={after[chakra]} onChange={setAfterChakra(chakra)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="demoHealingNotes" className="text-sm font-medium">
              Additional healing notes
            </label>
            <textarea
              id="demoHealingNotes"
              name="demoHealingNotes"
              rows={3}
              defaultValue={defaultNotes}
              className={cn(inputCls, "min-h-20 resize-y py-2")}
              placeholder="Pranas used, techniques, duration, special observations…"
            />
          </div>
        </div>
      )}
    </div>
  );
}
