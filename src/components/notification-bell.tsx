"use client";

// In-app notification bell — staff layout, top-right.
//
// Server-rendered initial state comes in via props (so the badge count
// is correct on first paint, no client roundtrip). Opening the popover
// shows the latest unread + recent-read items. Clicking an item marks
// it read (server action) and navigates if a href was set.
//
// The bell auto-refreshes via router.refresh() on a focus event and
// every 60s while the tab is foregrounded. Polling is cheap because
// the layout already runs the query for every navigation.

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/app/(app)/notifications-actions";

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export function NotificationBell({
  unreadCount,
  items,
}: {
  unreadCount: number;
  items: NotificationItem[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Periodic refresh so a long-open tab still shows new alerts. We
  // also refresh on window focus — a coordinator coming back from
  // another tab gets fresh state immediately.
  useEffect(() => {
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(id);
    };
  }, [router]);

  const handleClick = (item: NotificationItem) => {
    if (!item.readAt) {
      // Fire-and-forget; the page will reflect the change on next paint.
      startTransition(() => {
        markNotificationReadAction(item.id);
      });
    }
  };

  const handleMarkAll = () => {
    startTransition(() => {
      markAllNotificationsReadAction();
    });
  };

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nothing to catch up on.
          </div>
        ) : (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {items.map((item) => {
              const Inner = (
                <div className="flex items-start gap-2.5 px-3 py-2.5">
                  <span
                    className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                      item.readAt ? "bg-transparent" : "bg-primary"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${item.readAt ? "text-muted-foreground" : "font-medium text-foreground"}`}>
                      {item.title}
                    </p>
                    {item.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {item.body}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                  {!item.readAt && (
                    <button
                      type="button"
                      aria-label="Mark read"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleClick(item);
                      }}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );

              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={() => handleClick(item)}
                      className="block transition-colors hover:bg-muted/30"
                    >
                      {Inner}
                    </Link>
                  ) : (
                    <div
                      onClick={() => handleClick(item)}
                      className="cursor-default transition-colors hover:bg-muted/30"
                    >
                      {Inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
