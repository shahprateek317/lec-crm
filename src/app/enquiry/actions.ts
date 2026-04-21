"use server";

import { redirect } from "next/navigation";
import { createLead, leadInputSchema } from "@/lib/leads";

export async function submitEnquiry(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = leadInputSchema.safeParse({
    name: raw.name,
    phone: raw.phone,
    ageBucket: raw.ageBucket || undefined,
    areaCategory: raw.areaCategory || undefined,
    area: raw.area || undefined,
    issueCategory: raw.issueCategory || undefined,
    issue: raw.issue || undefined,
    durationBucket: raw.durationBucket || undefined,
    preferredTimeSlot: raw.preferredTimeSlot || undefined,
    source: raw.source || "MANUAL",
  });
  if (!parsed.success) {
    const msg = encodeURIComponent(
      parsed.error.issues[0]?.message ?? "Please check the form and try again.",
    );
    redirect(`/enquiry?error=${msg}`);
  }
  await createLead(parsed.data);
  redirect("/enquiry/thanks");
}
