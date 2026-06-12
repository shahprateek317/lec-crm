"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { createUser, ensureProfile } from "@/lib/users";
import { sendEmail } from "@/lib/providers/email";
import type { Role } from "@prisma/client";

function welcomeEmailHtml(name: string, email: string, password: string, role: string): string {
  const loginUrl = "https://crm.lifeenergycentre.in/sign-in";
  const roleName = role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f9f9f9;margin:0;padding:32px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:36px;border:1px solid #e5e7eb;">
    <h2 style="color:#1a1a1a;margin-top:0;">Welcome to Life Energy Centre CRM</h2>
    <p style="color:#444;">Namaste ${name},</p>
    <p style="color:#444;">Your staff account has been created. Here are your login details:</p>
    <table style="width:100%;margin:24px 0;border-collapse:collapse;">
      <tr><td style="padding:8px 12px;background:#f3f4f6;border-radius:6px 6px 0 0;color:#6b7280;font-size:13px;">Role</td><td style="padding:8px 12px;background:#f3f4f6;border-radius:6px 6px 0 0;font-weight:600;">${roleName}</td></tr>
      <tr><td style="padding:8px 12px;background:#f9fafb;color:#6b7280;font-size:13px;">Email</td><td style="padding:8px 12px;background:#f9fafb;font-weight:600;">${email}</td></tr>
      <tr><td style="padding:8px 12px;background:#f3f4f6;border-radius:0 0 6px 6px;color:#6b7280;font-size:13px;">Password</td><td style="padding:8px 12px;background:#f3f4f6;border-radius:0 0 6px 6px;font-weight:600;font-family:monospace;">${password}</td></tr>
    </table>
    <a href="${loginUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;margin-bottom:24px;">Sign In to CRM</a>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">Please change your password after signing in for the first time.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">Life Energy Centre · New Town, Kolkata</p>
  </div>
</body>
</html>`;
}

function welcomeEmailText(name: string, email: string, password: string, role: string): string {
  const roleName = role.replace(/_/g, " ");
  return `Namaste ${name},\n\nYour Life Energy Centre CRM account has been created.\n\nRole: ${roleName}\nEmail: ${email}\nPassword: ${password}\n\nSign in at: https://crm.lifeenergycentre.in/sign-in\n\nPlease change your password after signing in.\n\nLife Energy Centre`;
}

const ROLES = [
  "SUPER_ADMIN", "ADMIN", "COORDINATOR", "COUNSELLOR", "SENIOR_COUNSELLOR",
  "HEALER", "SENIOR_HEALER", "ACCOUNTS", "MARKETING_MANAGER", "VIEWER",
] as const;

const createSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  role: z.enum(ROLES),
  password: z.string().min(6),
});

