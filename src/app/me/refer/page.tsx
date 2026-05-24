// /me/refer — referral page.
//
// Refer-a-friend mechanism. Each client has a unique link (uses their
// cuid as the referral code) that pre-fills the enquiry form's `ref`
// parameter. When the referee fills out the enquiry, the existing
// referral-rewards engine credits the referrer 1-3 sessions per the
// referee's qualifying event (centre visit, package purchase, course).
//
// UI is intentionally generous: big share buttons, no math, just the
// invitation and the count of friends already on board.

import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft, Gift, Coins, Share2, Copy } from "lucide-react";
import { requireClient } from "@/lib/me-session";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShareControls } from "@/components/share-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Refer a friend · Life Energy Centre" };

export default async function MeReferPage() {
  const client = await requireClient("/me/refer");

  const referrals = await prisma.client.findMany({
    where: { referrerClientId: client.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, stage: true, createdAt: true },
  });

  const baseUrl = env.AUTH_URL?.replace(/\/$/, "") ?? "https://crm.lifeenergycentre.in";
  const shareLink = `${baseUrl}/enquiry?ref=${client.id}`;
  const shareMessage =
    `Namaste 🙏 I've been having a lovely experience with the Life Energy Centre's Pranic Healing. ` +
    `If you're curious, you can request a session here: ${shareLink}`;

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
          <Gift className="h-6 w-6 text-rose-700" />
          Refer a friend
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          When someone you refer visits the centre, you get a free healing
          session. Up to 10 free sessions a year.
        </p>
      </header>

      {/* Earnings stat */}
      <Card className="rounded-2xl border-rose-200 bg-rose-50/60">
        <CardContent className="flex items-center gap-3 py-4">
          <div className="rounded-full bg-rose-100 p-2 text-rose-900">
            <Coins className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Credits earned from referrals
            </p>
            <p className="font-serif text-2xl font-medium text-foreground">
              {client.healingCreditsEarned}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Share controls */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Share2 className="h-3.5 w-3.5 text-primary" />
            Your invite link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
            <code className="flex-1 truncate text-xs">{shareLink}</code>
            <ShareControls link={shareLink} message={shareMessage} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Share via WhatsApp (recommended) so the centre knows who sent the
            referral.
          </p>
        </CardContent>
      </Card>

      {/* Referred friends */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Friends you&rsquo;ve referred
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          {referrals.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No referrals yet. Share your link to get started.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {referrals.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {/* Privacy: only first name, not full identity. */}
                      {r.name.split(" ")[0]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined {format(r.createdAt, "MMM yyyy")}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {r.stage.replace(/_/g, " ").toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
