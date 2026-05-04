import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore";
import {
  calculatorStateFromRemotePayload,
  loadCalculatorState,
  type CalculatorStoredState,
} from "@/lib/calculator-storage";
import { hasFirebaseConfig } from "@/lib/firebase/client";
import { getDb, serverTimestamp } from "@/lib/firebase/db";

function calculatorDocRef(db: Firestore, uid: string, semesterId: string) {
  return doc(db, "users", uid, "semesters", semesterId, "calculator", "main");
}

export async function fetchCalculatorFromFirestore(
  uid: string,
  semesterId: string,
): Promise<CalculatorStoredState | null> {
  if (!hasFirebaseConfig) {
    return null;
  }
  try {
    const db = getDb();
    const snap = await getDoc(calculatorDocRef(db, uid, semesterId));
    if (!snap.exists()) {
      return null;
    }
    return calculatorStateFromRemotePayload(snap.data());
  } catch {
    return null;
  }
}

/** Firestore first, then local device storage (offline / no cloud doc). */
export async function fetchCalculatorStateResolved(
  uid: string,
  semesterId: string,
): Promise<CalculatorStoredState | null> {
  const cloud = await fetchCalculatorFromFirestore(uid, semesterId);
  if (cloud) {
    return cloud;
  }
  return loadCalculatorState(uid, semesterId);
}

export async function saveCalculatorToFirestore(
  uid: string,
  semesterId: string,
  state: Omit<CalculatorStoredState, "v">,
): Promise<boolean> {
  if (!hasFirebaseConfig) {
    return true;
  }
  try {
    const db = getDb();
    await setDoc(
      calculatorDocRef(db, uid, semesterId),
      {
        ...state,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  } catch {
    return false;
  }
}
