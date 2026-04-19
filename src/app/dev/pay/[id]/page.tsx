// Stub-mode "hosted checkout" page. Visible only when the payment provider
// is the in-process stub; production switches to Razorpay's real page.
// This page lets a human mark a pending payment paid for local testing.

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { markPaidStubAction } from "./actions";

export const metadata = { title: "Pay (dev)" };

export default async function DevPayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { client: true, package: true },
  });
  if (!payment) notFound();

  return (
    <main className="pranic-glow flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Local dev checkout (stub)
          </p>
          <h1 className="mt-1 font-serif text-2xl font-medium">
            ₹{payment.amount.toLocaleString("en-IN")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {payment.package?.name ?? "Custom amount"} · {payment.creditsGranted} healing credits
          </p>
        </div>

        <div className="rounded-lg bg-muted/40 p-4 text-sm">
          <p><span className="text-muted-foreground">For:</span> {payment.client.name}</p>
          <p><span className="text-muted-foreground">Phone:</span> {payment.client.phone}</p>
          <p><span className="text-muted-foreground">Status:</span> {payment.status.toLowerCase()}</p>
        </div>

        {payment.status === "PENDING" ? (
          <form action={markPaidStubAction} className="space-y-3">
            <input type="hidden" name="paymentId" value={payment.id} />
            <button
              type="submit"
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Simulate successful payment
            </button>
            <p className="text-xs text-muted-foreground">
              In production this would be Razorpay's hosted page with real UPI / card input.
            </p>
          </form>
        ) : (
          <p className="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-900">
            Already {payment.status.toLowerCase()}.
          </p>
        )}

        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Home
        </Link>
      </div>
    </main>
  );
}
