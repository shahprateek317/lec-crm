"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { sendStagePair } from "@/lib/followup-wa";
import type { AttendanceStatus } from "@prisma/client";

export async function createPranicSessionAction(formData: FormData) {
  await requireSession();
  const scheduledAt = String(formData.get("scheduledAt") ?? "");
  const notes = String(formData.get("notes") ?? "") || null;
  if (!scheduledAt) throw new Error("Date required");

  const session = await prisma.pranicGroupSession.create({
    data: { scheduledAt: new Date(scheduledAt), notes, updatedAt: new Date() },
  });
  revalidatePath("/groups/pranic");
  redirect(`/groups/pranic/${session.id}`);
}

export async function addClientToSessionAction(formData: FormData) {
  await requireSession();
  const sessionId = String(formData.get("sessionId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!sessionId || !clientId) throw new Error("Missing fields");

  await prisma.pranicGroupAttendance.upsert({
    where: { sessionId_clientId: { sessionId, clientId } },
    create: { sessionId, clientId, status: "REGISTERED", updatedAt: new Date() },
    update: {},
  });

  // Update lead action
  await prisma.client.update({
    where: { id: clientId },
    data: { currentAction: "INTRO_PRANIC_HEALING_GROUP" },
  });

  revalidatePath(`/groups/pranic/${sessionId}`);
}

export async function updateAttendanceAction(formData: FormData) {
  await requireSession();
  const sessionId = String(formData.get("sessionId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const status = String(formData.get("status") ?? "") as AttendanceStatus;

  await prisma.pranicGroupAttendance.update({
    where: { sessionId_clientId: { sessionId, clientId } },
    data: { status, updatedAt: new Date() },
  });

  revalidatePath(`/groups/pranic/${sessionId}`);
}

export async function sendPranicThankYouAction(formData: FormData) {
  await requireSession();
  const sessionId = String(formData.get("sessionId") ?? "");

  const session = await prisma.pranicGroupSession.findUnique({
    where: { id: sessionId },
    include: {
      attendances: {
        where: { status: "ATTENDED" },
        include: { client: { select: { id: true, name: true, phone: true } } },
      },
    },
  });
  if (!session) throw new Error("Session not found");

  const dateStr = format(session.scheduledAt, "dd MMM yyyy");

  for (const att of session.attendances) {
    const firstName = att.client.name.split(" ")[0];
    sendStagePair("pranic_group", {
      clientId: att.client.id,
      phone: att.client.phone,
      variables: [firstName, dateStr],
    }).catch((err) => console.error("[pranic group] followup WA failed", err));
  }

  revalidatePath(`/groups/pranic/${sessionId}`);
  redirect(`/groups/pranic/${sessionId}?ok=sent`);
}
