import { getAdminDb } from "@/lib/server/firebase-admin";
import type {
  AdminDashboardMetrics,
  AdminDashboardUserSummary,
  AdminUsersDashboardResponse,
  UserProfile,
} from "@/lib/types/domain";

function toIsoOrNull(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const withToDate = value as { toDate: () => Date };
    return withToDate.toDate().toISOString();
  }
  return null;
}

function profileToSummary(profile: Partial<UserProfile>, uid: string): AdminDashboardUserSummary {
  return {
    uid,
    email: profile.email ?? null,
    displayName: profile.displayName ?? null,
    onboardingComplete: profile.onboardingComplete === true,
    activeSemesterId: profile.activeSemesterId ?? null,
    createdAtIso: toIsoOrNull(profile.createdAt),
    updatedAtIso: toIsoOrNull(profile.updatedAt),
  };
}

function buildMetrics(users: AdminDashboardUserSummary[]): AdminDashboardMetrics {
  return {
    totalUsers: users.length,
    onboardedUsers: users.filter((user) => user.onboardingComplete).length,
    usersWithActiveSemester: users.filter((user) => Boolean(user.activeSemesterId)).length,
  };
}

export async function loadAdminUsersDashboard(): Promise<AdminUsersDashboardResponse> {
  const db = getAdminDb();
  const usersCollection = await db.collection("users").listDocuments();
  const users: AdminDashboardUserSummary[] = [];

  await Promise.all(
    usersCollection.map(async (userDocRef) => {
      const profileRef = db.doc(`${userDocRef.path}/profile/main`);
      const profileSnap = await profileRef.get();
      if (!profileSnap.exists) {
        return;
      }
      const raw = profileSnap.data() as Partial<UserProfile>;
      users.push(profileToSummary(raw, userDocRef.id));
    }),
  );

  users.sort((a, b) => {
    const aTime = a.updatedAtIso ? new Date(a.updatedAtIso).getTime() : 0;
    const bTime = b.updatedAtIso ? new Date(b.updatedAtIso).getTime() : 0;
    return bTime - aTime;
  });

  return {
    metrics: buildMetrics(users),
    users,
  };
}
