import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const faqs = await prisma.faqEntry.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { displayOrder: "asc" }, { faqCode: "asc" }],
    select: { id: true, faqCode: true, category: true, question: true, answer: true, keywords: true },
  });
  return NextResponse.json(faqs);
}
