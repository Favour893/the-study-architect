import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { listCourses } from "@/lib/data/courses";
import { getDb } from "@/lib/firebase/db";
import { semesterPath, userProfilePath, userSemestersPath } from "@/lib/data/paths";
import type { GradeMode, Semester, UserProfile } from "@/lib/types/domain";

type OnboardingPayload = {
  semesterName: string;
  startDate: string;
  endDate: string;
  gradeMode: GradeMode;
  courses: Array<{ title: string; code?: string }>;
  email: string | null;
  displayName: string | null;
};

export async function ensureUserProfile(uid: string, data: Partial<UserProfile>) {
  const db = getDb();
  const profileRef = doc(db, userProfilePath(uid));
  const profileSnap = await getDoc(profileRef);

  if (!profileSnap.exists()) {
    await setDoc(profileRef, {
      uid,
      email: data.email ?? null,
      displayName: data.displayName ?? null,
      gradeMode: null,
      onboardingComplete: false,
      activeSemesterId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function getUserProfile(uid: string) {
  const db = getDb();
  const profileRef = doc(db, userProfilePath(uid));
  const profileSnap = await getDoc(profileRef);
  return profileSnap.exists() ? (profileSnap.data() as UserProfile) : null;
}

export async function completeOnboarding(uid: string, payload: OnboardingPayload) {
  const db = getDb();
  const semesterRef = doc(collection(db, userSemestersPath(uid)));
  const semesterId = semesterRef.id;
  const coursesRef = collection(db, `${semesterPath(uid, semesterId)}/courses`);
  const profileRef = doc(db, userProfilePath(uid));
  const batch = writeBatch(db);

  batch.set(semesterRef, {
    id: semesterId,
    name: payload.semesterName,
    startDate: payload.startDate,
    endDate: payload.endDate,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  payload.courses
    .filter((course) => course.title.trim().length > 0)
    .forEach((course) => {
      const courseDoc = doc(coursesRef);
      batch.set(courseDoc, {
        id: courseDoc.id,
        title: course.title.trim(),
        code: course.code?.trim() || "",
        topicCount: 0,
        latestTopicStatus: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

  batch.set(
    profileRef,
    {
      uid,
      email: payload.email,
      displayName: payload.displayName,
      gradeMode: payload.gradeMode,
      onboardingComplete: true,
      activeSemesterId: semesterId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();
  return semesterId;
}

export async function createNewSemester(
  uid: string,
  payload: {
    name: string;
    startDate: string;
    endDate: string;
    copyCoursesFromSemesterId?: string | null;
  },
): Promise<string> {
  const db = getDb();
  const semesterRef = doc(collection(db, userSemestersPath(uid)));
  const semesterId = semesterRef.id;
  const batch = writeBatch(db);

  batch.set(semesterRef, {
    id: semesterId,
    name: payload.name.trim(),
    startDate: payload.startDate,
    endDate: payload.endDate,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (payload.copyCoursesFromSemesterId) {
    const sourceCourses = await listCourses(uid, payload.copyCoursesFromSemesterId);
    const coursesRef = collection(db, `${semesterPath(uid, semesterId)}/courses`);
    for (const course of sourceCourses) {
      const courseDoc = doc(coursesRef);
      batch.set(courseDoc, {
        id: courseDoc.id,
        title: course.title,
        code: course.code ?? "",
        lecturerName: course.lecturerName ?? "",
        location: course.location ?? "",
        topicCount: 0,
        latestTopicStatus: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  batch.update(doc(db, userProfilePath(uid)), {
    activeSemesterId: semesterId,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return semesterId;
}

export async function setSemesterArchived(
  uid: string,
  semesterId: string,
  isArchived: boolean,
) {
  const db = getDb();
  await updateDoc(doc(db, semesterPath(uid, semesterId)), {
    isArchived,
    updatedAt: serverTimestamp(),
  });
}

export async function updateSemesterDetails(
  uid: string,
  semesterId: string,
  payload: {
    name: string;
    startDate: string;
    endDate: string;
  },
) {
  await updateDoc(doc(getDb(), semesterPath(uid, semesterId)), {
    name: payload.name.trim(),
    startDate: payload.startDate,
    endDate: payload.endDate,
    updatedAt: serverTimestamp(),
  });
}

export async function listUserSemesters(uid: string): Promise<Semester[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, userSemestersPath(uid)));
  const items = snap.docs.map((d) => d.data() as Semester);
  return items.sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0));
}

export async function setProfileActiveSemester(uid: string, semesterId: string) {
  const db = getDb();
  await updateDoc(doc(db, userProfilePath(uid)), {
    activeSemesterId: semesterId,
    updatedAt: serverTimestamp(),
  });
}

export async function getActiveSemester(uid: string, activeSemesterId: string | null) {
  const db = getDb();
  if (!activeSemesterId) {
    return null;
  }

  const activeSemesterRef = doc(db, semesterPath(uid, activeSemesterId));
  const activeSemesterSnap = await getDoc(activeSemesterRef);

  if (activeSemesterSnap.exists()) {
    return activeSemesterSnap.data() as Semester;
  }

  const fallbackQuery = query(
    collection(db, userSemestersPath(uid)),
    where("isArchived", "==", false),
  );
  const fallbackSemesters = await getDocs(fallbackQuery);
  return fallbackSemesters.docs[0]?.data() as Semester | undefined;
}
