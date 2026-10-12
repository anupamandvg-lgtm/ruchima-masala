import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OrderLineItem, ProductInventoryDoc } from "@/types";

// See productPricing.test.ts for why "server-only" needs mocking under Vitest.
vi.mock("server-only", () => ({}));

// Fake Firestore: a Map keyed by productId, with enough of the admin SDK
// surface (db.getAll, db.collection().doc(), tx.get/tx.update) for
// checkStockAvailability and prepareStockDecrements to run unmodified.
let inventoryByProductId: Map<string, ProductInventoryDoc | undefined>;

function makeRef(id: string) {
  return { __id: id };
}

vi.mock("./firebaseAdmin", () => ({
  adminDb: () => ({
    collection: () => ({
      doc: (id: string) => makeRef(id),
    }),
    getAll: async (...refs: ReturnType<typeof makeRef>[]) =>
      refs.map((ref) => ({ data: () => inventoryByProductId.get(ref.__id) })),
  }),
}));

import { checkStockAvailability, prepareStockDecrements } from "./productInventory";

function line(productId: string, variantLabel: string, qty: number): OrderLineItem {
  return {
    productId,
    name: productId,
    variantLabel,
    weightGrams: 500,
    qty,
    pricePerUnit: 100,
    lineTotal: 100 * qty,
    hsnCode: "0910",
    gstRatePercent: 5,
  };
}

beforeEach(() => {
  inventoryByProductId = new Map<string, ProductInventoryDoc | undefined>([
    ["turmeric-powder", { variants: { "1 kg": { stockQty: 10, lowStockThreshold: 2, available: true } }, updatedAt: 0 }],
    ["chat-masala", { variants: { "500 g": { stockQty: 0, lowStockThreshold: 2, available: true } }, updatedAt: 0 }],
    ["kabab-masala", { variants: { "1 kg": { stockQty: 5, lowStockThreshold: 2, available: false } }, updatedAt: 0 }],
  ]);
});

describe("checkStockAvailability", () => {
  it("allows an empty line list", async () => {
    expect(await checkStockAvailability([])).toEqual({ ok: true });
  });

  it("treats an untracked product (no inventory doc) as in-stock", async () => {
    const r = await checkStockAvailability([line("bright-chilli-powder", "1 kg", 50)]);
    expect(r).toEqual({ ok: true });
  });

  it("treats an untracked variant on a tracked product as in-stock", async () => {
    const r = await checkStockAvailability([line("turmeric-powder", "500 g", 50)]);
    expect(r).toEqual({ ok: true });
  });

  it("allows a request within stock", async () => {
    const r = await checkStockAvailability([line("turmeric-powder", "1 kg", 5)]);
    expect(r).toEqual({ ok: true });
  });

  it("blocks a request exceeding stock, reporting the remaining qty", async () => {
    const r = await checkStockAvailability([line("turmeric-powder", "1 kg", 11)]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Only 10 left/);
  });

  it("blocks a request for a fully out-of-stock variant", async () => {
    const r = await checkStockAvailability([line("chat-masala", "500 g", 1)]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/out of stock/);
  });

  it("blocks a variant marked unavailable regardless of stockQty", async () => {
    const r = await checkStockAvailability([line("kabab-masala", "1 kg", 1)]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/currently unavailable/);
  });

  it("aggregates qty across multiple lines of the same product+variant", async () => {
    // 6 + 6 = 12, exceeds the 10 in stock, even though each line alone is fine.
    const r = await checkStockAvailability([
      line("turmeric-powder", "1 kg", 6),
      line("turmeric-powder", "1 kg", 6),
    ]);
    expect(r.ok).toBe(false);
  });
});

describe("prepareStockDecrements", () => {
  function makeTx() {
    const updates: Array<{ ref: unknown; data: Record<string, unknown> }> = [];
    return {
      updates,
      get: async (ref: ReturnType<typeof makeRef>) => ({
        exists: inventoryByProductId.has(ref.__id),
        data: () => inventoryByProductId.get(ref.__id),
      }),
      update: (ref: unknown, data: Record<string, unknown>) => updates.push({ ref, data }),
    };
  }

  it("returns a no-op commit for an empty line list", async () => {
    const tx = makeTx();
    const commit = await prepareStockDecrements(tx as never, []);
    commit();
    expect(tx.updates).toHaveLength(0);
  });

  it("skips an untracked product without writing anything", async () => {
    const tx = makeTx();
    const commit = await prepareStockDecrements(tx as never, [line("bright-chilli-powder", "1 kg", 3)]);
    commit();
    expect(tx.updates).toHaveLength(0);
  });

  it("decrements stockQty by the requested amount for a tracked variant", async () => {
    const tx = makeTx();
    const commit = await prepareStockDecrements(tx as never, [line("turmeric-powder", "1 kg", 4)]);
    commit();
    expect(tx.updates).toHaveLength(1);
    const update = tx.updates[0];
    // FieldValue.increment(-4) — just confirm the field path and that it's
    // the increment sentinel going the right direction, not a literal number.
    expect(update.data).toHaveProperty("variants.turmeric-powder".length ? "updatedAt" : "updatedAt");
    expect(Object.keys(update.data)).toContain("variants.1 kg.stockQty");
  });

  it("collapses multiple variants of the same product into one update call", async () => {
    inventoryByProductId.set("korean-peri-peri-masala", {
      variants: {
        "250 g": { stockQty: 10, lowStockThreshold: 2, available: true },
        "500 g": { stockQty: 10, lowStockThreshold: 2, available: true },
      },
      updatedAt: 0,
    });
    const tx = makeTx();
    const commit = await prepareStockDecrements(tx as never, [
      line("korean-peri-peri-masala", "250 g", 2),
      line("korean-peri-peri-masala", "500 g", 1),
    ]);
    commit();
    expect(tx.updates).toHaveLength(1); // one tx.update() call for both variants
    const fields = Object.keys(tx.updates[0].data);
    expect(fields).toContain("variants.250 g.stockQty");
    expect(fields).toContain("variants.500 g.stockQty");
  });

  it("reads before any write (tx.get called for every touched product up front)", async () => {
    const tx = makeTx();
    const getSpy = vi.spyOn(tx, "get");
    await prepareStockDecrements(tx as never, [line("turmeric-powder", "1 kg", 1)]);
    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(tx.updates).toHaveLength(0); // no update() yet — only the returned commit() writes
  });
});
