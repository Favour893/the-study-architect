export type GradeMode = "GPA" | "CWA";

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  gradeMode: GradeMode | null;
  onboardingComplete: boolean;
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
  topicCount: number;
  latestTopicStatus: "pending" | "taught" | "studying";
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
