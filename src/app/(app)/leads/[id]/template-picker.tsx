"use client";

import { useState } from "react";

type Template = { id: string; name: string };

export function TemplatePicker({
  templates,
  action,
  clientId,
}: {
  templates: Template[];
  action: (fd: FormData) => Promise<void>;
  clientId: string;
}) {
  const [selected, setSelected] = useState("");

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      <select
        name="templateName"
        required
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="" disabled>Choose template…</option>
        {templates.map((t) => (
          <option key={t.id} value={t.name}>{t.name.replace(/_/g, " ")}</option>
        ))}
      </select>
      {selected === "intro_session_invitation" && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Date &amp; Time (shown in message)</label>
          <input
            name="scheduledAt"
            type="text"
            placeholder="e.g. Sunday, 29 Jun, 6:00 PM"
            className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Non-parameterised templates only. Variables can be filled from a deeper view later.
      </p>
      <button
        type="submit"
        className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        Send
      </button>
    </form>
  );
}
