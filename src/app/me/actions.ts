"use server";

// /me — global server actions for the client portal.
//   • signOutAction — clear the cookie + revoke the current session.
//   • signOutAllAction — revoke every active session for this client
//     (the "sign me out everywhere" affordance, DPDP-aligned).
//   • requestAccountDeletionAction — soft-delete the client row, schedule
//     anonymisation; hard delete happens via the nightly reconciler after
//     the 30-day window (Phase 2).

import { redirect } from "next/navigation";
import {
  revokeClientSession,
  revokeAllSessionsForClient,
} from "@/lib/client-auth";
import { prismaClientAuthStore } from "@/lib/client-auth-store";
import {
  readClientSessionCookie,
  clearClientSessionCookie,
} from "@/lib/client-session-cookie";
import { prisma } from "@/lib/prisma";
import { requireClient } from "@/lib/me-session";

export async function signOutAction() {
  const token = await readClientSessionCookie();
  if (token) {
    await revokeClientSession(prismaClientAuthStore, token).catch(() => {});
  }
  await clearClientSessionCookie();
  redirect("/me/sign-in");
}

export async function signOutAllAction() {
  const client = await requireClient();
  await revokeAllSessionsForClient(prismaClientAuthStore, client.id);
  await clearClientSessionCookie();
  redirect("/me/sign-in?signed_out_all=1");
}

export async function requestAccountDeletionAction() {
  const client = await requireClient();
  // Soft-delete: the nightly reconciler hard-deletes after a 30-day
  // grace period (DPDP defensibility + accidental-delete recovery).
  // Identity fields are NOT yet anonymised — they happen at hard-delete
  // time. Healing history remains attributed for the centre's records.
  await prisma.client.update({
    where: { id: client.id },
    data: { deletedAt: new Date() },
  });
  await revokeAllSessionsForClient(prismaClientAuthStore, client.id);
  await clearClientSessionCookie();
  redirect("/me/sign-in?deleted=1");
}
