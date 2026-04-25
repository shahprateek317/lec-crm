"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard, Users, CalendarDays, Sparkles, Wallet,
  MessagesSquare, GraduationCap, Settings, Clock, Plus, Search,
} from "lucide-react";

type ClientHit = { id: string; name: string; phone: string; stage: string };

const NAV: Array<{ label: string; href: string; icon: React.ComponentType<{ className?: string }>; keywords?: string[] }> = [
  { label: "Dashboard",            href: "/dashboard",        icon: LayoutDashboard, keywords: ["home", "metrics", "funnel"] },
  { label: "Leads & Clients",      href: "/leads",            icon: Users, keywords: ["pipeline"] },
  { label: "Board view",           href: "/leads?view=board", icon: Users, keywords: ["kanban"] },
  { label: "Add a lead",           href: "/leads/new",        icon: Plus, keywords: ["new client"] },
  { label: "Counselling & Visits", href: "/schedule",         icon: CalendarDays },
  { label: "Today's schedule",     href: "/schedule?view=today", icon: CalendarDays },
  { label: "Healing Sessions",     href: "/healing",          icon: Sparkles },
  { label: "Distant Healing",      href: "/distant-healing",  icon: MessagesSquare, keywords: ["whatsapp group"] },
  { label: "Payments & Credits",   href: "/payments",         icon: Wallet },
  { label: "Courses",              href: "/courses",          icon: GraduationCap },
  { label: "Follow-ups",           href: "/follow-ups",       icon: Clock },
  { label: "Settings — Staff",     href: "/settings/users",   icon: Settings },
  { label: "Settings — WhatsApp",  href: "/settings/whatsapp", icon: MessagesSquare },
  { label: "Settings — Razorpay",  href: "/settings/razorpay", icon: Wallet },
  { label: "Settings — Packages",  href: "/settings/packages", icon: Wallet },
  { label: "Settings — Courses",   href: "/settings/courses",  icon: GraduationCap },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ClientHit[]>([]);
  const [, startTransition] = useTransition();
  const router = useRouter();

  // Open on ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Live client search (debounced via React's batching).
  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/clients?q=${encodeURIComponent(query.trim())}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { results: ClientHit[] };
        setHits(data.results);
      } catch { /* swallow */ }
    }, 180);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, open]);

  const go = (href: string) => {
    startTransition(() => {
      router.push(href);
      setOpen(false);
      setQuery("");
    });
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search & navigate" description="Type to find a client or jump anywhere">
      <CommandInput
        placeholder="Search clients or jump to a page…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        {hits.length > 0 && (
          <>
            <CommandGroup heading="Clients">
              {hits.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.phone}`}
                  onSelect={() => go(`/leads/${c.id}`)}
                >
                  <Search className="h-4 w-4" />
                  <span className="flex-1">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.phone}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Go to">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.href}
                value={`${item.label} ${item.keywords?.join(" ") ?? ""}`}
                onSelect={() => go(item.href)}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Tips">
          <CommandItem disabled>
            <CommandShortcut>⌘K</CommandShortcut>
            <span>Open this anywhere</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
