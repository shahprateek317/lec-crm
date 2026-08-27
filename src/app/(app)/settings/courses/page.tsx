import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Plus, Lock } from "lucide-react";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlashToaster } from "@/components/flash-toaster";
import { createCourseAction, updateCourseAction, addPrereqAction, removePrereqAction } from "./actions";

export const metadata = { title: "Courses" };

export default async function CoursesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.roles)) redirect("/dashboard");
  const sp = await searchParams;

  const courses = await prisma.course.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: {
      prerequisites: { include: { prerequisite: { select: { id: true, name: true } } } },
    },
  });

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Back to settings
      </Link>

      <header>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Courses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Course names, fees, descriptions and prerequisite chains. Clients can only enrol once every
          prerequisite is marked completed.
        </p>
      </header>

      <FlashToaster />

      <Card className="rounded-xl">
        <CardContent className="p-6">
          <div className="mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Add a course</p>
          </div>
          <form action={createCourseAction} className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
            <input name="name" placeholder="Course name" required minLength={2} className={inputCls} />
            <input name="fee" type="number" min={0} placeholder="Fee (â‚¹)" required className={inputCls} />
            <input name="durationHours" type="number" min={1} placeholder="Hours" className={inputCls} />
            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
              Add
            </button>
            <textarea
              name="description"
              rows={2}
              placeholder="Short description (optional)"
              className={`${inputCls} min-h-16 resize-y py-2 md:col-span-4`}
            />
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {courses.map((c) => (
          <Card key={c.id} className="rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-lg font-medium">{c.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form action={updateCourseAction} className="space-y-3">
                <input type="hidden" name="id" value={c.id} />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input name="name" defaultValue={c.name} required minLength={2} className={inputCls} />
                  <input name="fee" type="number" min={0} defaultValue={c.fee} required className={inputCls} placeholder="Fee â‚¹" />
                  <input name="durationHours" type="number" min={0} defaultValue={c.durationHours ?? ""} className={inputCls} placeholder="Hours" />
                  <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm">
                    <input type="checkbox" name="active" value="true" defaultChecked={c.active} className="h-4 w-4" />
                    Active
                  </label>
                </div>
                <textarea
                  name="description"
                  defaultValue={c.description ?? ""}
                  rows={2}
                  className={`${inputCls} min-h-16 resize-y py-2`}
                  placeholder="Description"
                />
                <button type="submit" className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted">
                  Save
                </button>
              </form>

              <div className="space-y-2 border-t border-border pt-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Prerequisites
                </p>
                {c.prerequisites.length === 0 && (
                  <p className="text-xs text-muted-foreground">None.</p>
                )}
                {c.prerequisites.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-1.5">
                    <span className="text-sm">{p.prerequisite.name}</span>
                    <form action={removePrereqAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="text-xs text-destructive hover:underline">
                        Remove
                      </button>
                    </form>
                  </div>
                ))}
                <form action={addPrereqAction} className="flex gap-2">
                  <input type="hidden" name="courseId" value={c.id} />
                  <select name="prerequisiteId" defaultValue="" required className={`${inputCls} flex-1`}>
                    <option value="" disabled>Add a prerequisiteâ€¦</option>
                    {courses
                      .filter((o) => o.id !== c.id && !c.prerequisites.some((p) => p.prerequisiteId === o.id))
                      .map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                  </select>
                  <button type="submit" className="inline-flex h-10 items-center rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted">
                    Add
                  </button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

const inputCls =
  "flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
