"use client";

import { useEffect, useState } from "react";
import { Download, Plus, Share, Smartphone, X } from "lucide-react";

// `beforeinstallprompt` is Chromium-only and not in TS lib.dom yet.
type BeforeInstallPromptEvent = Event & {
  readonly platforms: ReadonlyArray<string>;
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "lec.installPromptDismissedUntil";
const DISMISS_DAYS = 30;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS standalone reports navigator.standalone; Chromium uses display-mode media query.
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  // Detect iPhone / iPad / iPod. Newer iPads identify as Mac so check for touch.
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  if (ua.includes("Mac") && "ontouchend" in document) return true;
  return false;
}

function isSafariBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

/**
 * Modern PWA install prompt. Quiet by default — only surfaces ~3 seconds
 * after first paint, only on devices that can install, and only once a
 * month if dismissed. Two flavours:
 *
 *   - Chromium / Android: captures `beforeinstallprompt` and shows our own
 *     "Install app" button so the prompt fires from a clean place rather
 *     than the browser's mini-infobar.
 *   - iOS Safari: shows a visual hint pointing at the share icon since
 *     Apple disallows programmatic install prompts.
 */
export function InstallAppPrompt() {
  const [variant, setVariant] = useState<"android" | "ios" | null>(null);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // already installed

    const dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) ?? "0");
    if (dismissedUntil > Date.now()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setVariant("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // For iOS Safari, surface the share-sheet hint since beforeinstallprompt
    // never fires there.
    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (isIOS() && isSafariBrowser()) {
      iosTimer = setTimeout(() => setVariant("ios"), 4000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  // Reveal a moment after capture so it doesn't appear during page transitions.
  useEffect(() => {
    if (!variant) return;
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [variant]);

  const dismiss = () => {
    localStorage.setItem(
      DISMISS_KEY,
      String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000),
    );
    setOpen(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setOpen(false);
      // Don't pester again either way.
      localStorage.setItem(DISMISS_KEY, String(Date.now() + 365 * 24 * 60 * 60 * 1000));
    } else {
      dismiss();
    }
  };

  if (!variant || !open) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Life Energy Centre app"
      className="fixed inset-x-3 bottom-3 z-30 mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-lg animate-in fade-in slide-in-from-bottom-4 md:left-auto md:right-4 md:bottom-4 md:max-w-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Install Life Energy Centre</p>

          {variant === "android" ? (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Add it to your home screen — opens like a real app, no browser
                bar.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={install}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Download className="h-3.5 w-3.5" />
                  Install
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Not now
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Tap the <Share className="inline h-3 w-3" /> share button below,
                then choose <span className="font-medium">Add to Home Screen</span>{" "}
                <Plus className="inline h-3 w-3" />.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={dismiss}
                  className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
                >
                  Got it
                </button>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
