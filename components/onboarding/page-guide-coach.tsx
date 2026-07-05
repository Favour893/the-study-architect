"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  PAGE_GUIDES,
  type PageGuideId,
  hasSeenPageGuide,
} from "@/lib/onboarding/page-guides";
import { getUserProfile, markPageGuideSeen } from "@/lib/data/semesters";
import { useAuth } from "@/providers/auth-provider";

const HIGHLIGHT_CLASS = "tsa-page-guide-highlight";

type PageGuideCoachProps = {
  guideId: PageGuideId;
};

type TooltipLayout = {
  top: number;
  left: number;
  width: number;
};

function clearHighlights() {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((node) => {
    node.classList.remove(HIGHLIGHT_CLASS);
  });
}

function computeTooltipLayout(
  targetRect: DOMRect,
  placement: "top" | "bottom",
  tooltipWidth: number,
): TooltipLayout {
  const margin = 12;
  const viewportWidth = window.innerWidth;
  const left = Math.min(
    Math.max(margin, targetRect.left + targetRect.width / 2 - tooltipWidth / 2),
    viewportWidth - tooltipWidth - margin,
  );
  const top =
    placement === "bottom"
      ? targetRect.bottom + margin
      : Math.max(margin, targetRect.top - margin - 120);

  return { top, left, width: tooltipWidth };
}

export function PageGuideCoach({ guideId }: PageGuideCoachProps) {
  const { user } = useAuth();
  const steps = PAGE_GUIDES[guideId];
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [layout, setLayout] = useState<TooltipLayout | null>(null);
  const [forceReplay, setForceReplay] = useState(false);

  const activeStep = stepIndex === null ? null : steps[stepIndex];

  const finishGuide = useCallback(async () => {
    clearHighlights();
    setStepIndex(null);
    setTargetRect(null);
    setLayout(null);
    setForceReplay(false);
    if (user && !forceReplay) {
      await markPageGuideSeen(user.uid, guideId);
    }
  }, [forceReplay, guideId, user]);

  useEffect(() => {
    let cancelled = false;

    async function maybeStartGuide() {
      if (!user) {
        return;
      }
      const profile = await getUserProfile(user.uid);
      if (cancelled || !profile?.onboardingComplete) {
        return;
      }
      if (
        !forceReplay &&
        hasSeenPageGuide(profile.seenPageGuides, profile.hasSeenAppGuide, guideId)
      ) {
        return;
      }
      setStepIndex(0);
    }

    void maybeStartGuide();

    return () => {
      cancelled = true;
    };
  }, [user, guideId, forceReplay]);

  useEffect(() => {
    function handleReplay(event: Event) {
      const detail = (event as CustomEvent<{ guideId?: PageGuideId }>).detail;
      if (detail?.guideId && detail.guideId !== guideId) {
        return;
      }
      setForceReplay(true);
      setStepIndex(0);
    }

    window.addEventListener("tsa:replay-page-guide", handleReplay);
    return () => window.removeEventListener("tsa:replay-page-guide", handleReplay);
  }, [guideId]);

  useEffect(() => {
    if (!activeStep) {
      clearHighlights();
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let target: HTMLElement | null = null;

    const attachToTarget = (node: HTMLElement) => {
      target = node;
      clearHighlights();
      node.classList.add(HIGHLIGHT_CLASS);
      node.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });

      const updateLayout = () => {
        const rect = node.getBoundingClientRect();
        setTargetRect(rect);
        setLayout(computeTooltipLayout(rect, activeStep.placement ?? "bottom", 288));
      };

      updateLayout();
      window.addEventListener("resize", updateLayout);
      window.addEventListener("scroll", updateLayout, true);

      return () => {
        window.removeEventListener("resize", updateLayout);
        window.removeEventListener("scroll", updateLayout, true);
        node.classList.remove(HIGHLIGHT_CLASS);
      };
    };

    let detach: (() => void) | undefined;

    const tryFindTarget = (attempt = 0) => {
      if (cancelled) {
        return;
      }

      const node = document.querySelector(`[data-page-guide="${activeStep.target}"]`);
      if (node instanceof HTMLElement) {
        detach = attachToTarget(node);
        return;
      }

      if (attempt < 24) {
        retryTimer = setTimeout(() => tryFindTarget(attempt + 1), 150);
      }
    };

    tryFindTarget();

    return () => {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      detach?.();
      if (target) {
        target.classList.remove(HIGHLIGHT_CLASS);
      }
    };
  }, [activeStep]);

  useEffect(() => () => clearHighlights(), []);

  if (!activeStep || !targetRect || !layout) {
    return null;
  }

  const isLast = stepIndex === steps.length - 1;

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[60] bg-slate-900/45" aria-hidden />
      <div
        className="pointer-events-none fixed z-[61] rounded-xl ring-4 ring-app-accent ring-offset-2 ring-offset-transparent"
        style={{
          top: targetRect.top - 4,
          left: targetRect.left - 4,
          width: targetRect.width + 8,
          height: targetRect.height + 8,
        }}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`page-guide-${guideId}-title`}
        className="fixed z-[62] rounded-xl border border-app-border bg-panel p-4 shadow-xl"
        style={{ top: layout.top, left: layout.left, width: layout.width }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            {steps.length > 1 ? (
              <p className="text-[11px] font-medium uppercase tracking-wide text-app-subtle">
                Tip {(stepIndex ?? 0) + 1} of {steps.length}
              </p>
            ) : null}
            <h3 id={`page-guide-${guideId}-title`} className="text-sm font-semibold text-app-fg">
              {activeStep.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => void finishGuide()}
            className="rounded-md p-1 text-app-subtle hover:bg-app-muted hover:text-app-fg"
            aria-label="Dismiss tip"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-app-subtle">{activeStep.body}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => void finishGuide()}
            className="text-xs text-app-subtle hover:text-app-fg"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => {
              if (isLast) {
                void finishGuide();
                return;
              }
              setStepIndex((current) => (current === null ? null : current + 1));
            }}
            className="rounded-lg bg-app-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-95"
          >
            {isLast ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}
