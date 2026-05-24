// /me/messages — read-only WhatsApp transcript inside the portal.
//
// Same transport (WhatsApp Business API), different render: this shows
// the client a familiar message thread inside the portal so they can
// pick where to live. Two-way composer ships in Phase 2 — for now,
// replies happen in WhatsApp itself; the centre's coordinator stays
// in /inbox.

import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft, MessagesSquare } from "lucide-react";
import { requireClient } from "@/lib/me-session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages · Life Energy Centre" };

export default async function MeMessagesPage() {
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
          These are the WhatsApp messages between you and the Life Energy
          Centre. To reply, please continue the conversation in WhatsApp
          itself — in-portal replies are coming soon.
        </p>
      </header>

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
    </div>
  );
}