export async function createUserAction(formData: FormData) {
  await requireAdmin();
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: String(formData.get("email") ?? "").toLowerCase(),
    role: formData.get("role"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect(`/settings/users?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) {
    redirect(`/settings/users?error=${encodeURIComponent("An account with that email already exists.")}`);
  }

  const user = await createUser(parsed.data);

  // Send welcome email — fire and forget so a mail failure doesn't block the redirect.
  sendEmail({
    to: user.email,
    subject: "Welcome to Life Energy Centre CRM",
    html: welcomeEmailHtml(user.name, user.email, parsed.data.password, user.role),
    text: welcomeEmailText(user.name, user.email, parsed.data.password, user.role),
  }).catch(err => console.error("[users] welcome email failed", err));

  revalidatePath("/settings/users");
  // Send the admin straight into the detail page to fill the rich profile.
  redirect(`/settings/users/${user.id}?ok=1`);
}

const basicsSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2),
  phone: z.string().trim().optional().or(z.literal("")),
  whatsappPhone: z.string().trim().optional().or(z.literal("")),
  role: z.enum(ROLES),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional().or(z.literal("")),
  dob: z.string().optional().or(z.literal("")),
  joiningDate: z.string().optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  areaCity: z.string().trim().max(120).optional().or(z.literal("")),
  emergencyContact: z.string().trim().max(50).optional().or(z.literal("")),
  remarks: z.string().trim().max(500).optional().or(z.literal("")),
  active: z.string().optional(),
});

export async function updateUserBasicsAction(formData: FormData) {
  await requireAdmin();
  const parsed = basicsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const before = await prisma.user.findUniqueOrThrow({ where: { id: parsed.data.id } });
  const newRole = parsed.data.role as Role;

  await prisma.user.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      whatsappPhone: parsed.data.whatsappPhone || null,
      role: newRole,
      gender: parsed.data.gender ? (parsed.data.gender as "MALE") : null,
      dob: parsed.data.dob ? new Date(parsed.data.dob) : null,
      joiningDate: parsed.data.joiningDate ? new Date(parsed.data.joiningDate) : null,
      address: parsed.data.address || null,
      areaCity: parsed.data.areaCity || null,
      emergencyContact: parsed.data.emergencyContact || null,
      remarks: parsed.data.remarks || null,
      active: formData.get("active") === "true",
    },
  });

  // If role changed, make sure the right profile exists for the new role.
  if (before.role !== newRole) {
    await ensureProfile(parsed.data.id, newRole);
  }

  revalidatePath(`/settings/users/${parsed.data.id}`);
  revalidatePath("/settings/users");
  redirect(`/settings/users/${parsed.data.id}?ok=1`);
}

// ── Healer profile ────────────────────────────────────────────────
const PH_LEVELS = ["BPH", "APH", "PSYCHOTHERAPY", "CRYSTAL_HEALING", "ARHATIC_PREP", "ACPH", "CPH", "KRIYASHAKTI", "TWIN_HEART_TRAINER", "OTHER"] as const;
const TIME_BANDS = ["EARLY_MORNING", "MORNING", "AFTERNOON", "EVENING", "NIGHT"] as const;
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

// Parse "DAY:BAND" pairs from the AvailabilityGrid into the legacy
// preferredTimeBands + availableDays arrays so reports/queries that haven't
// been migrated yet keep working.
function deriveFromSlots(rawSlots: string[]) {
  const validSlots: string[] = [];
  const days = new Set<string>();
  const bands = new Set<string>();
  for (const s of rawSlots) {
    const [d, b] = s.split(":");
    if ((DAYS as readonly string[]).includes(d) && (TIME_BANDS as readonly string[]).includes(b)) {
      validSlots.push(`${d}:${b}`);
      days.add(d);
      bands.add(b);
    }
  }
  return {
    availabilitySlots: validSlots,
    availableDays: Array.from(days) as Array<typeof DAYS[number]>,
    preferredTimeBands: Array.from(bands) as Array<typeof TIME_BANDS[number]>,
  };
}

export async function updateHealerProfileAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("Missing userId");
  await ensureProfile(userId, "HEALER");

  const csvList = (key: string): string[] =>
    String(formData.get(key) ?? "").split(",").map(s => s.trim()).filter(Boolean);

  const phLevels = formData.getAll("phLevels").map(String).filter(v => (PH_LEVELS as readonly string[]).includes(v)) as Array<typeof PH_LEVELS[number]>;
  const slotData = deriveFromSlots(formData.getAll("availabilitySlots").map(String));

  await prisma.healerProfile.update({
    where: { userId },
    data: {
      experienceYears: formData.get("experienceYears") ? Number(formData.get("experienceYears")) : null,
      phLevels,
      languages: csvList("languages"),
      acceptsInPerson: formData.get("acceptsInPerson") === "true",
      acceptsDistant: formData.get("acceptsDistant") === "true",
      availabilitySlots: slotData.availabilitySlots,
      preferredTimeBands: slotData.preferredTimeBands,
      availableDays: slotData.availableDays,
      maxHealingsPerDay: formData.get("maxHealingsPerDay") ? Number(formData.get("maxHealingsPerDay")) : null,
      daysPriorNoticeRequired: formData.get("daysPriorNoticeRequired") ? Number(formData.get("daysPriorNoticeRequired")) : 0,
      emergencySameDay: formData.get("emergencySameDay") === "true",
      canVisitCentre: formData.get("canVisitCentre") === "true",
      homeVisitPossible: formData.get("homeVisitPossible") === "true",
      acceptsDemoFree: formData.get("acceptsDemoFree") === "true",
      acceptsPaidOnly: formData.get("acceptsPaidOnly") === "true",
      acceptsNewLeads: formData.get("acceptsNewLeads") === "true",
      prefersRepeatClients: formData.get("prefersRepeatClients") === "true",
      focusAreas: csvList("focusAreas"),
      perSessionCharge: formData.get("perSessionCharge") ? Number(formData.get("perSessionCharge")) : null,
      demoSessionCharge: formData.get("demoSessionCharge") ? Number(formData.get("demoSessionCharge")) : null,
      revenueSharePercent: formData.get("revenueSharePercent") ? Number(formData.get("revenueSharePercent")) : null,
      paymentMode: String(formData.get("paymentMode") ?? "") || null,
      acceptsUrgentCases: formData.get("acceptsUrgentCases") === "true",
      acceptsChildCases: formData.get("acceptsChildCases") === "true",
      acceptsElderlyCases: formData.get("acceptsElderlyCases") === "true",
      weekendAvailable: formData.get("weekendAvailable") === "true",
      groupHealingAvailable: formData.get("groupHealingAvailable") === "true",
    },
  });
  revalidatePath(`/settings/users/${userId}`);
  redirect(`/settings/users/${userId}?ok=1`);
}

// ── Counsellor profile ────────────────────────────────────────────
export async function updateCounsellorProfileAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("Missing userId");
  await ensureProfile(userId, "COUNSELLOR");

  const csvList = (key: string): string[] =>
    String(formData.get(key) ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const slotData = deriveFromSlots(formData.getAll("availabilitySlots").map(String));

  await prisma.counsellorProfile.update({
    where: { userId },
    data: {
      experienceYears: formData.get("experienceYears") ? Number(formData.get("experienceYears")) : null,
      languages: csvList("languages"),
      specializations: csvList("specializations"),
      acceptsOnline: formData.get("acceptsOnline") === "true",
      acceptsOffline: formData.get("acceptsOffline") === "true",
      availabilitySlots: slotData.availabilitySlots,
      preferredTimeBands: slotData.preferredTimeBands,
      maxSessionsPerDay: formData.get("maxSessionsPerDay") ? Number(formData.get("maxSessionsPerDay")) : null,
      canCloseLead: formData.get("canCloseLead") === "true",
      canAssignVisit: formData.get("canAssignVisit") === "true",
      incentiveEligible: formData.get("incentiveEligible") === "true",
    },
  });
  revalidatePath(`/settings/users/${userId}`);
  redirect(`/settings/users/${userId}?ok=1`);
}

// ── Coordinator profile ───────────────────────────────────────────
export async function updateCoordinatorProfileAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("Missing userId");
  await ensureProfile(userId, "COORDINATOR");
  const csvList = (key: string): string[] =>
    String(formData.get(key) ?? "").split(",").map(s => s.trim()).filter(Boolean);

  await prisma.coordinatorProfile.update({
    where: { userId },
    data: {
      handlesLeads: formData.get("handlesLeads") === "true",
      handlesFollowUp: formData.get("handlesFollowUp") === "true",
      handlesWhatsAppGroups: formData.get("handlesWhatsAppGroups") === "true",
      handlesPaymentFollowUp: formData.get("handlesPaymentFollowUp") === "true",
      handlesScheduling: formData.get("handlesScheduling") === "true",
      maxCallsPerDay: formData.get("maxCallsPerDay") ? Number(formData.get("maxCallsPerDay")) : null,
      shiftTiming: String(formData.get("shiftTiming") ?? "") || null,
      languages: csvList("languages"),
    },
  });
  revalidatePath(`/settings/users/${userId}`);
  redirect(`/settings/users/${userId}?ok=1`);
}

// ── Admin profile ─────────────────────────────────────────────────
export async function updateAdminProfileAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("Missing userId");
  await ensureProfile(userId, "ADMIN");

  await prisma.adminProfile.update({
    where: { userId },
    data: {
      isSuperAdmin: formData.get("isSuperAdmin") === "true",
      fullCrmAccess: formData.get("fullCrmAccess") === "true",
      userCreationRights: formData.get("userCreationRights") === "true",
      reportAccess: formData.get("reportAccess") === "true",
      financeAccess: formData.get("financeAccess") === "true",
      dashboardAccess: formData.get("dashboardAccess") === "true",
    },
  });
  revalidatePath(`/settings/users/${userId}`);
  redirect(`/settings/users/${userId}?ok=1`);
}

export async function resetPasswordAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  if (!id || newPassword.length < 6) {
    redirect(`/settings/users/${id}?error=${encodeURIComponent("Password must be at least 6 characters.")}`);
  }
  const bcrypt = await import("bcryptjs");
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.default.hash(newPassword, 10) },
  });
  revalidatePath(`/settings/users/${id}`);
  redirect(`/settings/users/${id}?ok=1`);
}
