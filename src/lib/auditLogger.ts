"use client";

import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { AuditAction, AuditLogEntry } from "@/types";

/**
 * 30-day retention policy: every audit log carries an `expiresAt` timestamp.
 * This guarantees the collection remains light and never accumulates as
 * an unbounded database burden. (Mirrors rakus-kitchen's auditLogger.ts.)
 */
export const AUDIT_RETENTION_DAYS = 30;

export async function recordAuditLog(params: {
  action: AuditAction;
  actor: {
    uid?: string;
    email?: string;
    name?: string;
    type: "admin" | "customer" | "system";
  };
  targetId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!db) return;

  try {
    const now = Date.now();
    const expiresAt = now + AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    await addDoc(collection(db, "auditLogs"), {
      ...params,
      createdAt: now,
      expiresAt,
      serverTime: serverTimestamp(),
    });
  } catch (err) {
    // Non-blocking: audit log failure should never crash a user transaction.
    console.warn("[AuditLogger] Failed to write audit log:", err);
  }
}

/** Subscribes to the most recent audit logs for the admin dashboard. */
export function subscribeRecentAuditLogs(
  onLogs: (logs: AuditLogEntry[]) => void,
  maxLogs = 30,
  onError?: (err: string) => void,
): Unsubscribe {
  if (!db) return () => {};

  try {
    const q = query(
      collection(db, "auditLogs"),
      orderBy("createdAt", "desc"),
      limit(maxLogs),
    );

    return onSnapshot(
      q,
      (snap) => {
        const logs: AuditLogEntry[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<AuditLogEntry, "id">),
        }));
        onLogs(logs);
      },
      (err) => {
        if (onError) onError(err.message);
      },
    );
  } catch (err) {
    if (onError) onError((err as Error).message);
    return () => {};
  }
}
