import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { createPaymentAction } from "./actions";

export const metadata = { title: "Record payment" };

export default async function NewPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [client, packages] = await Promise.all([
    prisma.client.findUnique({ where: { id }, select: { id: true, name: true } }),
    prisma.creditPackage.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        href={`/leads/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to {client.name}
      </Link>

      <header>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Record payment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A payment link will be generated and sent to {client.name} on WhatsApp.
        </p>
      </header>

      <form
        action={createPaymentAction}
        className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <input type="hidden" name="clientId" value={client.id} />

        <div className="space-y-2">
          <label className="text-sm font-medium">Choose package</label>
          <div className="space-y-2">
            {packages.map((p, i) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-card p-3 hover:bg-muted/40"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="packageId"
                    value={p.id}
                    defaultChecked={i === 1}
                    data-amount={p.amount}
                    data-credits={p.credits}
                    className="h-4 w-4"
                  />
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.credits} healing credits
                    </p>
                  </div>
                </div>
                <p className="font-serif text-lg">₹{p.amount.toLocaleString("en-IN")}</p>
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/40">
              <input type="radio" name="packageId" value="" className="h-4 w-4" />
              <div>
                <p className="text-sm font-medium">Custom amount</p>
                <p className="text-xs text-muted-foreground">
                  E.g. post-credit sessions at ₹500 each.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="amount" className="text-sm font-medium">
              Amount (₹)
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              min={1}
              required
              defaultValue={packages[1]?.amount ?? 500}
              className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="creditsGranted" className="text-sm font-medium">
              Credits granted
            </label>
            <input
              id="creditsGranted"
              name="creditsGranted"
              type="number"
              min={0}
              required
              defaultValue={packages[1]?.credits ?? 0}
              className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="notes" className="text-sm font-medium">Internal notes (optional)</label>
          <textarea id="notes" name="notes" rows={2} className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-16 resize-y" />
        </div>

        {sp.error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {decodeURIComponent(sp.error)}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
            Generate payment link
          </button>
          <Link href={`/leads/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
