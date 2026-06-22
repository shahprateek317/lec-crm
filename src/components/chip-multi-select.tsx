"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type ChipOption = { value: string; label: string };

/**
 * Modern multi-select rendered as toggleable pills. Submits as multiple
 * hidden inputs with the same `name`, so server actions read it via
 * `formData.getAll(name)` exactly like the old <input type="checkbox"> grid.
 */
export function ChipMultiSelect({
  name,
  options,
  defaultSelected = [],
  columns,
  ariaLabel,
}: {
  name: string;
  options: ReadonlyArray<ChipOption>;
  defaultSelected?: ReadonlyArray<string>;
  columns?: 2 | 3 | 4;
  ariaLabel?: string;
}) {
  const [selected, setSelected] = useState<string[]>(() => [...defaultSelected]);

  const toggle = (v: string) =>
    setSelected((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );

  return (
    <div role="group" aria-label={ariaLabel}>
      <div
        className={cn(
          "flex flex-wrap gap-1.5",
          columns === 2 && "sm:grid sm:grid-cols-2",
          columns === 3 && "sm:grid sm:grid-cols-3",
          columns === 4 && "sm:grid sm:grid-cols-4",
        )}
      >
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                on
                  ? "border-primary bg-primary/10 text-primary hover:bg-primary/15"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {on && <Check className="h-3.5 w-3.5" />}
              {o.label}
            </button>
          );
        })}
      </div>
      {selected.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
    </div>
  );
}
