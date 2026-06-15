"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireClient } from "@/lib/me-session";
import { enrolClient } from "@/lib/courses";
import { prisma } from "@/lib/prisma";

// Razorpay short-link origins. The stub uses the app's own origin (/dev/pay/…).
const ALLOWED_PAYMENT_ORIGINS = ["https://rzp.io", "https://razorpay.com"];

export async function clientEnrolAction(formData: FormData) {
  const client = await requireClient("/me/courses");
  const courseId = String(formData.get("courseId") ?? "");
  const applyCreditsToFee = formData.get("applyCreditsToFee") === "true";

  // Early validation — empty courseId would produce a Zod error inside enrolClient.
  if (!courseId) redirect("/me/courses?error=Invalid+request");

  // Verify the course is active and open for self-enrolment before calling enrolClient.
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, active: true } });
  if (!course?.active) redirect("/me/courses?error=Course+not+available");

  const byUserId = await resolveActorUserId(client.id);

  let errorMsg: string | null = null;
  let paymentUrl: string | null = null;

  try {
    const result = await enrolClient({ clientId: client.id, courseId, applyCreditsToFee, byUserId });
    paymentUrl = result.payment?.providerPaymentLinkUrl ?? null;
  } catch (err) {
    // Only forward messages that are safe to show clients.
    const msg = err instanceof Error ? err.message : "";
    const isSafe =
      msg.includes("already enrolled") ||
      msg.includes("Missing prerequisite") ||
      msg.includes("No staff user found");
    errorMsg = isSafe ? msg : "Enrolment failed. Please try again or contact the centre.";
  }

  // All redirects are outside the try/catch so Next.js NEXT_REDIRECT is never swallowed.
  if (errorMsg) redirect(`/me/courses?error=${encodeURIComponent(errorMsg)}`);

  revalidatePath("/me/courses");
  revalidatePath("/me");

  if (paymentUrl && isSafePaymentUrl(paymentUrl)) redirect(paymentUrl);
  redirect("/me/courses?enrolled=1");
}

function isSafePaymentUrl(url: string): boolean {
  // Relative paths (stub /dev/pay/…) are always safe.
  if (url.startsWith("/")) return true;
  try {
    const origin = new URL(url).origin;
    return ALLOWED_PAYMENT_ORIGINS.includes(origin);
  } catch {
    return false;
  }
}

async function resolveActorUserId(clientId: string): Promise<string> {
  const c = await prisma.client.findUnique({
    where: { id: clientId },
    select: { assignedToId: true },
  });
  if (c?.assignedToId) return c.assignedToId;

  // No assigned coordinator — fall back to any SUPER_ADMIN for the audit record.
  console.warn(`[enrol] client ${clientId} has no coordinator; SUPER_ADMIN used as audit actor`);
  const admin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
    select: { id: true },
  });
  if (admin) return admin.id;

  throw new Error("No staff user found to record this enrolment. Please contact the centre.");
}
