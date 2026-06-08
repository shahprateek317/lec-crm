import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Package, GraduationCap, MessagesSquare, Wallet, ClipboardList, Shield, Bell } from "lucide-react";
import { getSettingPreview, SETTING_KEYS } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isAdmin(session.user.role)) redirect("/dashboard");

  const [waProvider, razProvider] = await Promise.all([
    getSettingPreview(SETTING_KEYS.whatsappProvider),
    getSettingPreview(SETTING_KEYS.razorpayProvider),
  ]);
  const waLive = waProvider.preview === "meta";
  const razLive = razProvider.preview === "razorpay";

  const items = [
    { href: "/settings/users",    icon: Users,         title: "Staff accounts",   description: "Add coordinators, counsellors, healers. Enable / disable." },
    { href: "/settings/packages", icon: Package,       title: "Credit packages",  description: "Healing charges and credits granted per package." },
    { href: "/settings/courses",  icon: GraduationCap, title: "Courses",          description: "Fees, descriptions, and prerequisite chains." },
    { href: "/settings/whatsapp", icon: MessagesSquare, title: "WhatsApp Business", description: "Connect your Meta Business account so real messages send.",
      status: waLive ? { label: "Live", tone: "bg-emerald-100 text-emerald-900" } : { label: "Demo mode", tone: "bg-amber-100 text-amber-900" } },
    { href: "/settings/razorpay", icon: Wallet,        title: "Razorpay",         description: "Connect your Razorpay account so real payment links go out.",
      status: razLive ? { label: "Live", tone: "bg-emerald-100 text-emerald-900" } : { label: "Demo mode", tone: "bg-amber-100 text-amber-900" } },
    { href: "/settings/payouts",   icon: Wallet,        title: "Healer payouts",   description: "Record monthly disbursements to healers. Track pending vs paid per period." },
    { href: "/settings/audit-log", icon: ClipboardList, title: "Audit log",        description: "Who accessed what, and when. Append-only record of document views, thread opens, and admin actions." },
    { href: "/settings/notifications", icon: Bell,       title: "Notifications",    description: "Choose which in-app notifications you receive. All are on by default." },
    { href: "/settings/security",  icon: Shield,        title: "Two-factor auth",  description: "Enable a 6-digit code from your authenticator app on top of your password." },
  ] as const;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Admin-only configuration for the centre.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Link key={it.href} href={it.href}>
              <Card className="h-full rounded-xl transition-colors hover:bg-muted/40">
                <CardContent className="flex items-start gap-3 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{it.title}</p>
                      {"status" in it && it.status && (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${it.status.tone}`}>
                          {it.status.label}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{it.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
