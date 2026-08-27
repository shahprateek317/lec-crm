"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { sendIntroBlastAction, type SendIntroBlastResult } from "./actions";

export function SendBlastForm({ zoomLink }: { zoomLink: string | null }) {
  const [result, setResult] = useState<SendIntroBlastResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setResult(null);
    setError(null);
    startTransition(async () => {
      try {
        const res = await sendIntroBlastAction(fd);
        setResult(res);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Send className="h-4 w-4 text-muted-foreground" />
        Send Bulk Invitation
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="scheduledAt">
          Session Date &amp; Time
        </label>
        <input
          id="scheduledAt"
          name="scheduledAt"
          type="text"
          required
          placeholder="e.g. Sunday, 29 Jun, 6:00 PM"
          className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          This is inserted as {"{{2}}"} in the message template.
        </p>
      </div>

      <div className="rounded-lg bg-muted px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p><strong>Message variables:</strong></p>
        <p>{"{{1}}"} = Client first name (auto)</p>
        <p>{"{{2}}"} = Date &amp; Time (from above)</p>
        <p>{"{{3}}"} = Zoom link (
          {zoomLink
            ? <span className="text-foreground">{zoomLink}</span>
            : <span className="text-amber-600">not set</span>}
        )</p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className={`rounded-lg border px-4 py-3 text-sm space-y-1 ${result.failed === 0 ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          <p className="font-medium">
            Sent {result.sent} message{result.sent !== 1 ? "s" : ""}
            {result.failed > 0 ? `, ${result.failed} failed` : " successfully"}.
          </p>
          {result.errors.map((e, i) => (
            <p key={i} className="text-xs">{e}</p>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={!zoomLink || isPending}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Sending…" : "Send to All Qualifying Clients"}
      </button>
    </form>
  );
}
