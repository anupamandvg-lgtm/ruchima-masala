"use client";

import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { retryingListener } from "./db";

interface AuthState {
  /** true while we're still restoring session state. */
  loading: boolean;
  user: User | null;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthState>({ loading: true, user: null, isAdmin: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Restore the signed-in user (persisted by Firebase across page loads).
  useEffect(() => {
    if (!auth) {
      // Firebase not configured — don't leave the app stuck on "Loading…".
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Admins are granted by a Firestore allowlist doc /admins/{uid}.
  // Subscribing only while a user is signed in; re-subscribes on user change.
  // Wrapped in retryingListener so a cold page load racing auth-token restore
  // (or a rules-propagation window) recovers on its own instead of sticking
  // isAdmin at false for the rest of the session.
  useEffect(() => {
    if (!db || !user?.uid) {
      setIsAdmin(false);
      return undefined;
    }
    const firestore = db;
    const uid = user.uid;
    return retryingListener(
      `admins:${uid}`,
      (onSnapshotError) =>
        onSnapshot(
          doc(firestore, "admins", uid),
          (snap) => {
            setIsAdmin(snap.exists());
          },
          onSnapshotError,
        ),
      (err) => console.warn("admins snapshot: error (non-fatal):", err),
    );
  }, [user?.uid]);

  return (
    <AuthContext.Provider value={{ loading, user, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
