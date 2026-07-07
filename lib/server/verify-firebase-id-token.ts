import * as jose from "jose";

const GOOGLE_JWKS = jose.createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

type FirebaseTokenClaims = {
  uid: string;
  email: string | null;
};

export async function verifyFirebaseIdToken(idToken: string, projectId: string): Promise<string> {
  const claims = await verifyFirebaseIdTokenWithClaims(idToken, projectId);
  return claims.uid;
}

export async function verifyFirebaseIdTokenWithClaims(
  idToken: string,
  projectId: string,
): Promise<FirebaseTokenClaims> {
  // Auth Emulator issues tokens that do not validate against Google JWKS. Never enable on production hosts.
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    const payload = jose.decodeJwt(idToken);
    const uid = payload.sub;
    if (typeof uid !== "string" || uid.length === 0) {
      throw new Error("Invalid token subject");
    }
    const email = typeof payload.email === "string" ? payload.email : null;
    return { uid, email };
  }

  const { payload } = await jose.jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  const uid = payload.sub;
  if (typeof uid !== "string" || uid.length === 0) {
    throw new Error("Invalid token subject");
  }
  const email = typeof payload.email === "string" ? payload.email : null;
  return { uid, email };
}
