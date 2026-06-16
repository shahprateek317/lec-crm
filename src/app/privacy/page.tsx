import Link from "next/link";
import { t } from "@/lib/i18n";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPolicyPage() {
  return (
    <main className="pranic-glow min-h-screen px-6 py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center">
          <Link
            href="/"
            className="font-serif text-2xl font-medium text-foreground hover:opacity-80"
          >
            {t.common.appName}
          </Link>
          <h1 className="mt-4 font-serif text-3xl font-medium tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated 16 June 2026</p>
        </div>

        <div className="space-y-5 text-sm leading-relaxed text-foreground">
          <p>
            Life Energy Centre (&quot;we&quot;, &quot;us&quot;, &quot;the centre&quot;) respects your privacy.
            This page explains what personal data we collect, why, and how you can control it.
          </p>

          <section className="space-y-2">
            <h2 className="font-serif text-lg font-medium">What we collect</h2>
            <p>
              When you enquire about or attend our healing sessions and courses, we collect your
              name, phone number, email (optional), and details you share about your healing
              journey and sessions. If you make a payment, our payment partner (Razorpay) processes
              your payment details — we never see or store your card or bank details directly.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-lg font-medium">How we use it</h2>
            <p>
              We use your details to schedule and conduct healing sessions and courses, send you
              WhatsApp updates (appointment reminders, payment links, session confirmations), and
              maintain your healing history for continuity of care. We do not sell your data to
              third parties.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-lg font-medium">WhatsApp messaging</h2>
            <p>
              We use the WhatsApp Business Platform to send you appointment reminders, payment
              links, and updates related to your healing journey. You can ask us at any time to
              stop receiving WhatsApp messages by replying &quot;STOP&quot; or contacting the
              centre directly.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-lg font-medium">Your rights</h2>
            <p>
              You can ask us to delete your personal details at any time by visiting your portal
              account settings or by contacting the centre. We retain anonymised healing session
              records for our internal continuity-of-care purposes even after a deletion request,
              as permitted under applicable data protection law.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-lg font-medium">Contact us</h2>
            <p>
              For any privacy questions or requests, please contact the centre directly via
              WhatsApp or visit us at Pecon Tower, New Town, Kolkata.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
