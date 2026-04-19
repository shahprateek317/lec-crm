import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, GraduationCap, Lock, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { checkEligibility } from "@/lib/courses";
import { getCreditBalance } from "@/lib/credits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enrolAction, markCompletedAction } from "./actions";
import { format } from "date-fns";

export const metadata = { title: "Courses" };

export default async function ClientCoursesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const [client, courses, enrolments, credits] = await Promise.all([
    prisma.client.findUnique({ where: { id } }),
    prisma.course.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: { prerequisites: { include: { prerequisite: { select: { name: true } } } } },
    }),
    prisma.enrollment.findMany({
      where: { clientId: id },
      include: { course: true },
      orderBy: { createdAt: "desc" },
    }),
    getCreditBalance(id),
  ]);
  if (!client) notFound();

  const enrolledCourseIds = new Set(
    enrolments.filter((e) => e.status !== "DROPPED").map((e) => e.courseId),
  );
  const eligibilities = await Promise.all(
    courses.map(async (c) => ({ course: c, elig: await checkEligibility(id, c.id) })),
  );

  return (
    <div className="space-y-6">
      <Link
        href={`/leads/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to {client.name}
      </Link>

      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <GraduationCap className="h-7 w-7 text-primary" />
          Courses for {client.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Current credit balance: {credits} (worth ₹{(credits * 500).toLocaleString("en-IN")} toward a course fee)
        </p>
      </header>

      {sp.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}

      {enrolments.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Current enrolments</h2>
          <Card className="rounded-xl">
            <CardContent className="divide-y divide-border p-0">
              {enrolments.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{e.course.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.status.replace("_", " ").toLowerCase()}
                      {e.creditsAdjustedAmount > 0 && ` · ₹${e.creditsAdjustedAmount} adjusted from credits`}
                      {e.enrolledAt && ` · enrolled ${format(e.enrolledAt, "dd MMM yyyy")}`}
                      {e.completedAt && ` · completed ${format(e.completedAt, "dd MMM yyyy")}`}
                    </p>
                  </div>
                  {e.status !== "COMPLETED" && (
                    <form action={markCompletedAction}>
                      <input type="hidden" name="enrolmentId" value={e.id} />
                      <input type="hidden" name="clientId" value={id} />
                      <button
                        type="submit"
                        className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
                      >
                        Mark completed
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Available courses</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {eligibilities.map(({ course, elig }) => {
            const enrolled = enrolledCourseIds.has(course.id);
            const disabled = enrolled || !elig.eligible;
            return (
              <Card key={course.id} className="rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-start justify-between gap-3 font-serif text-lg font-medium">
                    {course.name}
                    <span className="shrink-0 font-serif text-xl">
                      ₹{course.fee.toLocaleString("en-IN")}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {course.description && (
                    <p className="text-sm text-muted-foreground">{course.description}</p>
                  )}
                  {course.prerequisites.length > 0 && (
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Lock className="mt-0.5 h-3 w-3" />
                      Prereq: {course.prerequisites.map((p) => p.prerequisite.name).join(" · ")}
                    </p>
                  )}
                  {!elig.eligible && (
                    <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Missing: {elig.missing.map((m) => m.name).join(", ")}
                    </p>
                  )}
                  {enrolled ? (
                    <p className="inline-flex items-center gap-1 text-xs text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Already enrolled
                    </p>
                  ) : (
                    <form action={enrolAction} className="space-y-2">
                      <input type="hidden" name="clientId" value={id} />
                      <input type="hidden" name="courseId" value={course.id} />
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          name="applyCreditsToFee"
                          value="true"
                          disabled={disabled || credits === 0}
                          defaultChecked={credits > 0}
                          className="h-4 w-4"
                        />
                        Apply current credits to the fee
                        {credits > 0 && (
                          <span>
                            (reduces ₹{course.fee.toLocaleString("en-IN")} → ₹{Math.max(0, course.fee - credits * 500).toLocaleString("en-IN")})
                          </span>
                        )}
                      </label>
                      <button
                        type="submit"
                        disabled={disabled}
                        className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Enrol
                      </button>
                    </form>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
