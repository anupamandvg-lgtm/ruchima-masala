import "server-only";
import { NextResponse } from "next/server";
import { verifyIdToken } from "./firebaseAdmin";

/**
 * Guards an API route so only a signed-in (any) user can call it — used by
 * routes that act on behalf of a specific customer (e.g. /api/payments/create-order),
 * as opposed to requireAdmin which also checks the admin allowlist.
 */
export async function requireUser(
  request: Request,
): Promise<{ uid: string } | NextResponse> {
  try {
    const { uid } = await verifyIdToken(request.headers.get("authorization"));
    return { uid };
  } catch {
    return NextResponse.json(
      { error: "Unauthorized — please sign in." },
      { status: 401 },
    );
  }
}
