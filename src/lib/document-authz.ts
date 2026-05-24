// Authorization predicate for Document reads.
//
// Lives in its own file (no Next.js / Prisma imports) so vitest can
// exercise it directly without dragging in the full server module graph.
// The /api/documents/[id] route and any future /me/documents route both
// import from here — one source of truth.

export const ELEVATED_ROLES = new Set([
  "ADMIN",
  "SUPER_ADMIN",
  "QUALITY_CONTROLLER",
]);

/**
 * Whether a staff session can read a Document.
 *
 * Rules:
 *   - The User who owns the doc (e.g. a healer reading their own cert).
 *   - Any user with an elevated role (admin / super admin / QC).
 *
 * Client-owned documents are intentionally not visible via the staff
 * route — they're served from the (Phase 1b) client portal endpoint
 * with its own session cookie. Allowing staff to read client docs
 * trivially via this predicate would bypass the audit boundary.
 * For staff who legitimately need to read a client doc (medical
 * report), an elevated role is required.
 */
export function canViewDocument(
  doc: { ownerUserId: string | null; ownerClientId: string | null },
  session: { userId: string; role: string },
): boolean {
  const isOwner = !!doc.ownerUserId && doc.ownerUserId === session.userId;
  const isElevated = ELEVATED_ROLES.has(session.role);
  return isOwner || isElevated;
}
