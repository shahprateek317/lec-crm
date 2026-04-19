import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { signOutAction } from "./actions";
import { t } from "@/lib/i18n";
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

const NAV: Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string }>; roles?: string[] }> = [
  { href: "/dashboard",        label: "Dashboard",            icon: LayoutDashboard },
  { href: "/leads",            label: "Leads & Clients",      icon: Users },
  { href: "/schedule",         label: "Counselling & Visits", icon: CalendarDays },
  { href: "/healing",          label: "Healing Sessions",     icon: Sparkles },
  { href: "/distant-healing",  label: "Distant Healing",      icon: MessagesSquare },
  { href: "/payments",         label: "Payments & Credits",   icon: Wallet },
  { href: "/courses",          label: "Courses",              icon: GraduationCap },
  { href: "/follow-ups",       label: "Follow-ups",           icon: Clock },
  { href: "/settings",         label: "Settings",             icon: Settings, roles: ["ADMIN"] },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?callbackUrl=/dashboard");

  const visible = NAV.filter((n) => !n.roles || n.roles.includes(session.user.role));

  return (
    <div className="min-h-screen bg-sidebar text-sidebar-foreground">
      <div className="flex min-h-screen">
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
            <p className="text-xs text-muted-foreground">
              {t.roles[session.user.role as keyof typeof t.roles] ?? session.user.role}
            </p>
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

        <main className="flex-1 bg-background">
          <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
