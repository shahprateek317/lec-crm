import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Lock } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Courses" };

export default async function CoursesPage() {
  const courses = await prisma.course.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: {
      prerequisites: { include: { prerequisite: { select: { name: true } } } },
      _count: { select: { enrollments: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <GraduationCap className="h-7 w-7 text-primary" />
          Courses
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The Pranic Healing curriculum. To enrol a client, open their lead page and tap
          &quot;Enrol in course&quot;.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {courses.map((c) => (
          <Card key={c.id} className="rounded-xl">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-lg font-medium">{c.name}</p>
                  {c.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                  )}
                </div>
                <p className="shrink-0 font-serif text-xl font-medium">
                  ₹{c.fee.toLocaleString("en-IN")}
                </p>
              </div>
              {c.durationHours && (
                <p className="text-xs text-muted-foreground">
                  ~{c.durationHours} hours
                </p>
              )}
              {c.prerequisites.length > 0 && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Lock className="mt-0.5 h-3 w-3" />
                  <span>
                    Prereq: {c.prerequisites.map((p) => p.prerequisite.name).join(" · ")}
                  </span>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {c._count.enrollments} enrolment{c._count.enrollments === 1 ? "" : "s"} total
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
