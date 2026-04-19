"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { markPaymentPaid } from "@/lib/credits";

// No auth on this stub endpoint — it simulates an externally-hosted
// Razorpay checkout that anonymous users complete.
export async function markPaidStubAction(formData: FormData) {
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!paymentId) throw new Error("Missing paymentId");
  await markPaymentPaid(paymentId);
  revalidatePath("/payments");
  redirect(`/dev/pay/${paymentId}?paid=1`);
}
