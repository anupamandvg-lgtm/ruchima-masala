import "server-only";
import type { Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";
import type { OrderLineItem, ProductInventoryDoc, VariantInventory } from "@/types";

/**
 * ── SERVER-SIDE STOCK TRACKING ───────────────────────────────────────────
 * One Firestore doc per product at productInventory/{productId}:
 *   { variants: { [variantLabel]: { stockQty, lowStockThreshold, available } }, updatedAt }
 *
 * Unlike rakus-kitchen's menuConfig.ts (a daily-reset ordered-quantity
 * counter that only gates non-veg items), this is REAL permanent stock:
 * every sale permanently decrements stockQty, replenished manually by the
 * admin after a production batch (see src/lib/db.ts's batchSetInventory).
 * A product/variant with no inventory doc yet is treated as in-stock and
 * untracked, rather than fabricating a baseline doc on first sale — stock
 * tracking only starts once the admin explicitly sets a quantity.
 */

/** Aggregates a set of order lines into per-(productId, variantLabel) requested qty. */
function aggregateRequestedQty(lines: OrderLineItem[]): Map<string, number> {
  const requested = new Map<string, number>();
  for (const line of lines) {
    const key = `${line.productId}::${line.variantLabel}`;
    requested.set(key, (requested.get(key) ?? 0) + line.qty);
  }
  return requested;
}

function splitKey(key: string): { productId: string; variantLabel: string } {
  const [productId, variantLabel] = key.split("::");
  return { productId, variantLabel };
}

/**
 * Pre-payment blocking gate, called from /api/payments/create-order BEFORE
 * the Razorpay order is created. Not itself transactional — a race between
 * two concurrent checkouts for the last unit of stock is caught for real at
 * finalizePayment time by prepareStockDecrements's transactional read. A
 * true race can still oversell by a unit; accepted the same way
 * rakus-kitchen accepts it for its own quantity limits (payment is already
 * captured there, no refund path, so this gate is the only place a hard
 * rejection is safe pre-payment).
 */
export async function checkStockAvailability(
  lines: OrderLineItem[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const requested = aggregateRequestedQty(lines);
  if (requested.size === 0) return { ok: true };

  const db = adminDb();
  const keys = Array.from(requested.keys());
  const productIds = Array.from(new Set(keys.map((k) => splitKey(k).productId)));
  const snaps = await db.getAll(...productIds.map((id) => db.collection("productInventory").doc(id)));
  const inventoryByProductId = new Map<string, ProductInventoryDoc | undefined>(
    productIds.map((id, i) => [id, snaps[i].data() as ProductInventoryDoc | undefined]),
  );

  for (const key of keys) {
    const { variantLabel, productId } = splitKey(key);
    const wanted = requested.get(key)!;
    const inventory = inventoryByProductId.get(productId);
    const variant: VariantInventory | undefined = inventory?.variants?.[variantLabel];

    // No inventory doc / variant entry yet = untracked, treat as in-stock
    // rather than silently blocking sales before the admin sets up tracking.
    if (!variant) continue;

    if (!variant.available) {
      return { ok: false, error: `${variantLabel} is currently unavailable.` };
    }
    if (wanted > variant.stockQty) {
      return {
        ok: false,
        error: variant.stockQty > 0
          ? `Only ${variant.stockQty} left in stock for ${variantLabel}.`
          : `${variantLabel} is out of stock.`,
      };
    }
  }

  return { ok: true };
}

/**
 * Reads all touched productInventory docs inside tx BEFORE any transaction
 * writes occur. Returns a commit function that applies all tx.update()
 * writes as a real permanent decrement (FieldValue.increment(-qty)) —
 * unlike rakus-kitchen's always-positive orderedQty counter. This
 * guarantees strict compliance with Firestore's "all reads before all
 * writes" rule. Lines whose product/variant has no inventory doc are
 * skipped — same "untracked = don't block, don't fabricate a doc" rule as
 * checkStockAvailability.
 */
export async function prepareStockDecrements(
  tx: Transaction,
  lines: OrderLineItem[],
): Promise<() => void> {
  const requested = aggregateRequestedQty(lines);
  if (requested.size === 0) return () => {};

  const db = adminDb();
  const keys = Array.from(requested.keys());
  const productIds = Array.from(new Set(keys.map((k) => splitKey(k).productId)));
  const refs = productIds.map((id) => db.collection("productInventory").doc(id));
  const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
  const refByProductId = new Map(productIds.map((id, i) => [id, refs[i]]));
  const snapByProductId = new Map(productIds.map((id, i) => [id, snaps[i]]));

  return () => {
    // Group decrements per productId doc so multiple variants of the same
    // product in one order collapse into a single tx.update() call.
    const fieldDeltasByProductId = new Map<string, Record<string, number>>();
    for (const key of keys) {
      const { productId, variantLabel } = splitKey(key);
      const snap = snapByProductId.get(productId);
      if (!snap?.exists) continue; // untracked product
      const data = snap.data() as ProductInventoryDoc | undefined;
      if (!data?.variants?.[variantLabel]) continue; // untracked variant

      const qty = requested.get(key)!;
      const field = `variants.${variantLabel}.stockQty`;
      const fields = fieldDeltasByProductId.get(productId) ?? {};
      fields[field] = (fields[field] ?? 0) - qty;
      fieldDeltasByProductId.set(productId, fields);
    }

    fieldDeltasByProductId.forEach((fields, productId) => {
      const updates: Record<string, unknown> = { updatedAt: Date.now() };
      for (const [field, delta] of Object.entries(fields)) {
        updates[field] = FieldValue.increment(delta);
      }
      tx.update(refByProductId.get(productId)!, updates);
    });
  };
}
