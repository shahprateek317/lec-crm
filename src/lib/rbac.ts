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

export function canUseInbox(role: Role): boolean {
  return INBOX_ROLES.includes(role);
}

export function isAdmin(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

export function canAuditQuality(role: Role): boolean {
  return QUALITY_AUDITOR_ROLES.includes(role);
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function requireRole(...allowed: Role[]) {
  const session = await requireSession();
  if (!allowed.includes(session.user.role)) throw new Error("FORBIDDEN");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (!isAdmin(session.user.role)) throw new Error("FORBIDDEN");
  return session;
}
