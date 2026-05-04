"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useId, useRef } from "react";

export type SegmentedOption<T extends string> = { value: T; label: ReactNode };

type SegmentedControlProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  ariaLabel: string;
  className?: string;
};

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
}: SegmentedControlProps<T>) {
  const baseId = useId();
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const len = options.length;
  const cur = options.findIndex((o) => o.value === value);
  const curSafe = cur >= 0 ? cur : 0;

  function step(delta: number) {
    if (len === 0) {
      return;
    }
    const nextIndex = (curSafe + delta + len) % len;
    onChange(options[nextIndex].value);
    queueMicrotask(() => {
      buttonsRef.current[nextIndex]?.focus();
    });
  }

  function handleTabKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      onChange(options[0].value);
      queueMicrotask(() => buttonsRef.current[0]?.focus());
    } else if (event.key === "End") {
      event.preventDefault();
      const last = len - 1;
      onChange(options[last].value);
      queueMicrotask(() => buttonsRef.current[last]?.focus());
    }
  }

  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${className}`} role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className="shrink-0 rounded-md border border-app-border bg-white p-1.5 text-app-fg shadow-sm hover:bg-app-muted disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Previous option"
        disabled={len <= 1}
        onClick={() => step(-1)}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>

      <div
        className="inline-flex min-w-0 flex-1 justify-center rounded-lg bg-app-muted p-1"
        role="tablist"
      >
        {options.map((opt, i) => (
          <button
            key={opt.value}
            ref={(el) => {
              buttonsRef.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${opt.value}`}
            aria-selected={value === opt.value}
            tabIndex={value === opt.value ? 0 : -1}
            className={`rounded-md px-3 py-1.5 text-sm ${
              value === opt.value ? "bg-white text-app-fg shadow-sm" : "text-app-subtle"
            }`}
            onClick={() => onChange(opt.value)}
            onKeyDown={handleTabKeyDown}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="shrink-0 rounded-md border border-app-border bg-white p-1.5 text-app-fg shadow-sm hover:bg-app-muted disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Next option"
        disabled={len <= 1}
        onClick={() => step(1)}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
