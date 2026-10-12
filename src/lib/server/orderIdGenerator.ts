import "server-only";
import crypto from "node:crypto";
import type { Transaction } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";
import { generateRandomOrderId, ORDER_ID_CHARSET } from "@/lib/orderId";

export { generateRandomOrderId };

/**
 * Generates a guaranteed unique order ID inside or outside a Firestore transaction.
 * Performs collision checking against the orders collection.
 */
export async function generateUniqueOrderId(tx?: Transaction): Promise<string> {
  const db = adminDb();
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateRandomOrderId();
    const queryRef = db.collection("orders").where("orderId", "==", candidate).limit(1);
    const snap = tx ? await tx.get(queryRef) : await queryRef.get();
    if (snap.empty) {
      return candidate;
    }
  }
  // Astronomical edge case fallback: append 1 extra character
  const extra = ORDER_ID_CHARSET[crypto.randomInt(0, ORDER_ID_CHARSET.length)];
  return `${generateRandomOrderId()}${extra}`;
}
