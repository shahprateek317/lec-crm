import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { markPaidAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments & Credits" };

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  PENDING:   { bg: "bg-amber-100",   fg: "text-amber-900" },
  PAID:      { bg: "bg-emerald-100", fg: "text-emerald-900" },
  FAILED:    { bg: "bg-rose-100",    fg: "text-rose-900" },
  REFUNDED:  { bg: "bg-muted",       fg: "text-muted-foreground" },
  CANCELLED: { bg: "bg-muted",       fg: "text-muted-foreground" },
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const filter = sp.status?.toUpperCase();

  const payments = await prisma.payment.findMany({
    where: filter && ["PENDING", "PAID", "FAILED", "REFUNDED", "CANCELLED"].includes(filter)
      ? { status: filter as "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "CANCELLED" }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { client: { select: { id: true, name: true, phone: true } }, package: true },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Payments &amp; Credits</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every credit package purchase and post-credit payment.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {[
          { v: "",         label: "All" },
          { v: "PENDING",  label: "Pending" },
          { v: "PAID",     label: "Paid" },
          { v: "FAILED",   label: "Failed" },
        ].map((t) => (
          <Link
            key={t.v}
            href={t.v ? `/payments?status=${t.v}` : "/payments"}
            className={
              "inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium transition-colors " +
              ((sp.status ?? "") === t.v
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-card text-foreground hover:bg-muted")
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <Card className="rounded-xl">
        <CardContent className="divide-y divide-border p-0">
          {payments.length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">No payments yet.</p>
          )}
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-4 p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/leads/${p.clientId}`}
                    className="font-medium hover:underline"
                  >
                    {p.client.name}
                  </Link>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[p.status].bg} ${STATUS_TONE[p.status].fg}`}>
                    {p.status.toLowerCase()}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  ₹{p.amount.toLocaleString("en-IN")} · {p.creditsGranted} credits
                  {p.package ? ` · ${p.package.name}` : ""}
                  {p.paidAt ? ` · paid ${format(p.paidAt, "dd MMM")}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {p.providerPaymentLinkUrl && p.status === "PENDING" && (
                  <a
                    href={p.providerPaymentLinkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    Open link
                  </a>
                )}
                {p.status === "PENDING" && (
                  <form action={markPaidAction}>
                    <input type="hidden" name="paymentId" value={p.id} />
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-muted"
                    >
                      Mark paid
                    </button>
                  </form>
                )}
                <span className="text-xs text-muted-foreground">
                  {format(p.createdAt, "dd MMM, HH:mm")}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
