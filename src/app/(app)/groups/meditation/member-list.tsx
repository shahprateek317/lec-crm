"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Send, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addMeditationMemberAction, updateMemberStatusAction, sendMeditationThankYouAction } from "./actions";

type MemberStatus = "ACTIVE" | "INACTIVE" | "EXITED";
type MemberRow = { clientId: string; clientName: string; clientPhone: string; status: MemberStatus; joinedAt: string };
type ClientOption = { id: string; name: string; phone: string };

const STATUS_CLS: Record<MemberStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  INACTIVE: "bg-amber-50 text-amber-700 border-amber-200",
  EXITED: "bg-rose-50 text-rose-700 border-rose-200",
};
const inputCls = "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function MeditationMemberList({ initialMembers }: { initialMembers: MemberRow[] }) {
  const [members, setMembers] = useState<MemberRow[]>(initialMembers);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<ClientOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState(false);
  const [filter, setFilter] = useState<MemberStatus | "ALL">("ACTIVE");
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (search.length < 2) { setOptions([]); return; }
    const ctrl = new AbortController();
    fetch(`/api/search/clients?q=${encodeURIComponent(search)}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => setOptions(d.results ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [search]);

  function handleAdd(client: ClientOption) {
    setSearch(""); setOptions([]);
    if (members.some(m => m.clientId === client.id)) return;
    const newMember: MemberRow = { clientId: client.id, clientName: client.name, clientPhone: client.phone, status: "ACTIVE", joinedAt: new Date().toISOString() };
    setMembers(prev => [newMember, ...prev]);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("clientId", client.id);
      await addMeditationMemberAction(fd);
    });
  }

  function handleStatus(clientId: string, status: MemberStatus) {
    setMembers(prev => prev.map(m => m.clientId === clientId ? { ...m, status } : m));
    startTransition(async () => {
      const fd = new FormData();
      fd.set("clientId", clientId);
      fd.set("status", status);
      await updateMemberStatusAction(fd);
    });
  }

  function handleThankYou() {
    const ids = [...selected].join(",");
    startTransition(async () => {
      const fd = new FormData();
      fd.set("clientIds", ids);
      await sendMeditationThankYouAction(fd);
      setSent(true);
      setSelected(new Set());
    });
  }

  const visible = filter === "ALL" ? members : members.filter(m => m.status === filter);

  return (
    <div className="space-y-4">
      {/* Add member */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Add member
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <input type="text" placeholder="Search by name or phone…" value={search} onChange={e => setSearch(e.target.value)} className={inputCls} />
            {options.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-background shadow-lg">
                {options.map(c => (
                  <button key={c.id} type="button" onClick={() => handleAdd(c)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted text-left">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filter + bulk WhatsApp */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          {(["ALL", "ACTIVE", "INACTIVE", "EXITED"] as const).map(f => (
            <button key={f} type="button" onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground"}`}>
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && !sent && (
            <button type="button" onClick={handleThankYou}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
              <Send className="h-3.5 w-3.5" /> Send thank-you ({selected.size})
            </button>
          )}
          {sent && <span className="text-xs text-emerald-600 font-medium">✓ Sent</span>}
        </div>
      </div>

      {/* Member list */}
      <Card className="rounded-xl">
        <CardContent className="p-0">
          {visible.length === 0 && (
            <p className="px-4 py-4 text-sm text-muted-foreground">No members in this category.</p>
          )}
          {visible.map(m => (
            <div key={m.clientId} className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3 first:border-0">
              <input type="checkbox" className="h-4 w-4 rounded border-input"
                checked={selected.has(m.clientId)}
                onChange={e => setSelected(prev => { const s = new Set(prev); e.target.checked ? s.add(m.clientId) : s.delete(m.clientId); return s; })} />
              <div className="flex-1 min-w-0">
                <Link href={`/leads/${m.clientId}`} className="font-medium hover:underline">{m.clientName}</Link>
                <p className="text-xs text-muted-foreground">{m.clientPhone} · Joined {format(new Date(m.joinedAt), "dd MMM yyyy")}</p>
              </div>
              <div className="flex gap-1.5">
                {(["ACTIVE", "INACTIVE", "EXITED"] as MemberStatus[]).map(s => (
                  <button key={s} type="button" onClick={() => handleStatus(m.clientId, s)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-opacity ${m.status === s ? STATUS_CLS[s] : "border-border text-muted-foreground opacity-40 hover:opacity-70"}`}>
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
