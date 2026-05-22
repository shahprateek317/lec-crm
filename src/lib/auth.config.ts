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
      const publicPaths = ["/", "/sign-in", "/enquiry", "/api/enquiry", "/dev/pay", "/confirm"];
      const { pathname } = request.nextUrl;
      if (publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
        return true;
      }
      // NextAuth's own endpoints (csrf, signin, callback, session, providers) must be public.
      if (pathname.startsWith("/api/auth")) return true;
      if (pathname.startsWith("/api/webhook")) return true;
      return !!auth;
    },
  },
} satisfies NextAuthConfig;
