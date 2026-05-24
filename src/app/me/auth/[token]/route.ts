// Magic-link consumption — the URL that the client taps in WhatsApp.
// GET because tapping a link in WhatsApp is a navigation, not a form
// post. The token IS the credential; we consume it (idempotent),
// mint a session cookie, redirect to /me.
//
// Failure modes: invalid / expired / already-consumed all redirect to
// /me/sign-in with a friendly message and the option to start over.

import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  consumeMagicLink,
  createClientSession,
} from "@/lib/client-auth";
import { prismaClientAuthStore } from "@/lib/client-auth-store";
import { CLIENT_SESSION_COOKIE } from "@/lib/client-session-cookie";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const result = await consumeMagicLink(prismaClientAuthStore, token);

  if (!result.ok) {
    // Single error param — the sign-in page maps it to a friendly string.
    return NextResponse.redirect(new URL(`/me/sign-in?error=${result.error}`, requestOrigin()));
  }

  // Mint session + set cookie + bounce to dashboard.
  const h = await headers();
  const userAgent = h.get("user-agent") ?? undefined;
  const sess = await createClientSession(prismaClientAuthStore, result.clientId, { userAgent });

  const cookieStore = await cookies();
  cookieStore.set(CLIENT_SESSION_COOKIE, sess.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: sess.expiresAt,
    maxAge: Math.max(0, Math.floor((sess.expiresAt.getTime() - Date.now()) / 1000)),
  });

  return NextResponse.redirect(new URL("/me", requestOrigin()));
}

/** Resolve the canonical origin from forwarded headers (Caddy sets these).
 *  Falls back to AUTH_URL env, then to the centre's prod URL. */
function requestOrigin(): string {
  // headers() doesn't work synchronously here; we rely on AUTH_URL.
  // NextResponse.redirect needs an absolute URL.
  const base = process.env.AUTH_URL?.replace(/\/$/, "")
            ?? "https://crm.lifeenergycentre.in";
  return base;
}
