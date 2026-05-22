// Public session check-in confirmation — the URL a client taps in WhatsApp.
//
// Token comes in via path param. We:
//   1. Validate the token + look up which session & phase it belongs to
//   2. Record `clientConfirmedStartAt` or `clientConfirmedEndAt` = now
//   3. Show a calm thank-you screen
//
// No login required (the token itself is the auth). Token is single-purpose;
// re-tapping is idempotent (shows the existing confirmation time).

import { format } from "date-fns";
import { confirmCheckIn, lookupCheckInToken } from "@/lib/check-in";

export const dynamic = "force-dynamic";
export const metadata = { title: "Confirm session" };

export default async function ConfirmCheckInPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const found = await lookupCheckInToken(token);
  if (!found) {
    return (
      <Layout>
        <Card>
          <h1 className="font-serif text-2xl font-medium text-foreground">Link expired</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This confirmation link is no longer valid. If you've already
            confirmed your session, you can safely close this page.
          </p>
        </Card>
      </Layout>
    );
  }

  const result = await confirmCheckIn(token);
  if (!result) {
    return (
      <Layout>
        <Card>
          <h1 className="font-serif text-2xl font-medium text-foreground">Couldn't confirm</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Please reach out to the centre on WhatsApp and we'll record it manually.
          </p>
        </Card>
      </Layout>
    );
  }

  const isStart = result.phase === "start";
  const stamp = format(result.confirmedAt, "EEEE dd MMM, h:mm a");

  return (
    <Layout>
      <Card>
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          {/* Lotus-ish */}
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-8 w-8"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3c2.5 3 2.5 6 0 9-2.5-3-2.5-6 0-9ZM3 12c3 2.5 6 2.5 9 0-3-2.5-6-2.5-9 0Zm18 0c-3 2.5-6 2.5-9 0 3-2.5 6-2.5 9 0ZM12 21c-2.5-3-2.5-6 0-9 2.5 3 2.5 6 0 9Z"
            />
            <circle cx="12" cy="12" r="1.4" fill="currentColor" />
          </svg>
        </div>
        <h1 className="font-serif text-2xl font-medium text-foreground">
          {isStart ? "Session start confirmed" : "Session end confirmed"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Namaste {found.clientName.split(" ")[0]} 🙏 — thank you for confirming your
          {" "}{isStart ? "session start" : "session end"} with {found.healerName}.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Recorded at {stamp}.</p>

        {isStart ? (
          <p className="mt-6 text-sm text-foreground">
            We'll send another link at the end of your session. Settle in
            comfortably — your healer is with you. 🌸
          </p>
        ) : (
          <p className="mt-6 text-sm text-foreground">
            A short feedback request will reach you shortly. Wishing you a calm
            rest of the day. 🌸
          </p>
        )}

        <p className="mt-8 text-[11px] text-muted-foreground">
          You can close this page now. — Life Energy Centre, New Town, Kolkata
        </p>
      </Card>
    </Layout>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="pranic-glow flex min-h-screen items-center justify-center px-6 py-12">
      {children}
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
      {children}
    </div>
  );
}
