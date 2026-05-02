"use client";

import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "lec_install_dismissed_at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 14; // hide for 14 days after dismissal

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

/**
 * Cross-platform "Install app" affordance.
 * - Android Chrome / desktop Chrome / Edge → calls the native beforeinstallprompt.
 * - iOS Safari → shows a one-time hint with the Share-icon → Add to Home Screen.
 * - Already installed → nothing.
 * - Recently dismissed → nothing for 14 days.
 */
export function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const dismissed = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (dismissed && Date.now() - dismissed < DISMISS_TTL_MS) return;

    if (isIOS()) {
      setIosHint(true);
      // Show after a beat so it doesn't fight with first paint.
      const t = setTimeout(() => setOpen(true), 2500);
      return () => clearTimeout(t);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setOpen(true);
    };
    const onInstalled = () => {
      setOpen(false);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setOpen(false);
  };

  const installNow = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setOpen(false);
      setInstallEvent(null);
    }
  };

  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 md:bottom-6">
      <div className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-lg ring-1 ring-foreground/5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Download className="h-4 w-4" />
        </div>
        <div className="flex-1 text-sm">
          <p className="font-medium">Install Life Energy Centre</p>
          {iosHint ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tap <Share className="-mt-0.5 mx-0.5 inline-block h-3.5 w-3.5" /> Share, then{" "}
              <Plus className="-mt-0.5 mx-0.5 inline-block h-3.5 w-3.5" /> Add to Home Screen — opens like a real app, no browser bar.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Add to your home screen for one-tap access. Works offline for already-loaded pages.
            </p>
          )}
          {!iosHint && installEvent && (
            <button
              type="button"
              onClick={installNow}
              className="mt-2 inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Install now
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
