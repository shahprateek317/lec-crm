"use server";

// Server action behind the staff sign-in form.
//
// Two-step flow when 2FA is enabled for the user:
//   1. First POST has email + password only. If the user has TOTP
//      enabled, NextAuth's authorize() throws TotpRequiredError, which
//      we surface as `?error=totp_required` so the page can render the
//      6-digit code input.
//   2. Second POST has email + password + totpCode. If the code is
//      wrong, we surface `?error=totp_invalid`.
//
// Enrollment gate for ADMIN/SUPER_ADMIN:
//   If the admin has no TOTP configured, authorize() throws
//   TotpEnrollmentRequiredError. We issue a short-lived HttpOnly cookie
//   (not a URL param — avoids browser history / server log leakage)
//   and redirect to /admin-enroll where they can set up their
//   authenticator app before getting a session.

import { signIn } from "@/lib/auth";
import { AuthError, CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  generateEnrollmentToken,
  ENROLLMENT_COOKIE,
} from "@/lib/enrollment-token";

export async function signInAction(formData: FormData) {
  const email       = String(formData.get("email") ?? "");
  const password    = String(formData.get("password") ?? "");
  const totpCode    = String(formData.get("totpCode") ?? "").trim();
  const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");

  try {
    await signIn("credentials", {
      email,
      password,
      totpCode: totpCode || undefined,
      redirectTo: callbackUrl,
    });
  } catch (err) {
    if (err instanceof CredentialsSignin) {
      const code = (err as { code?: string }).code ?? "invalid";

      // Admin has no TOTP set up — redirect to the enrollment grace page.
      // Token goes in an HttpOnly cookie so it never appears in URLs.
      if (code === "totp_enrollment_required") {
        const token = generateEnrollmentToken(email);
        const cookieStore = await cookies();
        cookieStore.set(ENROLLMENT_COOKIE, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/admin-enroll",
          maxAge: 15 * 60,
        });
        redirect("/admin-enroll");
      }

      const params = new URLSearchParams({
        error: code,
        callbackUrl,
        email,
      });
      redirect(`/sign-in?${params.toString()}`);
    }
    if (err instanceof AuthError) {
      redirect(`/sign-in?error=invalid&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    throw err;
  }
}
