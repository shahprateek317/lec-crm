"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import type { Role } from "@prisma/client";

const createSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "COORDINATOR", "COUNSELLOR", "HEALER"]),
  password: z.string().min(6),
});

export async function createUserAction(formData: FormData) {
  await requireRole("ADMIN");
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: String(formData.get("email") ?? "").toLowerCase(),
    phone: String(formData.get("phone") ?? "") || undefined,
    role: formData.get("role"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const msg = encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input");
    redirect(`/settings/users?error=${msg}`);
  }

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) {
    redirect(`/settings/users?error=${encodeURIComponent("An account with that email already exists.")}`);
  }

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      role: parsed.data.role,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      active: true,
    },
  });
  revalidatePath("/settings/users");
  redirect("/settings/users?ok=1");
}

export async function updateUserAction(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "");
  const phone = String(formData.get("phone") ?? "") || null;
  const role = String(formData.get("role") ?? "") as Role;
  const active = formData.get("active") === "true";
  if (!id || !name) throw new Error("Missing id or name");
  await prisma.user.update({
    where: { id },
    data: { name, phone, role, active },
  });
  revalidatePath("/settings/users");
}
