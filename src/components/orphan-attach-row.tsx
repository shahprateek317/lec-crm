"use client";

// One row per unknown sender (a phone number that's sent us WhatsApp
// messages but isn't on any Client record). Coordinator can:
//   • Attach all of that phone's messages to an existing client (by
//     name search — typeahead over /api/clients/search, Phase 2).
//   • Or click through to /leads/new with the phone pre-filled
//     (handled by a regular link, no special component needed).
//
// For Phase 1b we surface the latter affordance only — search-and-attach
// requires the client typeahead API which isn't built yet. Coordinator
// can copy the phone into the new-lead form themselves.

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { UserPlus, MessageSquare } from "lucide-react";

export function OrphanAttachRow({
  phone,
  count,
  latestAt,
  latestBody,
}: {
  phone: string;
  count: number;
  latestAt: Date;
  latestBody: string;
}) {
  return (
    <li className="flex items-start gap-3 py-3">
      <div className="mt-2 rounded-full bg-amber-100 p-1.5 text-amber-900">
        <MessageSquare className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {phone}
            <span className="ml-2 text-xs text-muted-foreground">
              ({count} message{count === 1 ? "" : "s"})
            </span>
          </p>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {formatDistanceToNow(latestAt, { addSuffix: true })}
          </span>
        </div>
        {latestBody && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">
            {latestBody}
          </p>
        )}
        <div className="mt-2">
          <Link
            href={`/leads/new?phone=${encodeURIComponent(phone)}&fromInbox=1`}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20"
          >
            <UserPlus className="h-3 w-3" />
            Create lead with this number
          </Link>
        </div>
      </div>
    </li>
  );
}
