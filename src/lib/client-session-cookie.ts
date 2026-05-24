// Cookie helpers for the client portal session.
//
// Separate from NextAuth's staff cookie (no name collision, no shared
// namespace). HttpOnly + Secure + SameSite=Lax means the cookie:
//   • Cannot be read by client JS (XSS resistant).
//   • Is sent only over HTTPS in prod (Caddy terminates TLS).
//   • Travels with top-level navigations (so the magic-link tap from
//     WhatsApp lands authenticated) but not cross-site fetches.
//
// SameSite=Strict would be safer against CSRF but breaks the magic-link
// flow — the user is navigating from a WhatsApp web URL.

import { cookies } from "next/headers";
import { CLIENT_SESSION_TTL_DAYS } from "@/lib/client-auth";

export const CLIENT_SESSION_COOKIE = "lec_me_session";

const COOKIE_BASE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function setClientSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CLIENT_SESSION_COOKIE, token, {
    ...COOKIE_BASE_OPTS,
    expires: expiresAt,
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  });
}

export async function clearClientSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CLIENT_SESSION_COOKIE);
}

export async function readClientSessionCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CLIENT_SESSION_COOKIE)?.value ?? null;
}

/** Sliding renewal is handled in client-auth.validateClientSession;
 *  if the library returns a fresher expiry we re-set the cookie too so
 *  the browser keeps it past the original maxAge. */
export async function refreshClientSessionCookie(token: string): Promise<void> {
  const expiresAt = new Date(Date.now() + CLIENT_SESSION_TTL_DAYS * 24 * 60 * 60_000);
  await setClientSessionCookie(token, expiresAt);
}
