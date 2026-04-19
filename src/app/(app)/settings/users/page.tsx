import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, UserPlus } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { createUserAction, updateUserAction } from "./actions";

export const metadata = { title: "Staff accounts" };

export default async function StaffSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/dashboard");
  const sp = await searchParams;

  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Back to settings
      </Link>
      <header>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Staff accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add new staff and manage their access. Healers can be added loosely — no minimum.
        </p>
      </header>

      {sp.ok && (
        <p className="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-900">
          Saved.
        </p>
      )}
      {sp.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}

      <Card className="rounded-xl">
        <CardContent className="p-6">
          <div className="mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Add staff member</p>
          </div>
          <form action={createUserAction} className="grid gap-3 md:grid-cols-5">
            <input name="name" placeholder="Full name" required minLength={2} className={inputCls} />
            <input name="email" type="email" placeholder="email@…" required className={inputCls} />
            <input name="phone" placeholder="Phone (optional)" className={inputCls} />
            <select name="role" defaultValue="HEALER" className={inputCls} required>
              <option value="COORDINATOR">Coordinator</option>
              <option value="COUNSELLOR">Counsellor</option>
              <option value="HEALER">Healer</option>
              <option value="ADMIN">Admin</option>
            </select>
            <input name="password" type="password" placeholder="Temp password" required minLength={6} className={inputCls} />
            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 md:col-span-5">
              Add account
            </button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardContent className="divide-y divide-border p-0">
          {users.map((u) => (
            <form
              key={u.id}
              action={updateUserAction}
              className="grid gap-3 p-4 md:grid-cols-[2fr_2fr_1.5fr_1fr_auto_auto] md:items-center"
            >
              <input type="hidden" name="id" value={u.id} />
              <input name="name" defaultValue={u.name} className={inputCls} />
              <input name="email" type="email" defaultValue={u.email} className={inputCls} readOnly />
              <input name="phone" defaultValue={u.phone ?? ""} className={inputCls} placeholder="Phone" />
              <select name="role" defaultValue={u.role} className={inputCls}>
                <option value="COORDINATOR">Coordinator</option>
                <option value="COUNSELLOR">Counsellor</option>
                <option value="HEALER">Healer</option>
                <option value="ADMIN">Admin</option>
              </select>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" value="true" defaultChecked={u.active} className="h-4 w-4" />
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
