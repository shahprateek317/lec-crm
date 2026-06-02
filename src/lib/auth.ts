import NextAuth, { type DefaultSession, CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { decryptFromStorage } from "@/lib/crypto";
import { verifyTotpCode } from "@/lib/totp";
import { consumeBackupCode } from "@/lib/backup-codes";
import type { Role } from "@prisma/client";

// ── TOTP signalling errors ────────────────────────────────────────────
// NextAuth v5 surfaces `code` on CredentialsSignin via the `?error=` query
// param of the signin page (configured at authConfig.pages.signIn). We
// use that to distinguish "password wrong" from "we need your TOTP" from
// "TOTP code wrong" so the sign-in UI can render the right step.

class TotpRequiredError extends CredentialsSignin {
  code = "totp_required";
}
class TotpInvalidError extends CredentialsSignin {
  code = "totp_invalid";
}
// Thrown when an ADMIN/SUPER_ADMIN has not yet enrolled in TOTP.
// The sign-in action catches this and redirects to /admin-enroll via
// a short-lived HttpOnly cookie (not URL param — avoids browser history).
class TotpEnrollmentRequiredError extends CredentialsSignin {
  code = "totp_enrollment_required";
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }
  interface User {
    role?: Role;
  }
  interface JWT {
    role?: Role;
    uid?: string;
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  // Optional on the first POST — present on the 2-step retry.
  totpCode: z.string().optional(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "Email + Password",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "Code",     type: "text" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user || !user.active) return null;

        // Constant-time-ish password check happens regardless of TOTP
        // state — keep that first to avoid leaking "this email exists"
        // via timing on the TOTP branch.
        const passwordOk = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!passwordOk) return null;

        // ── Admin TOTP enrollment enforcement ──
        // ADMIN and SUPER_ADMIN must have TOTP active before getting a
        // session. If their totpEnabledAt is null (either never enrolled or
        // enrollment abandoned), block sign-in and redirect them to the
        // enrollment grace page. This check runs even when totpSecret is
        // already set (enrollment-in-progress) — we never grant a session
        // to an admin without a confirmed second factor.
        if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
          if (!user.totpEnabledAt) {
            throw new TotpEnrollmentRequiredError();
          }
        }

        // ── TOTP gate ──
        // Only enforced after the user has VERIFIED their first code
        // (`totpEnabledAt` is set). For non-admin roles, enrollment is
        // still opt-in; for admin roles the enforcement above ensures we
        // never reach here without totpEnabledAt being set.
        if (user.totpEnabledAt && user.totpSecret) {
          const submitted = (parsed.data.totpCode ?? "").trim();
          if (!submitted) {
            throw new TotpRequiredError();
          }
          let secret: string;
          try {
            secret = decryptFromStorage(user.totpSecret);
          } catch {
            // If the secret can't be decrypted (AUTH_SECRET rotated
            // without re-encrypting), reject hard. The admin must
            // reset 2FA via /settings/users/[id]. Better than letting
            // anyone in.
            console.error("[auth] could not decrypt totpSecret for user", user.id);
            throw new TotpInvalidError();
          }
          // Accept either a TOTP code (6-digit rotating) or a backup code
          // (xxxxx-xxxxx single-use). Try TOTP first; fall back to backup.
          const totpValid = verifyTotpCode(secret, submitted);
          if (!totpValid) {
            // Might be a backup code — try consuming it.
            const backupValid = await consumeBackupCode(user.id, submitted);
            if (!backupValid) {
              throw new TotpInvalidError();
            }
            // Backup code consumed; proceed to grant the session.
          }
        }

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});
