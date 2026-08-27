"use server";

// Server actions for /me/sign-in.
//   • requestSignInAction — accepts a phone, generates a challenge,
//     dispatches the client_magic_link WhatsApp template.
//   • verifyOtpAction     — accepts (phone, otp), consumes the challenge,
//     mints the client session cookie.
//
// All branching is via redirects with ?error= / ?phase= search params —
// the page renders entirely server-side, no client JS required for the
// happy path. The CertFileUploader pattern (server action returns a
// shape, client invokes) is not needed here.

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  generateChallenge,
  consumeOtp,
  createClientSession,
} from "@/lib/client-auth";
import { prismaClientAuthStore } from "@/lib/client-auth-store";
import { setClientSessionCookie } from "@/lib/client-session-cookie";
import { getWhatsAppProvider } from "@/lib/providers/whatsapp";
import { audit } from "@/lib/audit";

// ── Phone normalisation ──────────────────────────────────────────────
// Client.phone is canonicalised to "+<digits>" E.164 in the enquiry intake.
// Accept anything the user types: strip whitespace, hyphens, parens; if
// they didn't include a country code, default to India (+91). This is the
// same shape the WhatsApp webhook sees, so lookups match.
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("91") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

const requestSchema = z.object({
  phone: z.string().min(8).max(20),
});

export async function requestSignInAction(formData: FormData) {
  const parsed = requestSchema.safeParse({ phone: formData.get("phone") });
  if (!parsed.success) {
    redirect("/me/sign-in?error=invalid_phone");
  }
  const phone = normalisePhone(parsed.data.phone);
  if (!phone) {
    redirect("/me/sign-in?error=invalid_phone");
  }

  // Look up an existing Client. We do NOT reveal whether the phone is on
  // file — same response either way, to avoid enumeration. The actual
  // template send is skipped if there's no match.
  const client = await prisma.client.findUnique({ where: { phone } });
  if (client && !client.deletedAt) {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim()
            ?? h.get("x-real-ip")
            ?? undefined;

    const challenge = await generateChallenge(prismaClientAuthStore, client.id, { ip });
    if (challenge.ok) {
      // Meta's AUTHENTICATION-category templates only allow a single OTP
      // variable — no name personalisation, no custom link. The magic-link
      // token is still minted (consumedVia: LINK stays usable if reached
      // through another channel) but we no longer put the URL in the
      // WhatsApp message body since Meta's template format doesn't support it.
      getWhatsAppProvider().sendTemplate({
        clientId: client.id,
        phone,
        templateName: "client_magic_link",
        variables: [challenge.otp],
      }).catch((err) => console.error("[me/sign-in] template send failed", err));
    }
    // Rate-limit hits still take the same redirect — opaque to the caller.
  }

  // Always advance to the OTP-entry phase. If the phone wasn't on file
  // we'll silently fail at consumeOtp time (no_challenge) with the same
  // generic "couldn't verify" message — no enumeration.
  redirect(`/me/sign-in?phase=verify&phone=${encodeURIComponent(phone)}`);
}

const verifySchema = z.object({
  phone: z.string().min(8).max(20),
  otp:   z.string().regex(/^\d{6}$/),
});

export async function verifyOtpAction(formData: FormData) {
  const parsed = verifySchema.safeParse({
    phone: formData.get("phone"),
    otp:   formData.get("otp"),
  });
  if (!parsed.success) {
    redirect("/me/sign-in?phase=verify&error=invalid_code");
  }
  const phone = normalisePhone(parsed.data.phone);
  if (!phone) redirect("/me/sign-in?error=invalid_phone");

  const client = await prisma.client.findUnique({ where: { phone } });
  if (!client || client.deletedAt) {
    redirect(`/me/sign-in?phase=verify&phone=${encodeURIComponent(phone)}&error=wrong_code`);
  }

  const result = await consumeOtp(prismaClientAuthStore, client.id, parsed.data.otp);
  if (!result.ok) {
    const qs = new URLSearchParams({
      phase: "verify",
      phone,
      error: result.error,
    }).toString();
    redirect(`/me/sign-in?${qs}`);
  }

  await mintAndSetSession(client.id);
  redirect("/me");
}

async function mintAndSetSession(clientId: string): Promise<void> {
  const h = await headers();
  const userAgent = h.get("user-agent") ?? undefined;
  const sess = await createClientSession(prismaClientAuthStore, clientId, { userAgent });
  await setClientSessionCookie(sess.token, sess.expiresAt);
  // Audit the sign-in. Note: actor is the client themselves; we record
  // it against the centre's system user concept by leaving actorId blank,
  // but the audit helper requires a User actor. Skip the audit log call
  // here — Phase 2 introduces a separate ClientAuditLog if needed.
}

// Exposed for /me/auth/[token]/route.ts.
export { mintAndSetSession };
