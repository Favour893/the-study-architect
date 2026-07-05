export type GradeMode = "GPA" | "CWA";

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  /** Field of study (e.g. Computer Science) — used to tailor AI suggestions. */
  programmeOfStudy?: string | null;
  gradeMode: GradeMode | null;
  onboardingComplete: boolean;
  /** @deprecated Legacy flag — prefer seenPageGuides per page. */
  hasSeenAppGuide?: boolean;
  /** Page-specific coach tips the user has dismissed (e.g. dashboard, courses). */
  seenPageGuides?: string[];
  activeSemesterId: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type Semester = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isArchived: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type Course = {
  id: string;
  title: string;
  code?: string;
  lecturerName?: string;
  location?: string;
  /** Credit units for this course (used on grade calculator). */
  creditUnits?: number;
  topicCount: number;
  latestTopicStatus: "pending" | "taught" | "studying";
  createdAt?: unknown;
  updatedAt?: unknown;
};

/** Imported reference material for a course (text extracted client-side; used for AI scope). */
export type CourseDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  /** Plain text sent to AI (size-capped at upload). */
  contentText: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type Topic = {
  id: string;
  title: string;
  taughtInClass: boolean;
  learningStage?: "pending" | "taught" | "mastered";
  notes?: string;
  priorityScore: number;
  aiQueueRank?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type CourseTodo = {
  id: string;
  title: string;
  done: boolean;
  /** ISO datetime string for due date / alarm. */
  dueAt: string | null;
  alarmEnabled: boolean;
};

export type CoursePlan = {
  notes: string;
  todos: CourseTodo[];
};
