"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Clock, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addClientToSessionAction, updateAttendanceAction, sendPranicThankYouAction } from "../actions";

type AttendanceStatus = "REGISTERED" | "ATTENDED" | "DID_NOT_ATTEND";
type AttendanceRow = { clientId: string; clientName: string; clientPhone: string; status: AttendanceStatus };
type ClientOption = { id: string; name: string; phone: string };

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  REGISTERED: "Registered",
  ATTENDED: "Attended",
  DID_NOT_ATTEND: "Absent",
};
const STATUS_CLS: Record<AttendanceStatus, string> = {
  REGISTERED: "bg-blue-50 text-blue-700 border-blue-200",
  ATTENDED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DID_NOT_ATTEND: "bg-rose-50 text-rose-700 border-rose-200",
};
const STATUS_ICON: Record<AttendanceStatus, React.ReactNode> = {
  REGISTERED: <Clock className="h-3.5 w-3.5" />,
  ATTENDED: <CheckCircle2 className="h-3.5 w-3.5" />,
  DID_NOT_ATTEND: <XCircle className="h-3.5 w-3.5" />,
};
const inputCls = "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SessionAttendancePanel({
  sessionId,
  initialAttendances,
}: {
  sessionId: string;
  initialAttendances: AttendanceRow[];
}) {
  const [attendances, setAttendances] = useState<AttendanceRow[]>(initialAttendances);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<ClientOption[]>([]);
  const [sent, setSent] = useState(false);
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
    setSearch("");
    setOptions([]);
    if (attendances.some(a => a.clientId === client.id)) return;
    setAttendances(prev => [...prev, { clientId: client.id, clientName: client.name, clientPhone: client.phone, status: "REGISTERED" }]);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("sessionId", sessionId);
      fd.set("clientId", client.id);
      await addClientToSessionAction(fd);
    });
  }

  function handleStatus(clientId: string, status: AttendanceStatus) {
    setAttendances(prev => prev.map(a => a.clientId === clientId ? { ...a, status } : a));
    startTransition(async () => {
      const fd = new FormData();
      fd.set("sessionId", sessionId);
      fd.set("clientId", clientId);
      fd.set("status", status);
      await updateAttendanceAction(fd);
    });
  }

  function handleThankYou() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("sessionId", sessionId);
      await sendPranicThankYouAction(fd);
      setSent(true);
    });
  }

  const attended = attendances.filter(a => a.status === "ATTENDED").length;

  return (
    <div className="space-y-4">
      {/* Add client */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Add client to this session</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name or phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={inputCls}
            />
            {options.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-background shadow-lg">
                {options.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleAdd(c)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted text-left"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Attendance list */}
      <Card className="rounded-xl">
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Attendees ({attendances.length})
          </CardTitle>
          {attended > 0 && !sent && (
            <button
              type="button"
              onClick={handleThankYou}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Send className="h-3.5 w-3.5" /> Send thank-you WhatsApp ({attended})
            </button>
          )}
          {sent && <span className="text-xs text-emerald-600 font-medium">✓ Sent</span>}
        </CardHeader>
        <CardContent className="p-0">
          {attendances.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">No clients added yet.</p>
          )}
          {attendances.map((att) => (
            <div key={att.clientId} className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 first:border-0">
              <div>
                <Link href={`/leads/${att.clientId}`} className="font-medium hover:underline">{att.clientName}</Link>
                <p className="text-xs text-muted-foreground">{att.clientPhone}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {(["REGISTERED", "ATTENDED", "DID_NOT_ATTEND"] as AttendanceStatus[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleStatus(att.clientId, s)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity ${
                      att.status === s ? STATUS_CLS[s] : "border-border text-muted-foreground opacity-40 hover:opacity-70"
                    }`}
                  >
                    {STATUS_ICON[s]} {STATUS_LABEL[s]}
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
