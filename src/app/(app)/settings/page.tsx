import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Package, GraduationCap } from "lucide-react";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const items = [
    { href: "/settings/users",    icon: Users,         title: "Staff accounts", description: "Add coordinators, counsellors, healers. Enable/disable." },
    { href: "/settings/packages", icon: Package,       title: "Credit packages", description: "Amounts and credit counts for prepaid packages." },
    { href: "/settings/courses",  icon: GraduationCap, title: "Courses",         description: "Fees, descriptions, and prerequisite chains." },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Admin-only configuration.
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
                  <div>
                    <p className="font-medium">{it.title}</p>
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
