import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/server/admin-access";
import { verifyFirebaseIdTokenWithClaims } from "@/lib/server/verify-firebase-id-token";

export const runtime = "nodejs";

type AdminAccessRequest = {
  idToken?: string;
};

export async function POST(request: Request) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return NextResponse.json({ error: "Missing Firebase project configuration." }, { status: 500 });
  }

  let payload: AdminAccessRequest;
  try {
    payload = (await request.json()) as AdminAccessRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!payload.idToken || typeof payload.idToken !== "string") {
    return NextResponse.json({ error: "Missing idToken." }, { status: 401 });
  }

  try {
    const claims = await verifyFirebaseIdTokenWithClaims(payload.idToken, projectId);
    if (!isAdminEmail(claims.email)) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
  }
}
