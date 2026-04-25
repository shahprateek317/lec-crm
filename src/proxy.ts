// Edge-runtime proxy (Next.js 16 renamed middleware.ts → proxy.ts).
// Imports ONLY the lightweight authConfig so the bundle stays under Vercel's
// 1 MB Edge Function limit.

import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.*|apple-icon.*|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
