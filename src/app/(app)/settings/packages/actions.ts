"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  amount: z.coerce.number().int().positive(),
  credits: z.coerce.number().int().positive(),
});

export async function createPackageAction(formData: FormData) {
  await requireRole("ADMIN");
  const parsed = schema.safeParse({
    name: formData.get("name"),
    amount: formData.get("amount"),
    credits: formData.get("credits"),
  });
  if (!parsed.success) {
    redirect(`/settings/packages?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }
  const count = await prisma.creditPackage.count();
  await prisma.creditPackage.create({
    data: { ...parsed.data, sortOrder: count + 1, active: true },
  });
  revalidatePath("/settings/packages");
  redirect("/settings/packages?ok=1");
}

export async function updatePackageAction(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const parsed = schema.safeParse({
    name: formData.get("name"),
    amount: formData.get("amount"),
    credits: formData.get("credits"),
  });
  if (!id || !parsed.success) throw new Error("Invalid input");
  await prisma.creditPackage.update({
    where: { id },
    data: {
      ...parsed.data,
      active: formData.get("active") === "true",
    },
  });
  revalidatePath("/settings/packages");
}
