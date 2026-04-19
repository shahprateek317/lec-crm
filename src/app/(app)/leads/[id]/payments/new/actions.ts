"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { createPayment } from "@/lib/credits";

export async function createPaymentAction(formData: FormData) {
  await requireSession();
  const clientId = String(formData.get("clientId") ?? "");
  try {
    await createPayment({
      clientId,
      packageId: String(formData.get("packageId") ?? "") || undefined,
      amount: Number(formData.get("amount")),
      creditsGranted: Number(formData.get("creditsGranted")),
      notes: String(formData.get("notes") ?? "") || undefined,
    });
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "Failed");
    redirect(`/leads/${clientId}/payments/new?error=${msg}`);
  }
  revalidatePath(`/leads/${clientId}`);
  revalidatePath(`/payments`);
  redirect(`/leads/${clientId}`);
}
