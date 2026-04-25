import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";

// Roles that have full admin powers (Super Admin is a stronger Admin).
export const ADMIN_ROLES: ReadonlyArray<Role> = ["SUPER_ADMIN", "ADMIN"];

export function isAdmin(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
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
