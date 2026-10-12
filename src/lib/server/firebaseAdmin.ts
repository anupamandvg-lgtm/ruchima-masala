import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

/**
 * Firebase Admin SDK — server-only. Never import this from a "use client"
 * file or a component; the `server-only` import above makes that a build
 * error rather than a silent leak of the service account key to the browser.
 *
 * Credentials come from a service account (Firebase Console → Project
 * Settings → Service Accounts → Generate new private key), split into three
 * env vars so the private key can stay a normal env var (its literal "\n"
 * sequences are un-escaped below).
 */
function initAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin not configured — set FIREBASE_ADMIN_PROJECT_ID, " +
      "FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY (see .env.local.example).",
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket: process.env.FIREBASE_ADMIN_STORAGE_BUCKET,
  });
}

// Lazily initialized so a route that doesn't need Firestore/Auth (unlikely,
// but keeps the failure mode local) doesn't crash the module import.
let app: App | null = null;
function getAdminApp(): App {
  if (!app) app = initAdminApp();
  return app;
}

export const adminDb = () => getFirestore(getAdminApp());
export const adminAuth = () => getAuth(getAdminApp());
export const adminStorage = () => getStorage(getAdminApp());

/**
 * Verifies a Firebase ID token sent by the client (Authorization: Bearer <token>).
 * Throws on missing/invalid/expired tokens — callers should catch and return 401.
 */
export async function verifyIdToken(authHeader: string | null): Promise<{ uid: string }> {
  const token = authHeader?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new Error("Missing Authorization bearer token");
  const decoded = await adminAuth().verifyIdToken(token);
  return { uid: decoded.uid };
}
