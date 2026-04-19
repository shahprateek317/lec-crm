"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { markPaymentPaid } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

/**
 * Manual "mark paid". Requires Coordinator or Admin.
 * In production, the Razorpay webhook does this automatically — but manual
 * recording is still useful for cash or external UPI payments.
 */
export async function markPaidAction(formData: FormData) {
  await requireRole("COORDINATOR", "ADMIN");
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!paymentId) throw new Error("Missing paymentId");
  const paid = await markPaymentPaid(paymentId);
  revalidatePath("/payments");
  const payment = await prisma.payment.findUnique({ where: { id: paid.id } });
  if (payment?.clientId) revalidatePath(`/leads/${payment.clientId}`);
}
