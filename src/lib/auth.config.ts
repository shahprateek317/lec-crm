// Edge-safe auth config. No adapter, no bcrypt, no Prisma — so it can
// run inside Next's Edge runtime (middleware) without blowing the 1 MB
// function size limit. The full config in `auth.ts` extends this with a
// PrismaAdapter and the Credentials provider that needs bcrypt.

import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

export const authConfig = {
  pages: { signIn: "/sign-in" },
  providers: [], // extended in auth.ts
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        (token as { uid?: string }).uid = user.id;
        (token as { role?: Role }).role = (user as { role?: Role }).role;
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as { uid?: string; role?: Role };
      if (t.uid && session.user) {
        session.user.id = t.uid;
        session.user.role = t.role ?? "COORDINATOR";
      }
      return session;
    },
    authorized({ auth, request }) {
      // /confirm/[token] is the public landing for session check-in links
      // sent to clients via WhatsApp — the token IS the auth, so no login.
      // /me/* uses a separate session cookie (passwordless WhatsApp magic-
      // link / OTP) — it bypasses NextAuth's gate here and runs its own
      // check via requireClient() in the route layer.
      const { pathname } = request.nextUrl;
      // /admin-enroll is the TOTP enrollment grace page for admins who
      // sign in without 2FA configured. Access is gated by a short-lived
      // HttpOnly cookie issued by the sign-in action — not freely public.
      // Matched exactly (not prefix) to avoid accidentally publicising
      // /admin-enroll-something if such a route is added in the future.
      if (pathname === "/admin-enroll") return true;
      const publicPaths = ["/", "/sign-in", "/enquiry", "/api/enquiry", "/dev/pay", "/confirm", "/me", "/privacy"];
      if (publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
        return true;
      }
      // Prefix-match helper: matches "/api/foo" exactly OR
      // "/api/foo/anything", but NOT "/api/foobar". Without the
      // trailing-slash guard, "/api/me" would also let "/api/metrics"
      // through, accidentally widening the public surface as new
      // routes get added.
      const startsWithSeg = (prefix: string) =>
        pathname === prefix || pathname.startsWith(prefix + "/");

      // NextAuth's own endpoints (csrf, signin, callback, session, providers) must be public.
      if (startsWithSeg("/api/auth")) return true;
      if (startsWithSeg("/api/webhook")) return true;
      // Cron endpoints enforce their own Bearer-token auth (CRON_SECRET);
      // letting NextAuth redirect them to /sign-in would break the
      // scheduled job invocations from EC2 crond / Vercel cron.
      if (startsWithSeg("/api/cron")) return true;
      // Client-portal API routes use the passwordless ClientSession
      // cookie via requireClient(), not NextAuth. They enforce their
      // own ownership checks in the route handlers.
      if (startsWithSeg("/api/me")) return true;
      return !!auth;
    },
  },
} satisfies NextAuthConfig;
