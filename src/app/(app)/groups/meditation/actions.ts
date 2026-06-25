"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { sendStagePair } from "@/lib/followup-wa";
import type { MeditationMemberStatus } from "@prisma/client";

export async function addMeditationMemberAction(formData: FormData) {
  await requireSession();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) throw new Error("Client required");

  await prisma.meditationGroupMembership.upsert({
    where: { clientId },
    create: { clientId, status: "ACTIVE", joinedAt: new Date(), updatedAt: new Date() },
    update: { status: "ACTIVE", updatedAt: new Date() },
  });

  await prisma.client.update({
    where: { id: clientId },
    data: { currentAction: "MEDITATION_GROUP" },
  });

  revalidatePath("/groups/meditation");
}

export async function updateMemberStatusAction(formData: FormData) {
  await requireSession();
  const clientId = String(formData.get("clientId") ?? "");
  const status = String(formData.get("status") ?? "") as MeditationMemberStatus;

  await prisma.meditationGroupMembership.update({
    where: { clientId },
    data: { status, updatedAt: new Date() },
  });

  revalidatePath("/groups/meditation");
}

export async function sendMeditationThankYouAction(formData: FormData) {
  await requireSession();
  const clientIds = String(formData.get("clientIds") ?? "").split(",").filter(Boolean);
  if (clientIds.length === 0) throw new Error("No clients selected");

  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds } },
    select: { id: true, name: true, phone: true },
  });

  const dateStr = format(new Date(), "dd MMM yyyy");

  for (const c of clients) {
    const firstName = c.name.split(" ")[0];
    sendStagePair("meditation", {
      clientId: c.id,
      phone: c.phone,
      variables: [firstName, dateStr],
    }).catch((err) => console.error("[meditation group] followup WA failed", err));
  }

  revalidatePath("/groups/meditation");
  redirect("/groups/meditation?ok=sent");
}
