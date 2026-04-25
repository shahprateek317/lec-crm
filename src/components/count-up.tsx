"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 to `value` over `duration` ms when first
 * mounted. Used on dashboard KPI cards so the number "lands" rather than
 * just appearing flat.
 */
export function CountUp({
  value,
  duration = 800,
  format,
  prefix = "",
  suffix = "",
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  prefix?: string;
  suffix?: string;
}) {
  const [n, setN] = useState(0);
  const startedAt = useRef<number | null>(null);
  const reduced = useRef<boolean>(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current || value === 0) {
      setN(value);
      return;
    }
    let raf = 0;
    const tick = (ts: number) => {
      if (startedAt.current === null) startedAt.current = ts;
      const t = Math.min(1, (ts - startedAt.current) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <>
      {prefix}
      {format ? format(n) : n.toLocaleString("en-IN")}
      {suffix}
    </>
  );
}
