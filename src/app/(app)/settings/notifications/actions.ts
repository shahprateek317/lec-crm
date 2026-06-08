"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { savePreferences } from "@/lib/notify";
import type { NotificationKind } from "@prisma/client";

const ALL_KINDS: NotificationKind[] = [
  "NEW_INBOUND_MESSAGE",
  "NEW_HEALING_ASSIGNMENT",
  "SESSION_REMINDER_1H",
  "CLIENT_DID_NOT_CONFIRM_START",
  "QC_FLAGGED_SESSION",
  "CERT_VERIFIED",
  "REFERRAL_REWARD_GRANTED",
  "PAYMENT_RECEIVED",
  "COURSE_ENROLMENT",
  "OTHER",
];

export async function saveNotificationPrefsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const prefs: Partial<Record<NotificationKind, boolean>> = {};
  for (const kind of ALL_KINDS) {
    // Checkbox: present = true, absent = false
    prefs[kind] = formData.has(kind);
  }

  await savePreferences(session.user.id, prefs);
  redirect("/settings/notifications?ok=Preferences+saved");
}
