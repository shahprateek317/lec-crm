import { NextResponse } from "next/server";
import { createLead, leadInputSchema } from "@/lib/leads";

/**
 * Public lead-capture endpoint for webhook-driven sources (FB/Insta ads,
 * landing pages, Zapier, etc.). Internal UI uses the server action in
 * `src/app/enquiry/actions.ts`.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = leadInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const { client, created } = await createLead(parsed.data);
  return NextResponse.json({ ok: true, created, client: { id: client.id, stage: client.stage } }, { status: created ? 201 : 200 });
}
