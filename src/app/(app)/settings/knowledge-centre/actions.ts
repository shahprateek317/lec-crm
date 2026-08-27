"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

async function nextFaqCode(): Promise<string> {
  const last = await prisma.faqEntry.findFirst({
    orderBy: { faqCode: "desc" },
    select: { faqCode: true },
  });
  if (!last) return "FAQ-001";
  const num = parseInt(last.faqCode.replace("FAQ-", ""), 10);
  return `FAQ-${String(num + 1).padStart(3, "0")}`;
}

export async function saveFaqAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const question = String(formData.get("question") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim();
  const keywords = String(formData.get("keywords") ?? "")
    .split(",").map((k) => k.trim()).filter(Boolean);
  const relatedService = String(formData.get("relatedService") ?? "").trim() || null;
  const displayOrder = parseInt(String(formData.get("displayOrder") ?? "0"), 10) || 0;
  const internalNote = String(formData.get("internalNote") ?? "").trim() || null;
  const active = formData.get("active") === "true";

  if (!category || !question || !answer) {
    redirect("/settings/knowledge-centre?error=missing_fields");
  }

  if (id) {
    const existing = await prisma.faqEntry.findUnique({ where: { id }, select: { version: true } });
    await prisma.faqEntry.update({
      where: { id },
      data: {
        category, question, answer, keywords, relatedService,
        displayOrder, internalNote, active,
        version: (existing?.version ?? 1) + 1,
        lastReviewedAt: new Date(),
        reviewedBy: session.user.name ?? session.user.email ?? "Admin",
      },
    });
  } else {
    const faqCode = await nextFaqCode();
    await prisma.faqEntry.create({
      data: {
        faqCode, category, question, answer, keywords, relatedService,
        displayOrder, internalNote, active,
        lastReviewedAt: new Date(),
        reviewedBy: session.user.name ?? session.user.email ?? "Admin",
      },
    });
  }

  revalidatePath("/settings/knowledge-centre");
  revalidatePath("/me/help");
  redirect("/settings/knowledge-centre?ok=1");
}

export async function toggleFaqAction(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const current = await prisma.faqEntry.findUnique({ where: { id }, select: { active: true } });
  if (!current) return;
  await prisma.faqEntry.update({ where: { id }, data: { active: !current.active } });
  revalidatePath("/settings/knowledge-centre");
  revalidatePath("/me/help");
  redirect("/settings/knowledge-centre?ok=1");
}
