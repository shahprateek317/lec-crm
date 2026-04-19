// Razorpay webhook — fires on payment_link.paid, payment.captured, etc.
// Verifies HMAC signature then marks the matching payment PAID (which
// grants credits atomically via markPaymentPaid).
//
// Configure in Razorpay dashboard: POST https://<your-domain>/api/webhook/razorpay
// Events: payment_link.paid, payment.captured, payment.failed

import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/providers/payment";
import { prisma } from "@/lib/prisma";
import { markPaymentPaid } from "@/lib/credits";

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  const result = await getPaymentProvider().verifyWebhook(raw, signature);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  if (result.event === "payment.captured" && result.paymentLinkId) {
    const payment = await prisma.payment.findFirst({
      where: { providerPaymentLinkId: result.paymentLinkId },
    });
    if (payment && payment.status === "PENDING") {
      await markPaymentPaid(payment.id);
    }
  } else if (result.event === "payment.failed" && result.paymentLinkId) {
    await prisma.payment.updateMany({
      where: { providerPaymentLinkId: result.paymentLinkId, status: "PENDING" },
      data: { status: "FAILED" },
    });
  }

  return NextResponse.json({ ok: true });
}
