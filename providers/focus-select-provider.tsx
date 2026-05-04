"use client";

import { useEffect } from "react";

const SKIPPED_INPUT_TYPES = new Set([
  "checkbox",
  "radio",
  "file",
  "button",
  "submit",
  "reset",
  "hidden",
  "range",
  "color",
  "image",
]);

function shouldSelectOnFocus(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
  if (!(target instanceof HTMLElement) || target.hasAttribute("data-no-select-on-focus")) {
    return false;
  }
  if (target instanceof HTMLTextAreaElement) {
    return !target.readOnly && !target.disabled;
  }
  if (!(target instanceof HTMLInputElement)) {
    return false;
  }
  if (target.readOnly || target.disabled) {
    return false;
  }
  const t = target.type || "text";
  if (SKIPPED_INPUT_TYPES.has(t)) {
    return false;
  }
  return true;
}

/**
 * On focus, selects the full value of text fields so the next keypress replaces it.
 * Opt out: <input data-no-select-on-focus />
 */
export function FocusSelectProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    function onFocusIn(event: FocusEvent) {
      if (!shouldSelectOnFocus(event.target)) {
        return;
      }
      const el = event.target;
      requestAnimationFrame(() => {
        if (document.activeElement !== el) {
          return;
        }
        try {
          el.select();
        } catch {
          if (el instanceof HTMLInputElement && el.value.length > 0) {
            try {
              el.setSelectionRange(0, el.value.length);
            } catch {
              // ignore
            }
          }
        }
      });
    }

    document.addEventListener("focusin", onFocusIn, true);
    return () => document.removeEventListener("focusin", onFocusIn, true);
  }, []);

  return <>{children}</>;
}
