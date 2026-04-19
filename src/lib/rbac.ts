import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";

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
