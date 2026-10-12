import { initializeApp, getApps, getApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const FIREBASE_CONFIGURED = Object.values(firebaseConfig).every((v) => !!v);

const app = FIREBASE_CONFIGURED && getApps().length === 0 ? initializeApp(firebaseConfig) : (getApps()[0] ?? null);

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

const useEmulator = process.env.NEXT_PUBLIC_EMULATOR === "true";

if (app && useEmulator && auth && db) {
  // Safe to call multiple times; guards against double-connect in fast refresh.
  if (!location.hostname.startsWith("localhost") && !location.hostname.startsWith("127.0.0.1")) {
    console.warn("[Ruchima] EMULATOR=true on a non-localhost host — refusing emulator connections.");
  } else {
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "localhost", 8080);
    console.info("[Ruchima] Using Firebase emulators (auth :9099, firestore :8080).");
  }
}
