"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/auth";
import { hasFirebaseConfig } from "@/lib/firebase/client";
import { ensureUserProfile } from "@/lib/data/semesters";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
});

type AuthProviderProps = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(hasFirebaseConfig);

  useEffect(() => {
    if (!hasFirebaseConfig) {
      return;
    }

    const clientAuth = getClientAuth();
    const unsubscribe = onAuthStateChanged(clientAuth, async (nextUser) => {
      setUser(nextUser);

      if (nextUser) {
        await ensureUserProfile(nextUser.uid, {
          email: nextUser.email,
          displayName: nextUser.displayName,
        });
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo(() => ({ user, isLoading }), [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
