import "server-only";
import { NextResponse } from "next/server";
import { adminDb, verifyIdToken } from "./firebaseAdmin";

/**
 * Guards an API route so only a signed-in admin can call it.
 *
 * Verifies the `Authorization: Bearer <idToken>` header with the Firebase Admin
 * SDK, then confirms a `/admins/{uid}` document exists (the same UID-keyed
 * allowlist the Firestore rules use). Returns either the authenticated uid, or
 * a ready-to-return NextResponse (401 missing/invalid token, 403 not an admin).
 *
 * Usage in a route handler:
 *   const auth = await requireAdmin(request);
 *   if (auth instanceof NextResponse) return auth;
 *   // auth.uid is a verified admin from here on
 */
export async function requireAdmin(
  request: Request,
): Promise<{ uid: string } | NextResponse> {
  let uid: string;
  try {
    ({ uid } = await verifyIdToken(request.headers.get("authorization")));
  } catch {
    return NextResponse.json(
      { error: "Unauthorized — sign in as an admin." },
      { status: 401 },
    );
  }

  try {
    const snap = await adminDb().collection("admins").doc(uid).get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "Forbidden — your account is not an admin." },
        { status: 403 },
      );
    }
  } catch (err) {
    // A Firestore read failure here is a server problem, not an auth decision.
    return NextResponse.json(
      { error: `Admin check failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  return { uid };
}
