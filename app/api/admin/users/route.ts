import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/server/admin-access";
import { loadAdminUsersDashboard } from "@/lib/server/admin-users";
import { verifyFirebaseIdTokenWithClaims } from "@/lib/server/verify-firebase-id-token";

export const runtime = "nodejs";

type AdminUsersRequest = {
  idToken?: string;
};

export async function POST(request: Request) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return NextResponse.json({ error: "Missing Firebase project configuration." }, { status: 500 });
  }

  let payload: AdminUsersRequest;
  try {
    payload = (await request.json()) as AdminUsersRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!payload.idToken || typeof payload.idToken !== "string") {
    return NextResponse.json({ error: "Missing idToken." }, { status: 401 });
  }

  let claims: { uid: string; email: string | null };
  try {
    claims = await verifyFirebaseIdTokenWithClaims(payload.idToken, projectId);
  } catch {
    return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
  }

  if (!isAdminEmail(claims.email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const dashboard = await loadAdminUsersDashboard();
    return NextResponse.json(dashboard);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load admin users.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
