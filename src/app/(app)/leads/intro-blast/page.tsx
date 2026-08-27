import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { getIntroCandidates } from "./actions";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import { SendBlastForm } from "./send-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Intro Session Blast" };

async function CandidateList() {
  const candidates = await getIntroCandidates();

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No qualifying clients right now. Clients who tap &quot;Join Introduction Session&quot; or new enquiries
        with no prior contact will appear here.
      </p>
    );
  }

  const introInterest = candidates.filter((c) => c.reason === "intro_interest");
  const newEnquiries = candidates.filter((c) => c.reason === "new_enquiry");

  return (
    <div className="space-y-4">
      {introInterest.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Expressed Interest in Intro Session ({introInterest.length})
          </p>
          <div className="rounded-lg border divide-y divide-border">
            {introInterest.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                <Link href={`/leads/${c.id}`} className="text-sm font-medium hover:underline">
                  {c.name}
                </Link>
                <span className="text-xs text-muted-foreground">{c.phone}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {newEnquiries.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            New Enquiries — Not Yet Contacted ({newEnquiries.length})
          </p>
          <div className="rounded-lg border divide-y divide-border">
            {newEnquiries.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                <Link href={`/leads/${c.id}`} className="text-sm font-medium hover:underline">
                  {c.name}
                </Link>
                <span className="text-xs text-muted-foreground">{c.phone}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default async function IntroBlastPage() {
  const zoomLink = await getSetting(SETTING_KEYS.zoomIntroLink);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/leads" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Intro Session Blast</h1>
          <p className="text-sm text-muted-foreground">
            Send <strong>intro_session_invitation</strong> to all interested &amp; new clients at once.
          </p>
        </div>
      </div>

      {/* Zoom link warning */}
      {!zoomLink && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Action needed:</strong> No Zoom link configured.{" "}
          <Link href="/settings/whatsapp" className="underline">
            Go to Settings → WhatsApp
          </Link>{" "}
          and add the Intro Session Zoom Link before sending.
        </div>
      )}

      {/* Candidate list */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4 text-muted-foreground" />
          Qualifying Recipients
        </div>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <CandidateList />
        </Suspense>
      </div>

      {/* Send form (client component for result feedback) */}
      <SendBlastForm zoomLink={zoomLink ?? null} />
    </div>
  );
}
