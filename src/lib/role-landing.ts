// Where each staff role lands by default. Coordinators live in /inbox,
// counsellors in /schedule, healers in /my-schedule, QC in /quality.
// Admin (and unmapped roles) → /dashboard.
//
// Centralised here so the sign-in flow, the public homepage's authed
// redirect, and any future deep-link recovery all share one source of
// truth. Update once, takes effect everywhere.

import type { Role } from "@prisma/client";

const LANDING: Partial<Record<Role, string>> = {
  COORDINATOR:         "/inbox",     // Phase 1b — falls back to /dashboard until shipped
  COUNSELLOR:          "/schedule",
  SENIOR_COUNSELLOR:   "/schedule",
  HEALER:              "/my-schedule",
  SENIOR_HEALER:       "/my-schedule",
  QUALITY_CONTROLLER:  "/quality",
};

export function landingForRole(role: Role): string {
  return LANDING[role] ?? "/dashboard";
}
