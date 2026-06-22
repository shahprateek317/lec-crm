// Centralised helpers for staff/user creation, role profile sync, and
// auto-generated employee codes. Used by /settings/users pages and seed.

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

const ROLE_PREFIX: Partial<Record<Role, string>> = {
  SUPER_ADMIN: "LEC-SA",
  ADMIN: "LEC-A",
  COORDINATOR: "LEC-X",
  COUNSELLOR: "LEC-C",
  SENIOR_COUNSELLOR: "LEC-CS",
  HEALER: "LEC-H",
  SENIOR_HEALER: "LEC-HS",
  ACCOUNTS: "LEC-F",
  MARKETING_MANAGER: "LEC-M",
  VIEWER: "LEC-V",
};

export async function nextEmployeeCode(role: Role): Promise<string> {
  const prefix = ROLE_PREFIX[role] ?? "LEC-X";
  const last = await prisma.user.findFirst({
    where: { employeeCode: { startsWith: `${prefix}` } },
    orderBy: { employeeCode: "desc" },
    select: { employeeCode: true },
  });
  let n = 1;
  if (last?.employeeCode) {
    const m = last.employeeCode.match(/(\d+)$/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(n).padStart(3, "0")}`;
}

export async function ensureProfile(userId: string, role: Role): Promise<void> {
  // Create the appropriate role-specific profile row if missing. Idempotent.
  if (role === "HEALER" || role === "SENIOR_HEALER") {
    await prisma.healerProfile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }
  if (role === "COUNSELLOR" || role === "SENIOR_COUNSELLOR") {
    await prisma.counsellorProfile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }
  if (role === "COORDINATOR") {
    await prisma.coordinatorProfile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    await prisma.adminProfile.upsert({
      where: { userId },
      create: { userId, isSuperAdmin: role === "SUPER_ADMIN" },
      update: { isSuperAdmin: role === "SUPER_ADMIN" },
    });
  }
}

export type CreateUserInput = {
  email: string;
  name: string;
  phone?: string;
  whatsappPhone?: string;
  roles: Role[];
  password: string;
};

export async function createUser(input: CreateUserInput) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const primaryRole = input.roles[0];
  const code = await nextEmployeeCode(primaryRole);
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name,
      phone: input.phone,
      whatsappPhone: input.whatsappPhone,
      roles: input.roles,
      passwordHash,
      employeeCode: code,
      active: true,
    },
  });
  for (const role of user.roles) {
    await ensureProfile(user.id, role);
  }
  return user;
}
