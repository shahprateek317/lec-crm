import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, BookOpen } from "lucide-react";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FaqForm } from "../faq-form";

export const metadata = { title: "New FAQ · Knowledge Centre" };

export default async function NewFaqPage() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.roles)) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <Link href="/settings/knowledge-centre" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Back to Knowledge Centre
      </Link>
      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <BookOpen className="h-7 w-7 text-primary" />
          New FAQ
        </h1>
      </header>
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">FAQ details</CardTitle>
        </CardHeader>
        <CardContent>
          <FaqForm />
        </CardContent>
      </Card>
    </div>
  );
}
