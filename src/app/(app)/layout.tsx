import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { signOutAction } from "./actions";
import { t } from "@/lib/i18n";
import { CommandPalette } from "@/components/command-palette";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Sparkles,
  Wallet,
  MessagesSquare,
  GraduationCap,
  Settings,
  LogOut,
  Clock,
} from "lucide-react";

const NAV: Array<{ href: string; label: string; short: string; icon: React.ComponentType<{ className?: string }>; roles?: string[] }> = [
  { href: "/dashboard",       label: "Dashboard",            short: "Home",       icon: LayoutDashboard },
  { href: "/leads",           label: "Leads & Clients",      short: "Leads",      icon: Users },
  { href: "/schedule",        label: "Counselling & Visits", short: "Schedule",   icon: CalendarDays },
  { href: "/healing",         label: "Healing Sessions",     short: "Healing",    icon: Sparkles },
  { href: "/distant-healing", label: "Distant Healing",      short: "Distant",    icon: MessagesSquare },
  { href: "/payments",        label: "Payments & Credits",   short: "Payments",   icon: Wallet },
  { href: "/courses",         label: "Courses",              short: "Courses",    icon: GraduationCap },
  { href: "/follow-ups",      label: "Follow-ups",           short: "Follow-ups", icon: Clock },
  { href: "/settings",        label: "Settings",             short: "Settings",   icon: Settings, roles: ["ADMIN"] },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?callbackUrl=/dashboard");

  const visible = NAV.filter((n) => !n.roles || n.roles.includes(session.user.role));
  const roleLabel = t.roles[session.user.role as keyof typeof t.roles] ?? session.user.role;

  return (
    <div className="min-h-screen bg-sidebar text-sidebar-foreground">
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 md:flex">
          <Link href="/dashboard" className="mb-8 px-2">
            <span className="font-serif text-xl font-medium text-foreground">
              {t.common.appName}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t.common.tagline}
            </span>
          </Link>
          <nav className="flex-1 space-y-1">
            {visible.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 rounded-lg bg-sidebar-accent/40 p-3">
            <p className="text-xs font-medium text-sidebar-foreground">
              {session.user.name}
            </p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
            <form action={signOutAction} className="mt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
                {t.common.signOut}
              </button>
            </form>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 bg-background pb-24 md:pb-8">
          {/* Mobile top bar: shows who's signed in + sign out */}
          <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link href="/dashboard" className="flex flex-col">
                <span className="font-serif text-base font-medium text-foreground">
                  {t.common.appName}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {session.user.name} · {roleLabel}
                </span>
              </Link>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </form>
            </div>
          </header>

          <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">{children}</div>
        </main>
      </div>

      {/* Global ⌘K command palette */}
      <CommandPalette />

      {/* Mobile bottom-tab navigation. Horizontal scrollable. */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className="flex overflow-x-auto px-1 py-1.5" role="tablist">
          {visible.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-w-[64px] shrink-0 flex-col items-center gap-0.5 rounded-md px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Icon className="h-5 w-5" />
                {item.short}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
