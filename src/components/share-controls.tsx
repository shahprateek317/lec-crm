"use client";

// Share controls for the referral page.
//   • WhatsApp share — opens wa.me with the pre-filled message + link.
//   • Copy link — Clipboard API, with brief "copied" feedback.
//
// Both controls are client-only (need access to window / clipboard).

import { useState } from "react";
import { Copy, Check, MessageCircle } from "lucide-react";

export function ShareControls({ link, message }: { link: string; message: string }) {
  const [copied, setCopied] = useState(false);
  const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for older browsers — select the text and let the user
      // hit Cmd-C. Silent failure is acceptable here.
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <a
        href={waUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
      >
        <MessageCircle className="h-3 w-3" />
        WhatsApp
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1 rounded-full bg-card border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-muted"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-700" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
