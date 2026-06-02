"use server";

// Server action for the admin TOTP enrollment grace page.
//
// This action runs outside of a normal NextAuth session — access is gated
// solely by the short-lived HttpOnly enrollment cookie issued by the sign-in
// action. The cookie carries a HMAC-signed token encoding the admin's email
// and an expiry timestamp.
//
// Flow:
//   1. Read + verify enrollment cookie (HMAC, expiry, rate-limit).
//   2. Look up user by email — verify they are ADMIN/SUPER_ADMIN and
//      still lack totpEnabledAt (single-use: once enrolled, the token
//      becomes inert).
//   3. Verify the submitted 6-digit code against the user's pending secret.
//   4. Atomically set totpEnabledAt (WHERE totpEnabledAt IS NULL) — detects
//      a race if two requests arrive simultaneously.
//   5. Clear the enrollment cookie and redirect to /sign-in.

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { decryptFromStorage } from "@/lib/crypto";
import { verifyTotpCode } from "@/lib/totp";
import { audit } from "@/lib/audit";
import { generateAndStoreBackupCodes } from "@/lib/backup-codes";
import {
  verifyEnrollmentToken,
  ENROLLMENT_COOKIE,
} from "@/lib/enrollment-token";

// Strip a single optional space ("123 456" → "123456") then require
// exactly 6 digits. Tighter than the general codeSchema — we don't need
// to allow arbitrary whitespace on this unauthenticated endpoint.
const codeSchema = z
  .string()
  .transform((s) => s.replace(/\s/g, ""))
  .pipe(z.string().regex(/^\d{6}$/));

export async function confirmAdminEnrollmentAction(
  formData: FormData,
): Promise<void> {
  // ── 1. Read and verify the enrollment cookie ──────────────────────────
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(ENROLLMENT_COOKIE)?.value ?? "";

  // consume: true — counts this attempt against the rate limit.
  const tokenResult = verifyEnrollmentToken(rawToken, { consume: true });
  if (!tokenResult.ok) {
    // Invalid, expired, or rate-limited. Bounce to sign-in.
    cookieStore.delete(ENROLLMENT_COOKIE);
    redirect("/sign-in?error=enrollment_expired");
  }
  const { email } = tokenResult;

  // ── 2. Look up user ───────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, role: true, totpSecret: true, totpEnabledAt: true },
  });

  if (
    !user ||
    (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") ||
    user.totpEnabledAt // already enrolled — token is stale
  ) {
    cookieStore.delete(ENROLLMENT_COOKIE);
    redirect("/sign-in?error=enrollment_expired");
  }

  if (!user.totpSecret) {
    // No secret generated yet. Should not happen (page sets it), but fail safe.
    redirect("/admin-enroll?error=no_secret");
  }

  // ── 3. Validate the submitted 6-digit code ────────────────────────────
  const parsed = codeSchema.safeParse(formData.get("code"));
  if (!parsed.success) {
    redirect("/admin-enroll?error=invalid_code");
  }

  let secret: string;
  try {
    secret = decryptFromStorage(user.totpSecret);
  } catch {
    redirect("/admin-enroll?error=secret_corrupted");
  }

  if (!verifyTotpCode(secret, parsed.data)) {
    redirect("/admin-enroll?error=wrong_code");
  }

  // ── 4. Atomically confirm enrollment ──────────────────────────────────
  // WHERE totpEnabledAt IS NULL guards against a concurrent request that
  // already completed enrollment (race condition). If count === 0, the
  // other request won — this one safely falls through to the redirect.
  const { count } = await prisma.user.updateMany({
    where: { id: user.id, totpEnabledAt: null },
    data: { totpEnabledAt: new Date() },
  });

  if (count === 1) {
    const plainCodes = await generateAndStoreBackupCodes(user.id);
    await audit("SETTING_CHANGED", "User", user.id, {
      actorId: user.id,
      meta: { setting: "totp", action: "admin_enrollment_completed" },
    });
    // Pass backup codes to sign-in page for one-time display.
    const codesParam = Buffer.from(JSON.stringify(plainCodes)).toString("base64url");
    cookieStore.delete(ENROLLMENT_COOKIE);
    redirect(`/sign-in?enrolled=1&codes=${codesParam}`);
  }

  // ── 5. Clear cookie and redirect to sign-in ───────────────────────────
  cookieStore.delete(ENROLLMENT_COOKIE);
  redirect("/sign-in?enrolled=1");
}
