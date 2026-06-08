import { redirect } from "next/navigation";
import Link from "next/link";
import { Bell, ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlashToaster } from "@/components/flash-toaster";
import type { NotificationKind } from "@prisma/client";
import { saveNotificationPrefsAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notification preferences · Settings" };

type KindMeta = { label: string; description: string; roles?: string[] };

const KIND_META: Record<NotificationKind, KindMeta> = {
  NEW_INBOUND_MESSAGE:          { label: "New inbound WhatsApp message",    description: "A client replies on an assigned thread." },
  NEW_HEALING_ASSIGNMENT:       { label: "Healing session assigned to you", description: "A coordinator assigns you as the healer for a session." },
  SESSION_REMINDER_1H:          { label: "1-hour session reminder",         description: "Reminder 1 hour before a session you're assigned to." },
  CLIENT_DID_NOT_CONFIRM_START: { label: "Client didn't confirm start",     description: "Client missed the pre-session confirmation window." },
  QC_FLAGGED_SESSION:           { label: "Session flagged by QC",           description: "Quality control raises a concern about your session." },
  CERT_VERIFIED:                { label: "Certificate verified",            description: "An admin verifies one of your uploaded certificates." },
  REFERRAL_REWARD_GRANTED:      { label: "Referral reward granted",         description: "A client you referred completed a qualifying action." },
  PAYMENT_RECEIVED:             { label: "Payment received",                description: "A client payment for your assigned session is confirmed." },
  COURSE_ENROLMENT:             { label: "Course enrolment",                description: "A client enrols in a course you're associated with." },
  OTHER:                        { label: "Other system notifications",      description: "Miscellaneous system-generated alerts." },
};

export default async function NotificationPrefsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  await searchParams; // consume for FlashToaster

  const rows = await prisma.notificationPreference.findMany({
    where: { userId: session.user.id },
  });
  const disabledSet = new Set(rows.filter((r) => !r.enabled).map((r) => r.kind));

  const kinds = Object.keys(KIND_META) as NotificationKind[];

  return (
    <div className="space-y-6">
      <FlashToaster />
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Back to settings
      </Link>

      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight">
          <Bell className="h-7 w-7 text-primary" />
          Notification preferences
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose which in-app notifications you receive. All are on by default.
        </p>
      </header>

      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">In-app notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveNotificationPrefsAction} className="space-y-1">
            {kinds.map((kind) => {
              const meta = KIND_META[kind];
              const enabled = !disabledSet.has(kind);
              return (
                <label
                  key={kind}
                  className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    name={kind}
                    defaultChecked={enabled}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium leading-snug">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                  </div>
                </label>
              );
            })}

            <div className="pt-3">
              <Button type="submit" size="sm">Save preferences</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
