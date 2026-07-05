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
      target: "pulse-upcoming",
      title: "Coming up",
      body: "Your to-dos, exams, and alarms from Courses and Timetable land here.",
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
      target: "course-planner",
      title: "Notes & plan",
      body: "Write course notes and save them as cards. Add to-dos with optional alarms for reminders.",
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
    {
      target: "exam-timetable",
      title: "Exam timetable",
      body: "Add exam dates manually or import a photo. Set alarms so you never miss one.",
      placement: "top",
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
      target: "semester-manage",
      title: "Your semesters",
      body: "Switch terms, edit dates, or archive a semester you have finished.",
      placement: "bottom",
    },
    {
      target: "semester-new",
      title: "Start a new semester",
      body: "When a new term begins, create it here and optionally copy courses from a past semester.",
      placement: "top",
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
