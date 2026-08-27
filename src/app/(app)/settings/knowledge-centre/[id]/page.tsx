import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, BookOpen } from "lucide-react";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FaqForm } from "../faq-form";

export const metadata = { title: "Edit FAQ · Knowledge Centre" };

export default async function EditFaqPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.roles)) redirect("/dashboard");

  const { id } = await params;
  const faq = await prisma.faqEntry.findUnique({ where: { id } });
  if (!faq) notFound();

  return (
    <div className="space-y-6">
      <Link href="/settings/knowledge-centre" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Back to Knowledge Centre
      </Link>
      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <BookOpen className="h-7 w-7 text-primary" />
          Edit FAQ
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{faq.faqCode} · {faq.category}</p>
      </header>
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">FAQ details</CardTitle>
        </CardHeader>
        <CardContent>
          <FaqForm faq={{
            id: faq.id,
            faqCode: faq.faqCode,
            category: faq.category,
            question: faq.question,
            answer: faq.answer,
            keywords: faq.keywords,
            relatedService: faq.relatedService,
            displayOrder: faq.displayOrder,
            internalNote: faq.internalNote,
            active: faq.active,
            version: faq.version,
          }} />
        </CardContent>
      </Card>
    </div>
  );
}
