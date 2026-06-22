import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, UserPlus } from "lucide-react";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { FlashToaster } from "@/components/flash-toaster";
import { t } from "@/lib/i18n";
import { createUserAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff accounts" };

const ROLE_TONE: Partial<Record<string, string>> = {
  SUPER_ADMIN:       "bg-violet-100 text-violet-900",
  ADMIN:             "bg-primary/10 text-primary",
  COORDINATOR:       "bg-blue-100 text-blue-900",
  COUNSELLOR:        "bg-fuchsia-100 text-fuchsia-900",
  SENIOR_COUNSELLOR: "bg-fuchsia-200 text-fuchsia-900",
  HEALER:            "bg-teal-100 text-teal-900",
  SENIOR_HEALER:     "bg-teal-200 text-teal-900",
  ACCOUNTS:          "bg-amber-100 text-amber-900",
  MARKETING_MANAGER: "bg-orange-100 text-orange-900",
  VIEWER:            "bg-muted text-muted-foreground",
};

const ROLE_OPTIONS = [
  "SUPER_ADMIN", "ADMIN", "COORDINATOR", "COUNSELLOR", "SENIOR_COUNSELLOR",
  "HEALER", "SENIOR_HEALER", "ACCOUNTS", "MARKETING_MANAGER", "VIEWER",
] as const;

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; error?: string; ok?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.roles)) redirect("/dashboard");
  const sp = await searchParams;

  const users = await prisma.user.findMany({
    where: sp.role && (ROLE_OPTIONS as readonly string[]).includes(sp.role)
      ? { roles: { has: sp.role as (typeof ROLE_OPTIONS)[number] } }
      : undefined,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true, name: true, email: true, roles: true, active: true,
      employeeCode: true, phone: true,
    },
  });

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Back to settings
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight">Staff accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add coordinators, counsellors, healers — set roles and rich profiles.
          </p>
        </div>
        <form
          method="GET"
          className="flex items-center gap-2"
        >
          <select
            name="role"
            defaultValue={sp.role ?? ""}
            className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none"
          >
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{t.roles[r as keyof typeof t.roles]}</option>
            ))}
          </select>
          <button type="submit" className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-3 text-sm hover:bg-muted">Filter</button>
        </form>
      </header>

      <FlashToaster />

      <Card className="rounded-xl">
        <CardContent className="p-6">
          <div className="mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Add staff member</p>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Enter the basics here — the full role-specific profile (specialisation, availability, charges, etc.) opens automatically after the account is created.
          </p>
          <form action={createUserAction} className="grid gap-3 md:grid-cols-[2fr_2fr_1.4fr_1.4fr_auto]">
            <input name="name" placeholder="Full name" required minLength={2} className={inputCls} />
            <input name="email" type="email" placeholder="email@…" required className={inputCls} autoCapitalize="off" autoCorrect="off" />
            <select name="role" defaultValue="HEALER" required className={inputCls}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{t.roles[r as keyof typeof t.roles]}</option>
              ))}
            </select>
            <input name="password" type="password" placeholder="Temp password" required minLength={6} className={inputCls} />
            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
              <Plus className="mr-1 h-4 w-4" /> Add
            </button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardContent className="divide-y divide-border p-0">
          {users.length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">No staff yet.</p>
          )}
          {users.map((u) => {
            const primaryRole = u.roles[0] ?? "";
            const tone = ROLE_TONE[primaryRole] ?? "bg-muted text-muted-foreground";
            return (
              <Link
                key={u.id}
                href={`/settings/users/${u.id}`}
                className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{u.name}</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
                      {u.roles.map(r => t.roles[r as keyof typeof t.roles] ?? r).join(" + ")}
                    </span>
                    {!u.active && (
                      <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-900">
                        inactive
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {u.employeeCode ?? "no code"} · {u.email}{u.phone ? ` · ${u.phone}` : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

const inputCls =
  "flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
