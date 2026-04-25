"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";

/**
 * Watches for ?ok=… or ?error=… in the URL (set by server actions after
 * redirect) and surfaces them as Sonner toasts, then strips the params from
 * the URL so a refresh doesn't replay the toast. Drop into any page that
 * uses redirect-with-flash from a server action.
 */
export function FlashToaster() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const ok = params.get("ok");
    const err = params.get("error");
    const test = params.get("test");
    if (!ok && !err && !test) return;

    if (ok) toast.success(ok === "1" ? "Saved" : decodeURIComponent(ok));
    if (err) toast.error(decodeURIComponent(err));
    if (test) {
      const isOk = test.startsWith("ok:");
      const detail = decodeURIComponent(test.replace(/^(ok|err):/, ""));
      if (isOk) toast.success(detail);
      else toast.error(detail);
    }

    // Strip flash params from URL.
    const next = new URLSearchParams(params.toString());
    next.delete("ok");
    next.delete("error");
    next.delete("test");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // Run only on first mount per nav.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
