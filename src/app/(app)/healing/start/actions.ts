"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { startSession } from "@/lib/check-in";
import { transitionStage } from "@/lib/pipeline";
import type { HealingMode, HealingSessionType } from "@prisma/client";

/**
 * Healer-initiated session start. Creates a draft HealingSession with
 * startedAt = now and a check-in token, sends the client a WhatsApp link
 * via startSession(), then redirects the healer to the in-progress page.
 */
export async function startSessionAction(formData: FormData) {
  const session = await requireSession();
  const clientId = String(formData.get("clientId") ?? "");
  const mode = (String(formData.get("mode") ?? "IN_PERSON")) as HealingMode;
  const sessionType = (String(formData.get("sessionType") ?? "PAID")) as HealingSessionType;
  if (!clientId) redirect("/healing/start?error=client_required");

  // Draft session. Chakras, notes, colours, durationMinutes get filled in
  // later by the existing /leads/[id]/healing/log flow.
  const draft = await prisma.healingSession.create({
    data: {
      clientId,
      healerId: session.user.id,
      mode,
      sessionType,
      // Saved later — provide schema-required defaults now.
      creditUsed: sessionType !== "DEMO",
    },
  });

  // Generate the start check-in token + send the WhatsApp template.
  // startSession() also stamps startedAt = now and returns the URL.
  await startSession(draft.id);

  // Move the client into HEALING_ACTIVE if not already past it.
  await transitionStage({
    clientId,
    toStage: "HEALING_ACTIVE",
    byUserId: session.user.id,
  }).catch(() => { /* idempotent — already past this stage is fine */ });

  redirect(`/healing/in-progress/${draft.id}`);
}
