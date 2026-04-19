"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/rbac";
import { enableDistantGroup, addHealerUpdate, addClientFeedback } from "@/lib/distant-healing";

export async function enableGroupAction(formData: FormData) {
  await requireSession();
  const clientId = String(formData.get("clientId") ?? "");
  try {
    await enableDistantGroup({
      clientId,
      whatsappGroupName: String(formData.get("whatsappGroupName") ?? "") || undefined,
      whatsappGroupLink: String(formData.get("whatsappGroupLink") ?? "") || undefined,
      photoUrl: String(formData.get("photoUrl") ?? "") || undefined,
      problemAreas: String(formData.get("problemAreas") ?? "") || undefined,
    });
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "Failed");
    redirect(`/leads/${clientId}/distant-healing?error=${msg}`);
  }
  revalidatePath(`/leads/${clientId}/distant-healing`);
  revalidatePath(`/leads/${clientId}`);
}

export async function addHealerUpdateAction(formData: FormData) {
  await requireSession();
  const clientId = String(formData.get("clientId") ?? "");
  try {
    await addHealerUpdate({
      distantGroupId: String(formData.get("distantGroupId") ?? ""),
      healerId: String(formData.get("healerId") ?? ""),
      chakras: formData.getAll("chakras").map(String) as never,
      process: String(formData.get("process") ?? "") || undefined,
      durationMinutes: formData.get("durationMinutes")
        ? Number(formData.get("durationMinutes"))
        : undefined,
      remarks: String(formData.get("remarks") ?? "") || undefined,
      postedToWhatsApp: formData.get("postedToWhatsApp") === "true",
    });
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "Failed");
    redirect(`/leads/${clientId}/distant-healing?error=${msg}`);
  }
  revalidatePath(`/leads/${clientId}/distant-healing`);
}

export async function addFeedbackAction(formData: FormData) {
  await requireSession();
  const clientId = String(formData.get("clientId") ?? "");
  try {
    await addClientFeedback({
      clientId,
      content: String(formData.get("content") ?? ""),
      rating: formData.get("rating") ? Number(formData.get("rating")) : undefined,
    });
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "Failed");
    redirect(`/leads/${clientId}/distant-healing?error=${msg}`);
  }
  revalidatePath(`/leads/${clientId}/distant-healing`);
  revalidatePath(`/leads/${clientId}`);
}
