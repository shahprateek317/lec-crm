// Resolve the current client portal session from the request cookie.
// Wraps client-auth + the Prisma store with cookie management. Routes
// under /me call requireClient() or getClient() to gate access.

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { validateClientSession } from "@/lib/client-auth";
import { prismaClientAuthStore } from "@/lib/client-auth-store";
import { readClientSessionCookie, clearClientSessionCookie } from "@/lib/client-session-cookie";
import type { Client } from "@prisma/client";

/** Returns the signed-in Client, or null. Live + non-revoked + non-expired. */
export async function getClient(): Promise<Client | null> {
  const token = await readClientSessionCookie();
  if (!token) return null;
  const valid = await validateClientSession(prismaClientAuthStore, token);
  if (!valid) {
    // Dead cookie — clear it so the browser stops sending it.
    await clearClientSessionCookie().catch(() => {});
    return null;
  }
  // Filter out soft-deleted clients (DPDP soft-delete window).
  const client = await prisma.client.findUnique({ where: { id: valid.clientId } });
  if (!client || client.deletedAt) return null;
  return client;
}

/** Server-component guard. Redirects to /me/sign-in if no client session. */
export async function requireClient(callbackPath = "/me"): Promise<Client> {
  const c = await getClient();
  if (!c) redirect(`/me/sign-in?next=${encodeURIComponent(callbackPath)}`);
  return c;
}
