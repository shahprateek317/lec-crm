import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, BookOpen, Plus, Pencil, EyeOff, Eye } from "lucide-react";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlashToaster } from "@/components/flash-toaster";
import { SubmitButton } from "@/components/submit-button";
import { toggleFaqAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Knowledge Centre" };

const CATEGORIES = [
  "About Life Energy Centre",
  "Pranic Healing",
  "Appointments",
  "Healing Sessions",
  "Healing Summary",
  "Meditation",
  "Courses",
  "Payments",
  "Privacy",
  "General Questions",
];

export default async function KnowledgeCentrePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.roles)) redirect("/dashboard");

  const sp = await searchParams;
  const faqs = await prisma.faqEntry.findMany({
    where: {
      ...(sp.category ? { category: sp.category } : {}),
      ...(sp.q
        ? {
            OR: [
              { question: { contains: sp.q, mode: "insensitive" } },
              { answer: { contains: sp.q, mode: "insensitive" } },
              { keywords: { has: sp.q.toLowerCase() } },
            ],
          }
        : {}),
    },
    orderBy: [{ category: "asc" }, { displayOrder: "asc" }, { faqCode: "asc" }],
  });

  const grouped = faqs.reduce<Record<string, typeof faqs>>((acc, f) => {
    (acc[f.category] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Back to settings
      </Link>

      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
            <BookOpen className="h-7 w-7 text-primary" />
            Knowledge Centre
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage FAQ entries shown to clients in their portal.
          </p>
        </div>
        <Link
          href="/settings/knowledge-centre/new"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New FAQ
        </Link>
      </header>

      <FlashToaster />

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Search questions…"
          className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring w-56"
        />
        <select
          name="category"
          defaultValue={sp.category ?? ""}
          className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button type="submit" className="h-9 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted">
          Filter
        </button>
        <Link href="/settings/knowledge-centre" className="h-9 inline-flex items-center rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground">
          Clear
        </Link>
      </form>

      <p className="text-xs text-muted-foreground">{faqs.length} entries</p>

      {Object.entries(grouped).map(([category, entries]) => (
        <Card key={category} className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {category}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {entries.map((f) => (
              <div key={f.id} className={`flex items-start gap-3 px-4 py-3 ${!f.active ? "opacity-50" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground">{f.faqCode}</span>
                    {!f.active && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Inactive</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">v{f.version}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground mt-0.5">{f.question}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{f.answer}</p>
                  {f.internalNote && (
                    <p className="mt-1 text-xs italic text-amber-700 bg-amber-50 rounded px-2 py-0.5">
                      Staff note: {f.internalNote}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/settings/knowledge-centre/${f.id}`}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs hover:bg-muted"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </Link>
                  <form action={toggleFaqAction}>
                    <input type="hidden" name="id" value={f.id} />
                    <SubmitButton
                      pendingLabel="…"
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs hover:bg-muted"
                    >
                      {f.active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {f.active ? "Deactivate" : "Activate"}
                    </SubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {faqs.length === 0 && (
        <Card className="rounded-xl">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No FAQs found.{" "}
            <Link href="/settings/knowledge-centre/new" className="text-primary hover:underline">
              Add the first one.
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
