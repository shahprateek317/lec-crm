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
// We keep the password in a hidden field on the TOTP step rather than
// stashing a half-session cookie. Risk is bounded: the field is
// `type=password`, only the user's browser sees it, and TOTP_INVALID
// just bounces back to the same form. Avoids a stateful half-session
// that we'd have to expire + revoke.

import { signIn } from "@/lib/auth";
import { AuthError, CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";

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
      // err.code is set by our custom TotpRequiredError / TotpInvalidError
      // subclasses in @/lib/auth. Default ("CredentialsSignin") means
      // bad email/password.
      const code = (err as { code?: string }).code ?? "invalid";
      const params = new URLSearchParams({
        error: code,
        callbackUrl,
        // Preserve email so the user doesn't retype it on the TOTP step.
        // Password lives in the hidden input the form re-renders.
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
