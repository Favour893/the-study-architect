export type PageGuideId =
  | "dashboard"
  | "courses"
  | "course-detail"
  | "timetable"
  | "calculator"
  | "semester";

export type PageGuideStep = {
  target: string;
  title: string;
  body: string;
  placement?: "top" | "bottom";
};

export const PAGE_GUIDES: Record<PageGuideId, PageGuideStep[]> = {
  dashboard: [
    {
      target: "pulse-progress",
      title: "Semester progress",
      body: "This bar shows how far you are through the term.",
      placement: "bottom",
    },
    {
      target: "pulse-ai",
      title: "AI study nudge",
      body: "Tap here when you want a tailored next step to study.",
      placement: "bottom",
    },
    {
      target: "pulse-classes",
      title: "Today's classes",
      body: "Fill in your Timetable and these cards show what's on now and next.",
      placement: "top",
    },
  ],
  courses: [
    {
      target: "courses-form",
      title: "Add a course",
      body: "Enter the title and tap Create course to build your semester vault.",
      placement: "bottom",
    },
  ],
  "course-detail": [
    {
      target: "course-suggest",
      title: "AI topic suggestions",
      body: "Paste or import material, then generate topic ideas for this course.",
      placement: "bottom",
    },
    {
      target: "course-topics",
      title: "Course topics",
      body: "Add topics here or use AI to suggest them from your syllabus.",
      placement: "bottom",
    },
  ],
  timetable: [
    {
      target: "timetable-grid",
      title: "Weekly grid",
      body: "Tap any cell to log a class. Swipe sideways to see all hours.",
      placement: "bottom",
    },
  ],
  calculator: [
    {
      target: "calculator-rows",
      title: "Course grades",
      body: "One row per course — pick a grade and credit units to track progress.",
      placement: "top",
    },
    {
      target: "calculator-summary",
      title: "Your semester mark",
      body: "GPA or CWA updates here as you enter grades above.",
      placement: "bottom",
    },
  ],
  semester: [
    {
      target: "semester-form",
      title: "Semester hub",
      body: "Update dates, archive old terms, or start a new semester here.",
      placement: "bottom",
    },
  ],
};

export function pathnameToPageGuideId(pathname: string): PageGuideId | null {
  if (pathname === "/dashboard") {
    return "dashboard";
  }
  if (pathname === "/courses") {
    return "courses";
  }
  if (pathname.startsWith("/courses/")) {
    return "course-detail";
  }
  if (pathname === "/timetable") {
    return "timetable";
  }
  if (pathname === "/calculator") {
    return "calculator";
  }
  if (pathname === "/onboarding") {
    return "semester";
  }
  return null;
}

export function hasSeenPageGuide(
  seenPageGuides: string[] | undefined,
  legacyHasSeenAppGuide: boolean | undefined,
  guideId: PageGuideId,
): boolean {
  if (legacyHasSeenAppGuide) {
    return true;
  }
  return seenPageGuides?.includes(guideId) ?? false;
}
