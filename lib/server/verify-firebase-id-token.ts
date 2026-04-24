import * as jose from "jose";

const GOOGLE_JWKS = jose.createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export async function verifyFirebaseIdToken(idToken: string, projectId: string): Promise<string> {
  const { payload } = await jose.jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  const uid = payload.sub;
  if (typeof uid !== "string" || uid.length === 0) {
    throw new Error("Invalid token subject");
  }

  return uid;
}
