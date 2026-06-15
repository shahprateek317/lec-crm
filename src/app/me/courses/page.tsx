import Link from "next/link";
import { CheckCircle2, GraduationCap, Lock, CreditCard } from "lucide-react";
import { requireClient } from "@/lib/me-session";
import { prisma } from "@/lib/prisma";
import { checkEligibility } from "@/lib/courses";
import { getCreditBalance } from "@/lib/credits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { clientEnrolAction } from "./[id]/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Courses · Life Energy Centre" };

export default async function MyCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; enrolled?: string }>;
}) {
  const sp = await searchParams;
  const client = await requireClient("/me/courses");

  const [courses, enrollments, credits] = await Promise.all([
    prisma.course.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: {
        prerequisites: { include: { prerequisite: { select: { id: true, name: true } } } },
      },
    }),
    prisma.enrollment.findMany({
      where: { clientId: client.id, status: { not: "DROPPED" } },
      include: {
        payment: { select: { providerPaymentLinkUrl: true, status: true } },
      },
    }),
    getCreditBalance(client.id),
  ]);

  const enrollmentMap = new Map(enrollments.map((e) => [e.courseId, e]));

  const eligibilities = await Promise.all(
    courses.map(async (c) => ({ course: c, elig: await checkEligibility(client.id, c.id) })),
  );

  const myEnrollments = enrollments.filter(
    (e) => e.status === "ENROLLED" || e.status === "IN_PROGRESS" || e.status === "COMPLETED",
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h1 className="font-serif text-3xl font-medium tracking-tight">Courses</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          The Pranic Healing curriculum offered at Life Energy Centre.
        </p>
      </header>

      {sp.enrolled && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          You&apos;re enrolled! The centre will be in touch with next steps.
        </div>
      )}
      {sp.error && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}

      {myEnrollments.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            My enrolments
          </h2>
          <Card className="rounded-2xl">
            <CardContent className="divide-y divide-border p-0">
              {myEnrollments.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {courses.find((c) => c.id === e.courseId)?.name ?? "Course"}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {e.status.replace("_", " ").toLowerCase()}
                    </p>
                  </div>
                  {e.status === "COMPLETED" && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Available courses
        </h2>

        {credits > 0 && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            You have <strong>{credits} healing credit{credits === 1 ? "" : "s"}</strong> (worth{" "}
            ₹{(credits * 500).toLocaleString("en-IN")}). You can apply them toward any course fee.
          </p>
        )}

        <div className="grid gap-4">
          {eligibilities.map(({ course, elig }) => {
            const enrollment = enrollmentMap.get(course.id);
            const isPendingPayment = enrollment?.status === "PENDING_PAYMENT";
            const isEnrolled =
              enrollment?.status === "ENROLLED" ||
              enrollment?.status === "IN_PROGRESS" ||
              enrollment?.status === "COMPLETED";
            const creditReduction = Math.min(credits * 500, course.fee);
            const effectiveFee = course.fee - creditReduction;

            return (
              <Card key={course.id} className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-start justify-between gap-3 font-serif text-lg font-medium">
                    <span>{course.name}</span>
                    <span className="shrink-0 text-xl">₹{course.fee.toLocaleString("en-IN")}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {course.description && (
                    <p className="text-sm text-muted-foreground">{course.description}</p>
                  )}
                  {course.durationHours && (
                    <p className="text-xs text-muted-foreground">~{course.durationHours} hours</p>
                  )}
                  {course.prerequisites.length > 0 && (
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                      Requires: {course.prerequisites.map((p) => p.prerequisite.name).join(" · ")}
                    </p>
                  )}

                  {isPendingPayment && enrollment?.payment?.providerPaymentLinkUrl ? (
                    <div className="space-y-2 rounded-xl bg-amber-50 p-3">
                      <p className="text-sm text-amber-900">
                        Payment pending — complete it to confirm your enrolment.
                      </p>
                      <a
                        href={enrollment.payment.providerPaymentLinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        Pay now
                      </a>
                    </div>
                  ) : isEnrolled ? (
                    <p className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      {enrollment?.status === "COMPLETED" ? "Completed" : "Enrolled"}
                    </p>
                  ) : !elig.eligible ? (
                    <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                      <Lock className="mr-1.5 inline h-3 w-3" />
                      Complete first: {elig.missing.map((m) => m.name).join(", ")}
                    </p>
                  ) : (
                    <form action={clientEnrolAction} className="space-y-3">
                      <input type="hidden" name="courseId" value={course.id} />
                      {credits > 0 && (
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            name="applyCreditsToFee"
                            value="true"
                            defaultChecked
                            className="h-4 w-4 rounded"
                          />
                          Apply my credits — pay ₹{effectiveFee.toLocaleString("en-IN")} instead of{" "}
                          ₹{course.fee.toLocaleString("en-IN")}
                        </label>
                      )}
                      <SubmitButton
                        pendingLabel="Enrolling…"
                        className="inline-flex h-10 items-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        {effectiveFee === 0 ? "Enrol (free with credits)" : `Enrol · ₹${effectiveFee.toLocaleString("en-IN")}`}
                      </SubmitButton>
                    </form>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {eligibilities.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No courses are available right now. Check back soon.
            </p>
          )}
        </div>
      </section>

      <Link
        href="/me"
        className="block text-center text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to portal
      </Link>
    </div>
  );
}
