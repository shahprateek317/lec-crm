"use client";

// Inbox keyboard shortcuts — power-user reward, not the primary UX.
// Visible buttons remain the primary affordance (per the review's call:
// our coordinators aren't Linear users).
//
//   j / k       move selection down / up across thread rows
//   Enter / l   open the focused thread
//   ?           open shortcut cheatsheet
//   g then i    go to /inbox (jump-to-inbox from anywhere)
//
// Per-thread shortcuts (e=resolve, s=snooze, r=reply) live on the detail
// page and are wired separately when we add them.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Keyboard, X } from "lucide-react";

export function InboxKeyboardShortcuts({ threadLinks }: { threadLinks: string[] }) {
  const router = useRouter();
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [helpOpen, setHelpOpen] = useState(false);
  const [chord, setChord] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't steal keys from inputs / textareas / contenteditable.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setHelpOpen(false);
        setChord(null);
        return;
      }

      // Chord: g then i = inbox
      if (chord === "g") {
        if (e.key === "i") {
          e.preventDefault();
          router.push("/inbox");
        }
        setChord(null);
        return;
      }
      if (e.key === "g") {
        setChord("g");
        // Auto-clear chord after a short timeout.
        setTimeout(() => setChord((c) => (c === "g" ? null : c)), 700);
        return;
      }

      if (threadLinks.length === 0) return;

      if (e.key === "j") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, threadLinks.length - 1));
        return;
      }
      if (e.key === "k") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if ((e.key === "Enter" || e.key === "l") && focusedIndex >= 0) {
        e.preventDefault();
        const href = threadLinks[focusedIndex];
        if (href) router.push(href);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chord, focusedIndex, threadLinks, router]);

  // Apply a subtle outline to the focused row by adding a data attribute
  // to the parent <ul> (consumed via :has() in globals.css if we want
  // to style it). For Phase 1c we keep it minimal — focused index is
  // just used for nav.
  useEffect(() => {
    document.documentElement.dataset.inboxFocus = String(focusedIndex);
    return () => { delete document.documentElement.dataset.inboxFocus; };
  }, [focusedIndex]);

  return (
    <>
      {/* Tiny "?" affordance bottom-right */}
      <button
        type="button"
        onClick={() => setHelpOpen((v) => !v)}
        aria-label="Keyboard shortcuts"
        className="fixed bottom-4 right-4 z-30 hidden h-10 w-10 items-center justify-center rounded-full bg-card shadow-md ring-1 ring-border hover:bg-muted md:flex"
      >
        <Keyboard className="h-4 w-4 text-muted-foreground" />
      </button>

      {helpOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setHelpOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-lg font-medium">Keyboard shortcuts</h2>
              <button onClick={() => setHelpOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <dl className="space-y-1.5 text-sm">
              <Row keys={["j", "k"]} label="Move down / up" />
              <Row keys={["Enter"]} label="Open thread" />
              <Row keys={["g", "i"]} label="Jump to inbox" chord />
              <Row keys={["?"]} label="Toggle this help" />
              <Row keys={["Esc"]} label="Close" />
            </dl>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Click anywhere outside to close.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ keys, label, chord }: { keys: string[]; label: string; chord?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-foreground">{label}</span>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {keys.map((k, i) => (
          <span key={k} className="inline-flex items-center gap-1">
            {i > 0 && chord && <span>then</span>}
            {i > 0 && !chord && <span>/</span>}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">{k}</kbd>
          </span>
        ))}
      </span>
    </div>
  );
}
