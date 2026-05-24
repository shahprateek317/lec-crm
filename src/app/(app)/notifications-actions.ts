"use server";

// Server actions for the notification bell in the staff layout.
//
// Mark-as-read writes go through markNotificationRead /
// markAllNotificationsRead (src/lib/notify.ts), which scope every
// update to (id, recipientId) so one user can never clear another's
// notifications. We revalidate the (app) layout so the bell badge
// updates on the next paint.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/notify";

export async function markNotificationReadAction(id: string): Promise<void> {
  const session = await requireSession();
  await markNotificationRead(id, session.user.id);
  revalidatePath("/");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const session = await requireSession();
  await markAllNotificationsRead(session.user.id);
  revalidatePath("/");
}
