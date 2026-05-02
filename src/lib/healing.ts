// Domain helpers for the v2 healing session form: chakra list, state values,
// scoring, and the improvement calculator. Both the client form and the
// server action import from here so they can't drift.

import type { CleansingAction, EnergisingAction } from "@prisma/client";

export const CHAKRA_KEYS = [
  "CROWN",
  "AJNA_FOREHEAD",
  "THROAT",
  "HEART",
  "SOLAR_PLEXUS",
  "NAVEL",
  "BASIC",
  "MENG_MEIN",
  "SPLEEN",
  "SEX",
] as const;

export type ChakraKey = (typeof CHAKRA_KEYS)[number];

export const CHAKRA_LABEL: Record<ChakraKey, string> = {
  CROWN: "Crown",
  AJNA_FOREHEAD: "Ajna / Forehead",
  THROAT: "Throat",
  HEART: "Heart",
  SOLAR_PLEXUS: "Solar Plexus",
  NAVEL: "Navel",
  BASIC: "Basic",
  MENG_MEIN: "Meng Mein",
  SPLEEN: "Spleen",
  SEX: "Sex",
};

export const CHAKRA_STATES = ["BALANCED", "OVERACTIVE", "BLOCKED", "WEAK"] as const;
export type ChakraState = (typeof CHAKRA_STATES)[number];

export const STATE_LABEL: Record<ChakraState, string> = {
  BALANCED: "Balanced",
  OVERACTIVE: "Overactive",
  BLOCKED: "Blocked",
  WEAK: "Weak",
};

// Higher = healthier. Pulled out so any future "improvement" UI uses the
// same scoring as the server.
export const STATE_SCORE: Record<ChakraState, number> = {
  BALANCED: 4,
  OVERACTIVE: 2,
  BLOCKED: 1,
  WEAK: 1,
};

export type ChakraStateMap = Partial<Record<ChakraKey, ChakraState>>;

/**
 * Parse a JSON value (from Prisma) into a strongly-typed ChakraStateMap.
 * Drops unknown keys / values silently — a session saved with an older
 * schema still renders cleanly.
 */
export function parseChakraStates(raw: unknown): ChakraStateMap {
  if (!raw || typeof raw !== "object") return {};
  const out: ChakraStateMap = {};
  const obj = raw as Record<string, unknown>;
  for (const k of CHAKRA_KEYS) {
    const v = obj[k];
    if (typeof v === "string" && (CHAKRA_STATES as ReadonlyArray<string>).includes(v)) {
      out[k] = v as ChakraState;
    }
  }
  return out;
}

/** Sum of (after-score − before-score) across rated chakras. */
export function computeImprovement(
  before: ChakraStateMap,
  after: ChakraStateMap,
): { total: number; perChakra: Array<{ key: ChakraKey; before?: ChakraState; after?: ChakraState; delta: number }> } {
  let total = 0;
  const perChakra: ReturnType<typeof computeImprovement>["perChakra"] = [];
  for (const k of CHAKRA_KEYS) {
    const b = before[k];
    const a = after[k];
    const delta =
      b && a ? STATE_SCORE[a] - STATE_SCORE[b] : 0;
    total += delta;
    if (b || a) perChakra.push({ key: k, before: b, after: a, delta });
  }
  return { total, perChakra };
}

// ── Action labels ─────────────────────────────────────────────────────
export const CLEANSING_OPTIONS: ReadonlyArray<{ value: CleansingAction; label: string }> = [
  { value: "GENERAL",        label: "General Cleansing" },
  { value: "TARGET_CHAKRA",  label: "Target-Chakra Cleansing" },
  { value: "DEEP",           label: "Deep Cleansing" },
  { value: "PSYCHOLOGICAL",  label: "Psychological Cleansing" },
];

export const ENERGISING_OPTIONS: ReadonlyArray<{ value: EnergisingAction; label: string }> = [
  { value: "GENERAL",          label: "General Energising" },
  { value: "SPECIFIC_CHAKRA",  label: "Specific-Chakra Energising" },
  { value: "HIGH_POWER",       label: "High-Power Energising" },
];

export const PRANIC_COLORS = [
  "WHITE", "GREEN", "BLUE", "VIOLET", "GOLD",
  "RED", "ORANGE", "YELLOW", "ELECTRIC_VIOLET",
] as const;

export const COLOR_LABEL: Record<(typeof PRANIC_COLORS)[number], string> = {
  WHITE: "White",
  GREEN: "Green",
  BLUE: "Blue",
  VIOLET: "Violet",
  GOLD: "Gold",
  RED: "Red",
  ORANGE: "Orange",
  YELLOW: "Yellow",
  ELECTRIC_VIOLET: "Electric Violet",
};
