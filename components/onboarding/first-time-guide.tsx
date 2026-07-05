"use client";

import { useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gauge,
  Sigma,
  Sparkles,
  X,
} from "lucide-react";
import { TsaLogoMark } from "@/components/brand/tsa-logo-mark";

type GuideStep = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  tips: string[];
};

const GUIDE_STEPS: GuideStep[] = [
  {
    id: "welcome",
    title: "Welcome to The Study Architect",
    description:
      "You have set up your semester. Here is a quick tour of the main areas so you know where everything lives.",
    icon: Sparkles,
    accent: "from-sky-500 to-violet-500",
    tips: [
      "Use the sidebar on desktop or the bottom bar on mobile to move between sections.",
      "Your programme of study helps the AI tailor study suggestions to your field.",
    ],
  },
  {
    id: "pulse",
    title: "Pulse — your daily focus",
    description:
      "The Pulse dashboard shows semester progress, your current class, and what to study next.",
    icon: Gauge,
    accent: "from-sky-500 to-cyan-500",
    tips: [
      "Check semester progress at a glance with the progress bar.",
      "Tap \"Get a tailored next step\" for an AI study nudge based on your courses and timetable.",
      "See current and next class cards when your timetable is filled in.",
    ],
  },
  {
    id: "courses",
    title: "Courses — track what you are learning",
    description:
      "Add courses, break them into topics, and mark what has been taught or what you are revising.",
    icon: BookOpen,
    accent: "from-emerald-500 to-teal-500",
    tips: [
      "Open a course to add topics manually or use AI to suggest topics from a syllabus.",
      "Import PDF or Word documents so AI suggestions stay scoped to your material.",
      "Mark topics as taught or studying to keep Pulse priorities accurate.",
    ],
  },
  {
    id: "timetable",
    title: "Timetable — plan your week",
    description:
      "Build a weekly schedule so Pulse knows when you are in class and what is coming next.",
    icon: Clock3,
    accent: "from-violet-500 to-indigo-500",
    tips: [
      "Add classes by day and time — include location if helpful.",
      "Pulse uses your timetable to highlight the next class and link study priorities.",
      "Update the log when plans change during the term.",
    ],
  },
  {
    id: "calculator",
    title: "Grade Calculator — stay on track",
    description:
      "Enter grades and credit units to see your running GPA or CWA, depending on your grading mode.",
    icon: Sigma,
    accent: "from-amber-500 to-orange-500",
    tips: [
      "Your grading mode (GPA or CWA) was set during onboarding — change it from Semester if needed.",
      "Add rows for each course and update grades as results come in.",
    ],
  },
  {
    id: "semester",
    title: "Semester — manage your term",
    description:
      "Update programme details, semester dates, or start a new term when the next one begins.",
    icon: CalendarDays,
    accent: "from-rose-500 to-pink-500",
    tips: [
      "Switch between semesters from the header dropdown once you have more than one.",
      "Archive old semesters to keep your workspace focused on the current term.",
    ],
  },
  {
    id: "done",
    title: "You are ready to go",
    description:
      "Start with Courses to refine your topics, then fill in your Timetable. Pulse will do the rest.",
    icon: Sparkles,
    accent: "from-sky-500 via-violet-500 to-emerald-500",
    tips: [
      "Install TSA to your home screen from the browser menu for quick access.",
      "You can update your programme anytime from the account menu in the header.",
    ],
  },
];

type FirstTimeGuideProps = {
  onComplete: () => void;
};

export function FirstTimeGuide({ onComplete }: FirstTimeGuideProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = GUIDE_STEPS[stepIndex];
  const Icon = step.icon;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === GUIDE_STEPS.length - 1;

  function goNext() {
    if (isLast) {
      onComplete();
      return;
    }
    setStepIndex((current) => current + 1);
  }

  function goBack() {
    setStepIndex((current) => Math.max(0, current - 1));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center">
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-app-border bg-panel shadow-2xl shadow-blue-900/20"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-time-guide-title"
      >
        <div className={`h-1.5 bg-gradient-to-r ${step.accent}`} />

        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {isFirst ? (
                <TsaLogoMark className="h-10 w-10 shrink-0" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-accent-soft ring-1 ring-app-border">
                  <Icon className="h-5 w-5 text-app-accent" />
                </div>
              )}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-app-subtle">
                  Step {stepIndex + 1} of {GUIDE_STEPS.length}
                </p>
                <h2 id="first-time-guide-title" className="text-lg font-semibold text-app-fg">
                  {step.title}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onComplete}
              className="rounded-md p-1.5 text-app-subtle hover:bg-app-muted hover:text-app-fg"
              aria-label="Skip guide"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm leading-relaxed text-app-subtle">{step.description}</p>

          <ul className="mt-4 space-y-2">
            {step.tips.map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-sm text-app-fg">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-app-accent" />
                {tip}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-center gap-1.5">
            {GUIDE_STEPS.map((item, index) => (
              <span
                key={item.id}
                className={`h-1.5 rounded-full transition-all ${
                  index === stepIndex ? "w-6 bg-app-accent" : "w-1.5 bg-app-border"
                }`}
              />
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onComplete}
              className="text-sm text-app-subtle hover:text-app-fg"
            >
              Skip tour
            </button>
            <div className="flex gap-2">
              {!isFirst ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex items-center gap-1 rounded-lg border border-app-border px-3 py-2 text-sm font-medium text-app-fg hover:bg-app-muted"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
              ) : null}
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center gap-1 rounded-lg bg-app-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
              >
                {isLast ? "Get started" : "Next"}
                {!isLast ? <ChevronRight className="h-4 w-4" /> : null}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
