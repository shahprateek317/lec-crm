// Minimal i18n accessor. Swap to next-intl or similar when we ship more
// than one language; this indirection keeps call sites stable.
import { en } from "./en";

export const t = en;
export type { Messages } from "./en";
