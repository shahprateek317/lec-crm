import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";

// Roles that have full admin powers (Super Admin is a stronger Admin).
export const ADMIN_ROLES: ReadonlyArray<Role> = ["SUPER_ADMIN", "ADMIN"];

// Roles that can review/audit healing sessions and rate healer quality.
// Admin inherits this for now (they can see everything anyway).
export const QUALITY_AUDITOR_ROLES: ReadonlyArray<Role> = [
  "SUPER_ADMIN", "ADMIN", "QUALITY_CONTROLLER",
];

// Roles that work the centre's WhatsApp inbox (assign, reply, resolve).
// Counsellors and senior counsellors also see + reply because they often
// handle the first conversation with a new lead.
export const INBOX_ROLES: ReadonlyArray<Role> = [
  "SUPER_ADMIN", "ADMIN", "COORDINATOR", "COUNSELLOR", "SENIOR_COUNSELLOR",
];

export function canUseInbox(roles: Role[]): boolean {
  return roles.some((r) => INBOX_ROLES.includes(r));
}

export function isAdmin(roles: Role[]): boolean {
  return roles.some((r) => ADMIN_ROLES.includes(r));
}

export function canAuditQuality(roles: Role[]): boolean {
  return roles.some((r) => QUALITY_AUDITOR_ROLES.includes(r));
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function requireRole(...allowed: Role[]) {
  const session = await requireSession();
  if (!session.user.roles.some((r) => allowed.includes(r))) throw new Error("FORBIDDEN");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (!isAdmin(session.user.roles)) throw new Error("FORBIDDEN");
  return session;
}
