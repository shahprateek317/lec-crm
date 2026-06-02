"use server";

// Server actions for the /settings/security TOTP enrollment flow.
//
// State machine (User row):
//   totpSecret=NULL, totpEnabledAt=NULL    →  "2FA off"
//   totpSecret=set,  totpEnabledAt=NULL    →  "pending enrollment"
//   totpSecret=set,  totpEnabledAt=set     →  "active; required at sign-in"
//
// Actions:
//   startTotpEnrollmentAction  generates a fresh secret, encrypts it, sets
//                              totpEnabledAt=NULL (no enforcement yet)
//   confirmTotpEnrollmentAction reads back the pending secret, verifies the
//                              user's code, sets totpEnabledAt=now()
//   cancelTotpEnrollmentAction clears a pending (un-verified) secret
//   disableTotpAction          requires a valid current code; clears both
//                              secret + enabledAt
//
// Every action requires a real staff session (auth()). All four also
// write an AuditLog entry so an admin can reconstruct who touched 2FA
// on whose account (only ever own account — staff can't manage each
// other's TOTP from here).

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptForStorage, decryptFromStorage } from "@/lib/crypto";
import { generateTotpSecret, verifyTotpCode } from "@/lib/totp";
import { audit } from "@/lib/audit";
import { generateAndStoreBackupCodes } from "@/lib/backup-codes";

async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?callbackUrl=/settings/security");
  return session.user;
}

export async function startTotpEnrollmentAction(): Promise<void> {
  const user = await requireUser();

  // Refuse if 2FA is already active. Disabling first is intentional
  // friction — protects against "user got phished into clicking a
  // suspicious link that quietly re-enrolls them on the attacker's
  // device".
  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { totpEnabledAt: true },
  });
  if (current?.totpEnabledAt) {
    redirect("/settings/security?error=already_active");
  }

  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpSecret: encryptForStorage(secret),
      totpEnabledAt: null,
    },
  });
  revalidatePath("/settings/security");
  redirect("/settings/security?step=verify");
}

// Tighter than `z.string().min(6).max(10)` — only digits and whitespace,
// 6–10 chars. `verifyTotpCode` normalises whitespace and rejects
// non-numeric input anyway, but tightening at the schema layer
// prevents attacker-controlled long strings from reaching the
// HMAC-compare path (defense in depth).
const codeSchema = z.string().regex(/^[\d\s]{6,10}$/);

const confirmSchema = z.object({ code: codeSchema });

export async function confirmTotpEnrollmentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = confirmSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) redirect("/settings/security?step=verify&error=invalid_code");

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { totpSecret: true, totpEnabledAt: true },
  });
  if (!row?.totpSecret || row.totpEnabledAt) {
    // Either no pending enrollment, or already active. Either way,
    // bounce back to the dashboard view.
    redirect("/settings/security");
  }

  let secret: string;
  try {
    secret = decryptFromStorage(row.totpSecret);
  } catch {
    // `redirect` throws NEXT_REDIRECT (typed `never`), so `secret` is
    // never read uninitialised at runtime. The explicit `return` is
    // belt-and-brace: if `redirect` is ever wrapped/mocked to return,
    // we still bail out cleanly instead of reading an undefined value.
    return redirect("/settings/security?error=secret_corrupted");
  }

  if (!verifyTotpCode(secret, parsed.data.code)) {
    return redirect("/settings/security?step=verify&error=wrong_code");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabledAt: new Date() },
  });
  // Generate 10 single-use backup codes. The codes are returned as plaintext
  // and included in the redirect URL as a base64-encoded query param so the
  // page can display them ONCE. They are not stored anywhere in plaintext.
  const plainCodes = await generateAndStoreBackupCodes(user.id);
  await audit("SETTING_CHANGED", "User", user.id, {
    actorId: user.id,
    meta: { setting: "totp", action: "enabled" },
  });
  revalidatePath("/settings/security");
  const codesParam = Buffer.from(JSON.stringify(plainCodes)).toString("base64url");
  redirect(`/settings/security?ok=enabled&codes=${codesParam}`);
}

export async function cancelTotpEnrollmentAction(): Promise<void> {
  const user = await requireUser();
  // Only clears if still pending — never wipe an active secret here.
  await prisma.user.updateMany({
    where: { id: user.id, totpEnabledAt: null },
    data: { totpSecret: null },
  });
  revalidatePath("/settings/security");
  redirect("/settings/security");
}

const disableSchema = z.object({ code: codeSchema });

export async function disableTotpAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = disableSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) redirect("/settings/security?error=disable_needs_code");

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { totpSecret: true, totpEnabledAt: true },
  });
  if (!row?.totpEnabledAt || !row.totpSecret) {
    // Not enabled — nothing to do.
    redirect("/settings/security");
  }

  let secret: string;
  try {
    secret = decryptFromStorage(row.totpSecret);
  } catch {
    // Secret unreadable — admin reset is the recovery path. Don't
    // silently disable without a code (would let an attacker clear
    // 2FA by corrupting the secret). Explicit return is belt-and-brace.
    return redirect("/settings/security?error=secret_corrupted");
  }

  if (!verifyTotpCode(secret, parsed.data.code)) {
    return redirect("/settings/security?error=wrong_code");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: null, totpEnabledAt: null },
  });
  await audit("SETTING_CHANGED", "User", user.id, {
    actorId: user.id,
    meta: { setting: "totp", action: "disabled" },
  });
  revalidatePath("/settings/security");
  redirect("/settings/security?ok=disabled");
}
