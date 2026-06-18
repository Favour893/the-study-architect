"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { completeGoogleRedirectSignIn, getClientAuth } from "@/lib/firebase/auth";
import { humanizeAuthError } from "@/lib/firebase/auth-errors";
import { hasFirebaseConfig } from "@/lib/firebase/client";
import { ensureUserProfile } from "@/lib/data/semesters";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  signInError: string | null;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  signInError: null,
});

type AuthProviderProps = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(hasFirebaseConfig);
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasFirebaseConfig) {
      return;
    }

    const clientAuth = getClientAuth();
    let unsubscribe = () => {};
    let isMounted = true;

    async function initAuth() {
      try {
        await completeGoogleRedirectSignIn();
      } catch (redirectError) {
        if (isMounted) {
          setSignInError(humanizeAuthError(redirectError));
        }
      }

      unsubscribe = onAuthStateChanged(clientAuth, (nextUser) => {
        if (!isMounted) {
          return;
        }

        setUser(nextUser);

        if (nextUser) {
          setSignInError(null);
          void ensureUserProfile(nextUser.uid, {
            email: nextUser.email,
            displayName: nextUser.displayName,
          }).catch((profileError) => {
            if (isMounted) {
              setSignInError(humanizeAuthError(profileError));
            }
          });
        }

        setIsLoading(false);
      });
    }

    void initAuth();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ user, isLoading, signInError }), [user, isLoading, signInError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
