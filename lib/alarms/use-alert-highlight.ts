"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearRecentAlert, parseAlertDeepLink, type AlertKind } from "@/lib/alarms/alert-deep-link";

const HIGHLIGHT_MS = 4000;
const HIGHLIGHT_CLASS = "tsa-alert-highlight";

export function useAlertHighlight(expectedKind: AlertKind) {
  const router = useRouter();
  const pathname = usePathname();
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    const deepLink = parseAlertDeepLink(window.location.search);
    if (!deepLink || deepLink.alert !== expectedKind) {
      return;
    }

    setHighlightId(deepLink.id);
    clearRecentAlert();

    let attempts = 0;
    let clearTimer: number | null = null;
    let pollTimer: number | null = null;

    function tryHighlight() {
      const node = document.querySelector<HTMLElement>(
        `[data-alert-id="${CSS.escape(deepLink!.id)}"]`,
      );
      if (node) {
        node.classList.add(HIGHLIGHT_CLASS);
        node.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        clearTimer = window.setTimeout(() => {
          node.classList.remove(HIGHLIGHT_CLASS);
          setHighlightId(null);
          const next = new URLSearchParams(window.location.search);
          next.delete("alert");
          next.delete("id");
          const query = next.toString();
          router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        }, HIGHLIGHT_MS);
        return;
      }
      attempts += 1;
      if (attempts < 20) {
        pollTimer = window.setTimeout(tryHighlight, 150);
      }
    }

    tryHighlight();

    return () => {
      if (clearTimer !== null) {
        window.clearTimeout(clearTimer);
      }
      if (pollTimer !== null) {
        window.clearTimeout(pollTimer);
      }
    };
  }, [expectedKind, pathname, router]);

  return highlightId;
}
