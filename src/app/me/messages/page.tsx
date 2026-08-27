// /me/messages — WhatsApp transcript + portal composer.
//
// Same thread the coordinator sees in /inbox: messages sent here are
// written straight into WhatsAppMessage/WhatsAppThread so they show up
// for the centre immediately, even though they don't travel over real
// WhatsApp transport (the Business API can't make a client's own
// WhatsApp app send on our behalf — see actions.ts for why).

import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft, MessagesSquare } from "lucide-react";
import { requireClient } from "@/lib/me-session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { sendPortalMessageAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages · Life Energy Centre" };

export default async function MeMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const client = await requireClient("/me/messages");

  const messages = await prisma.whatsAppMessage.findMany({
    where: { clientId: client.id },
    orderBy: { sentAt: "asc" },
    take: 200,
    select: {
      id: true,
      direction: true,
      body: true,
      sentAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <Link
        href="/me"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to your portal
      </Link>

      <header>
        <h1 className="flex items-center gap-2 font-serif text-2xl font-medium tracking-tight">
          <MessagesSquare className="h-6 w-6 text-primary" />
          Messages with the centre
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          These are the messages between you and the Life Energy Centre —
          whether sent over WhatsApp or written here.
        </p>
      </header>

      {sp.error && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}

      <Card className="rounded-2xl">
        <CardContent className="space-y-3 py-4">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No messages yet. Once the centre sends you a WhatsApp, it will
              appear here.
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.direction === "INBOUND" ? "justify-end" : "justify-start"}`}
              >
                {/* Note: 'INBOUND' here means inbound-to-centre, i.e.
                    sent BY the client — so we render those on the right
                    (which is what the client expects in a chat UI). */}
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${
                    m.direction === "INBOUND"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      m.direction === "INBOUND" ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {m.sentAt ? format(m.sentAt, "d MMM · HH:mm") : ""}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <form action={sendPortalMessageAction} className="flex items-end gap-2">
        <textarea
          name="body"
          required
          maxLength={2000}
          rows={2}
          placeholder="Type a message to the centre…"
          className="flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <SubmitButton
          pendingLabel="Sending…"
          className="inline-flex h-10 shrink-0 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Send
        </SubmitButton>
      </form>
    </div>
  );
}
