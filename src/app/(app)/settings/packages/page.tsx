import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { FlashToaster } from "@/components/flash-toaster";
import { createPackageAction, updatePackageAction } from "./actions";

export const metadata = { title: "Credit packages" };

export default async function PackagesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.roles)) redirect("/dashboard");
  const sp = await searchParams;

  const packages = await prisma.creditPackage.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { amount: "asc" }],
  });

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Back to settings
      </Link>

      <header>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Credit packages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prepaid healing packages. Each credit = one healing session. Post-credit rate is â‚¹500 per session.
        </p>
      </header>

      <FlashToaster />

      <Card className="rounded-xl">
        <CardContent className="p-6">
          <div className="mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Add a package</p>
          </div>
          <form action={createPackageAction} className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
            <input name="name" placeholder="e.g. Starter" required minLength={2} className={inputCls} />
            <input name="amount" type="number" min={1} placeholder="Amount (â‚¹)" required className={inputCls} />
            <input name="credits" type="number" min={1} placeholder="Credits" required className={inputCls} />
            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
              Add
            </button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardContent className="divide-y divide-border p-0">
          {packages.length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">
              No packages yet. Add one above.
            </p>
          )}
          {packages.map((p) => (
            <form
              key={p.id}
              action={updatePackageAction}
              className="grid gap-3 p-4 md:grid-cols-[2fr_1fr_1fr_auto_auto] md:items-center"
            >
              <input type="hidden" name="id" value={p.id} />
              <input name="name" defaultValue={p.name} required minLength={2} className={inputCls} />
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">â‚¹</span>
                <input name="amount" type="number" min={1} defaultValue={p.amount} required className={`${inputCls} pl-7`} />
              </div>
              <input name="credits" type="number" min={1} defaultValue={p.credits} required className={inputCls} />
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" value="true" defaultChecked={p.active} className="h-4 w-4" />
                Active
              </label>
              <button type="submit" className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted">
                Save
              </button>
            </form>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

const inputCls =
  "flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
