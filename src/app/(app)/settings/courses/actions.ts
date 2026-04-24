"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

const createSchema = z.object({
  name: z.string().trim().min(2).max(200),
  fee: z.coerce.number().int().min(0),
  durationHours: z.coerce.number().int().positive().optional(),
  description: z.string().trim().max(2000).optional(),
});

export async function createCourseAction(formData: FormData) {
  await requireRole("ADMIN");
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    fee: formData.get("fee"),
    durationHours: formData.get("durationHours") || undefined,
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    redirect(`/settings/courses?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }
  const count = await prisma.course.count();
  const existing = await prisma.course.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    redirect(`/settings/courses?error=${encodeURIComponent("A course with that name already exists.")}`);
  }
  await prisma.course.create({
    data: {
      ...parsed.data,
      sortOrder: count + 1,
      active: true,
    },
  });
  revalidatePath("/settings/courses");
  redirect("/settings/courses?ok=1");
}

export async function updateCourseAction(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    fee: formData.get("fee"),
    durationHours: formData.get("durationHours") || undefined,
    description: formData.get("description") || undefined,
  });
  if (!id || !parsed.success) throw new Error("Invalid input");
  await prisma.course.update({
    where: { id },
    data: {
      ...parsed.data,
      active: formData.get("active") === "true",
    },
  });
  revalidatePath("/settings/courses");
  revalidatePath("/courses");
}

export async function addPrereqAction(formData: FormData) {
  await requireRole("ADMIN");
  const courseId = String(formData.get("courseId") ?? "");
  const prerequisiteId = String(formData.get("prerequisiteId") ?? "");
  if (!courseId || !prerequisiteId) throw new Error("Missing ids");
  if (courseId === prerequisiteId) {
    redirect(`/settings/courses?error=${encodeURIComponent("A course can't be its own prerequisite.")}`);
  }
  await prisma.coursePrerequisite.upsert({
    where: { courseId_prerequisiteId: { courseId, prerequisiteId } },
    create: { courseId, prerequisiteId },
    update: {},
  });
  revalidatePath("/settings/courses");
}

export async function removePrereqAction(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  await prisma.coursePrerequisite.delete({ where: { id } });
  revalidatePath("/settings/courses");
}
