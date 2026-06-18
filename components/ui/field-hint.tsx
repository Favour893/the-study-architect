"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

const HINT_VISIBLE_MS = 3000;

type HintableField = ReactElement<{
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
}>;

type FieldHintProps = {
  hint: string;
  children: HintableField;
  className?: string;
};

const tooltipClass =
  "pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-50 max-w-[min(100%,240px)] rounded-md border border-app-border bg-app-fg px-2.5 py-1.5 text-xs font-normal normal-case tracking-normal leading-snug text-white shadow-lg dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

function fieldAlreadyDescribed(child: HintableField) {
  const { placeholder, "aria-label": ariaLabel } = child.props;
  return (
    (typeof placeholder === "string" && placeholder.trim().length > 0) ||
    (typeof ariaLabel === "string" && ariaLabel.trim().length > 0)
  );
}

/** Brief hint on hover/focus when the field has no placeholder or aria-label. */
export function FieldHint({ hint, children, className }: FieldHintProps) {
  if (!isValidElement(children)) {
    return children as ReactNode;
  }

  if (fieldAlreadyDescribed(children)) {
    if (className) {
      return <div className={className}>{children}</div>;
    }
    return children;
  }

  return (
    <FieldHintTooltip hint={hint} className={className}>
      {children}
    </FieldHintTooltip>
  );
}

function FieldHintTooltip({
  hint,
  children,
  className,
}: {
  hint: string;
  children: HintableField;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  function clearHideTimer() {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  function showHint() {
    clearHideTimer();
    setVisible(true);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      hideTimerRef.current = null;
    }, HINT_VISIBLE_MS);
  }

  function hideHint() {
    clearHideTimer();
    setVisible(false);
  }

  const childClassName = children.props.className;
  const isReadOnly = Boolean(
    (children.props as { readOnly?: boolean; disabled?: boolean }).readOnly ||
      (children.props as { readOnly?: boolean; disabled?: boolean }).disabled,
  );
  const cursorClass = isReadOnly ? "cursor-default" : "cursor-help";
  const nextClassName =
    childClassName?.includes("cursor-help") || childClassName?.includes("cursor-default")
      ? childClassName
      : [childClassName, cursorClass].filter(Boolean).join(" ");

  return (
    <div
      className={["relative", className].filter(Boolean).join(" ")}
      onMouseEnter={showHint}
      onMouseLeave={hideHint}
      onFocusCapture={showHint}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          hideHint();
        }
      }}
    >
      {cloneElement(children, {
        className: nextClassName,
      })}
      {visible ? (
        <span role="tooltip" className={tooltipClass}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
