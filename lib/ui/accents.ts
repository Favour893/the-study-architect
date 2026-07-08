export type NavAccent = {
  iconBg: string;
  iconText: string;
  activeRing: string;
};

export const NAV_ACCENTS: Record<string, NavAccent> = {
  "/dashboard": {
    iconBg: "bg-sky-500/25",
    iconText: "text-sky-300",
    activeRing: "ring-sky-400/40",
  },
  "/admin": {
    iconBg: "bg-indigo-500/25",
    iconText: "text-indigo-300",
    activeRing: "ring-indigo-400/40",
  },
  "/courses": {
    iconBg: "bg-emerald-500/25",
    iconText: "text-emerald-300",
    activeRing: "ring-emerald-400/40",
  },
  "/logs": {
    iconBg: "bg-teal-500/25",
    iconText: "text-teal-300",
    activeRing: "ring-teal-400/40",
  },
  "/timetable": {
    iconBg: "bg-violet-500/25",
    iconText: "text-violet-300",
    activeRing: "ring-violet-400/40",
  },
  "/calculator": {
    iconBg: "bg-amber-500/25",
    iconText: "text-amber-300",
    activeRing: "ring-amber-400/40",
  },
  "/onboarding": {
    iconBg: "bg-rose-500/25",
    iconText: "text-rose-300",
    activeRing: "ring-rose-400/40",
  },
};

export const COURSE_CARD_ACCENTS = [
  { bar: "from-app-accent to-app-info", badge: "bg-sky-100 text-sky-950 font-semibold dark:bg-sky-800 dark:text-sky-50" },
  { bar: "from-app-teal to-app-success", badge: "bg-emerald-100 text-emerald-950 font-semibold dark:bg-emerald-800 dark:text-emerald-50" },
  { bar: "from-app-violet to-app-coral", badge: "bg-violet-100 text-violet-950 font-semibold dark:bg-violet-800 dark:text-violet-50" },
  { bar: "from-app-amber to-app-warning", badge: "bg-amber-100 text-amber-950 font-semibold dark:bg-amber-800 dark:text-amber-50" },
  { bar: "from-app-info to-app-accent", badge: "bg-sky-100 text-sky-950 font-semibold dark:bg-sky-800 dark:text-sky-50" },
  { bar: "from-app-coral to-app-violet", badge: "bg-rose-100 text-rose-950 font-semibold dark:bg-rose-800 dark:text-rose-50" },
] as const;

export const SEMESTER_CARD_ACCENTS = [
  { bar: "from-sky-500 to-app-info", badge: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300", border: "border-l-sky-500" },
  { bar: "from-emerald-500 to-app-teal", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300", border: "border-l-emerald-500" },
  { bar: "from-violet-500 to-app-violet", badge: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300", border: "border-l-violet-500" },
  { bar: "from-amber-500 to-app-warning", badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300", border: "border-l-amber-500" },
  { bar: "from-rose-500 to-app-coral", badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300", border: "border-l-rose-500" },
] as const;

export function pickSemesterAccent(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash += seed.charCodeAt(i);
  }
  return SEMESTER_CARD_ACCENTS[hash % SEMESTER_CARD_ACCENTS.length];
}

export function pickCourseAccent(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash += seed.charCodeAt(i);
  }
  return COURSE_CARD_ACCENTS[hash % COURSE_CARD_ACCENTS.length];
}
