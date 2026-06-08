"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { periodSchema } from "@/lib/payout";
import { audit } from "@/lib/audit";

const recordPayoutSchema = z.object({
  healerId:   z.string().min(1),
  period:     periodSchema,
  gross:      z.coerce.number().int().min(0),
  deductions: z.coerce.number().int().min(0).default(0),
  paidAt:     z.string().datetime({ local: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  paymentRef: z.string().max(200).optional(),
  notes:      z.string().max(1000).optional(),
});

export async function recordPayoutAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) redirect("/dashboard");

  const raw = {
    healerId:   formData.get("healerId"),
    period:     formData.get("period"),
    gross:      formData.get("gross"),
    deductions: formData.get("deductions") || "0",
    paidAt:     formData.get("paidAt"),
    paymentRef: formData.get("paymentRef") || undefined,
    notes:      formData.get("notes") || undefined,
  };

  const parsed = recordPayoutSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/settings/payouts?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const { healerId, period, gross, deductions, paidAt, paymentRef, notes } = parsed.data;
  const net = gross - deductions;
  if (net < 0) {
    redirect("/settings/payouts?error=Deductions+cannot+exceed+gross+earnings");
  }

  // Verify healerId actually belongs to a healer-role user (prevent IDOR)
  const healer = await prisma.user.findUnique({ where: { id: healerId }, select: { role: true, name: true } });
  if (!healer || !["HEALER", "SENIOR_HEALER"].includes(healer.role)) {
    redirect("/settings/payouts?error=Invalid+healer");
  }

  await prisma.healerPayout.upsert({
    where:  { healerId_period: { healerId, period } },
    update: { gross, deductions, net, paidAt: new Date(paidAt), paymentRef: paymentRef ?? null, notes: notes ?? null, createdById: session.user.id },
    create: { healerId, period, gross, deductions, net, paidAt: new Date(paidAt), paymentRef: paymentRef ?? null, notes: notes ?? null, createdById: session.user.id },
  });

  await audit("PAYOUT_RECORDED", "User", healerId, {
    actorId: session.user.id,
    meta: { period, gross, deductions, net },
  });

  redirect("/settings/payouts?ok=Payout+recorded");
}

export async function deletePayoutAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) redirect("/dashboard");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/settings/payouts?error=Missing+payout+id");

  const payout = await prisma.healerPayout.findUnique({ where: { id }, select: { id: true, healerId: true, period: true } });
  if (!payout) redirect("/settings/payouts?error=Payout+not+found");

  await prisma.healerPayout.delete({ where: { id } });

  await audit("PAYOUT_DELETED", "User", payout.healerId, {
    actorId: session.user.id,
    meta: { period: payout.period },
  });

  redirect("/settings/payouts?ok=Payout+deleted");
}
