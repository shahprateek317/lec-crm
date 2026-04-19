"use server";

import { redirect } from "next/navigation";
import { createLead, leadInputSchema } from "@/lib/leads";
import { requireSession } from "@/lib/rbac";

export async function createLeadAction(formData: FormData) {
  await requireSession();

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const silent = raw.silent === "true";

  const parsed = leadInputSchema.safeParse({
    name: raw.name,
    phone: raw.phone,
    email: raw.email || undefined,
    age: raw.age || undefined,
    area: raw.area || undefined,
    issue: raw.issue || undefined,
    issueDuration: raw.issueDuration || undefined,
    source: raw.source || "MANUAL",
    notes: raw.notes || undefined,
    assignedToId: raw.assignedToId || undefined,
  });

  if (!parsed.success) {
    const msg = encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input");
    redirect(`/leads/new?error=${msg}`);
  }

  const { client } = await createLead(parsed.data, { silent });
  redirect(`/leads/${client.id}`);
}
