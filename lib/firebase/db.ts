import { type Firestore, getFirestore, serverTimestamp } from "firebase/firestore";
import { firebaseApp, getFirebaseConfigStatus } from "@/lib/firebase/client";

export function getDb(): Firestore {
  if (!firebaseApp) {
    const { missingConfig } = getFirebaseConfigStatus();
    throw new Error(
      `Firebase is not configured. Missing: ${missingConfig.join(", ") || "unknown values"}.`,
    );
  }

  return getFirestore(firebaseApp);
}

export { serverTimestamp };
