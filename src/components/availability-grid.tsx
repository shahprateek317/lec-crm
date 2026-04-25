"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DAYS = [
  { v: "MON", short: "Mon" },
  { v: "TUE", short: "Tue" },
  { v: "WED", short: "Wed" },
  { v: "THU", short: "Thu" },
  { v: "FRI", short: "Fri" },
  { v: "SAT", short: "Sat" },
  { v: "SUN", short: "Sun" },
] as const;

const BANDS = [
  { v: "EARLY_MORNING", short: "Early",     hours: "6 – 9" },
  { v: "MORNING",       short: "Morning",   hours: "9 – 12" },
  { v: "AFTERNOON",     short: "Afternoon", hours: "12 – 4" },
  { v: "EVENING",       short: "Evening",   hours: "4 – 7" },
  { v: "NIGHT",         short: "Night",     hours: "7 – 10" },
] as const;

type Day = (typeof DAYS)[number]["v"];
type Band = (typeof BANDS)[number]["v"];
type Slot = `${Day}:${Band}`;

function isSlot(s: string): s is Slot {
  const [d, b] = s.split(":");
  return DAYS.some((x) => x.v === d) && BANDS.some((x) => x.v === b);
}

/**
 * Mobile-first drag-select grid (When2Meet style). Days are columns, time
 * bands are rows. Tap to toggle a single cell, click-and-drag (or
 * touch-and-drag) to paint many. Selection is submitted as repeated
 * "availabilitySlots" hidden inputs so the existing server action picks them
 * up via formData.getAll().
 */
export function AvailabilityGrid({
  name = "availabilitySlots",
  defaultSelected = [],
}: {
  name?: string;
  defaultSelected?: string[];
}) {
  const [selected, setSelected] = useState<Set<Slot>>(() => {
    const valid = defaultSelected.filter(isSlot);
    return new Set<Slot>(valid as Slot[]);
  });
  const dragMode = useRef<"add" | "remove" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback((slot: Slot, mode: "add" | "remove") => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (mode === "add") next.add(slot);
      else next.delete(slot);
      return next;
    });
  }, []);

  const slotFromTarget = useCallback((target: EventTarget | null): Slot | null => {
    if (!(target instanceof Element)) return null;
    const cell = target.closest<HTMLElement>("[data-slot]");
    const slot = cell?.dataset.slot;
    return slot && isSlot(slot) ? slot : null;
  }, []);

  // ── Mouse / pointer ─────────────────────────────────────────────
  useEffect(() => {
    const onUp = () => { dragMode.current = null; };
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    window.addEventListener("touchcancel", onUp);
    return () => {
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchcancel", onUp);
    };
  }, []);

  const onMouseDown = (slot: Slot) => (e: React.MouseEvent) => {
    e.preventDefault();
    const mode: "add" | "remove" = selected.has(slot) ? "remove" : "add";
    dragMode.current = mode;
    toggle(slot, mode);
  };

  const onMouseEnter = (slot: Slot) => () => {
    if (!dragMode.current) return;
    toggle(slot, dragMode.current);
  };

  // ── Touch (uses elementFromPoint for drag-painting on mobile) ────
  const onTouchStart = (slot: Slot) => (e: React.TouchEvent) => {
    const mode: "add" | "remove" = selected.has(slot) ? "remove" : "add";
    dragMode.current = mode;
    toggle(slot, mode);
    // Don't preventDefault — let the user still scroll if they swipe vertically.
    e.stopPropagation();
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragMode.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const slot = slotFromTarget(document.elementFromPoint(touch.clientX, touch.clientY));
    if (slot) {
      e.preventDefault(); // we're on a cell, stop scrolling
      toggle(slot, dragMode.current);
    }
  };

  const sortedSlots = useMemo(() => Array.from(selected).sort(), [selected]);

  const fillAll = () => {
    const all = new Set<Slot>();
    for (const d of DAYS) for (const b of BANDS) all.add(`${d.v}:${b.v}` as Slot);
    setSelected(all);
  };
  const clearAll = () => setSelected(new Set());
  const fillWeekdays = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const d of ["MON", "TUE", "WED", "THU", "FRI"] as const) {
        for (const b of BANDS) next.add(`${d}:${b.v}` as Slot);
      }
      return next;
    });
  };

  const isOn = (slot: Slot) => selected.has(slot);

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        onTouchMove={onTouchMove}
        className="overflow-x-auto rounded-xl border border-border bg-card p-3"
        style={{ touchAction: "pan-y" }}
      >
        <div
          className="grid select-none gap-1"
          style={{
            gridTemplateColumns: `minmax(72px, auto) repeat(${DAYS.length}, minmax(40px, 1fr))`,
          }}
        >
          {/* Header row */}
          <div className="sticky left-0 bg-card" />
          {DAYS.map((d) => (
            <div key={d.v} className="text-center text-[11px] font-medium text-muted-foreground">
              {d.short}
            </div>
          ))}

          {/* Rows: one per band */}
          {BANDS.map((b) => (
            <div key={b.v} className="contents">
              <div className="sticky left-0 flex flex-col justify-center bg-card pr-2 text-right">
                <p className="text-xs font-medium leading-tight">{b.short}</p>
                <p className="text-[10px] text-muted-foreground">{b.hours}</p>
              </div>
              {DAYS.map((d) => {
                const slot = `${d.v}:${b.v}` as Slot;
                const on = isOn(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    aria-pressed={on}
                    aria-label={`${d.short} ${b.short}`}
                    data-slot={slot}
                    onMouseDown={onMouseDown(slot)}
                    onMouseEnter={onMouseEnter(slot)}
                    onTouchStart={onTouchStart(slot)}
                    className={
                      "h-10 rounded-md transition-colors " +
                      (on
                        ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                        : "bg-muted hover:bg-muted/70")
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-muted-foreground">
          {selected.size === 0
            ? "No slots selected — tap or drag to mark availability."
            : `${selected.size} slot${selected.size === 1 ? "" : "s"} selected`}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={fillWeekdays} className="rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:bg-muted">
            Fill weekdays
          </button>
          <button type="button" onClick={fillAll} className="rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:bg-muted">
            Fill all
          </button>
          <button type="button" onClick={clearAll} className="rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:bg-muted">
            Clear
          </button>
        </div>
      </div>

      {/* Hidden inputs so the form submits the slots */}
      {sortedSlots.map((s) => (
        <input key={s} type="hidden" name={name} value={s} />
      ))}
    </div>
  );
}
