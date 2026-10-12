import { describe, it, expect, vi, beforeEach } from "vitest";

// "server-only" throws unconditionally unless Next's webpack build resolves
// its special react-server/client export conditions — outside that build
// (i.e. under plain Vitest/Node) it always throws, so it must be mocked
// away here, same as rakus-kitchen's own server modules would need if they
// weren't kept dependency-free. This doesn't weaken the real guard: Next's
// bundler still enforces it for actual app code.
vi.mock("server-only", () => ({}));

// productPricing.ts talks to Firestore via adminDb() — mock that module so
// these tests exercise only the pure recomputation logic (price lookup,
// inclusive-tax math, CGST/SGST vs IGST split, shipping fee) without a real
// Firebase project. Mirrors how rakus-kitchen's menu.test.ts tests pure
// logic directly, except here the "pricing table" is a fake Firestore.
let pricingDocs: Record<string, { variants: Record<string, { sellingPrice: number; originalPrice?: number }> } | undefined>;
let shippingDoc: { flatFee: number; freeAboveAmount: number } | undefined;
let shippingReadShouldThrow = false;

function makeRef(collectionName: string, id: string) {
  return {
    __collection: collectionName,
    __id: id,
    get: async () => {
      if (collectionName === "shippingConfig") {
        if (shippingReadShouldThrow) throw new Error("simulated Firestore outage");
        return { data: () => shippingDoc };
      }
      return { data: () => pricingDocs[id] };
    },
  };
}

vi.mock("./firebaseAdmin", () => ({
  adminDb: () => ({
    collection: (name: string) => ({
      doc: (id: string) => makeRef(name, id),
    }),
    getAll: async (...refs: ReturnType<typeof makeRef>[]) =>
      refs.map((ref) => ({ data: () => pricingDocs[ref.__id] })),
  }),
}));

import { recomputeCartTotals } from "./productPricing";

beforeEach(() => {
  pricingDocs = {
    "turmeric-powder": { variants: { "1 kg": { sellingPrice: 200 } } },
    "chat-masala": { variants: { "500 g": { sellingPrice: 120, originalPrice: 140 } } },
  };
  shippingDoc = undefined; // falls back to DEFAULT_SHIPPING_POLICY (flatFee 79, freeAboveAmount 999)
  shippingReadShouldThrow = false;
});

describe("recomputeCartTotals", () => {
  it("errors on an empty cart", async () => {
    const r = await recomputeCartTotals([]);
    expect(r).toEqual({ error: "Cart is empty" });
  });

  it("errors on a non-positive or non-integer quantity", async () => {
    const r1 = await recomputeCartTotals([{ productId: "turmeric-powder", variantLabel: "1 kg", qty: 0 }]);
    expect("error" in r1).toBe(true);
    const r2 = await recomputeCartTotals([{ productId: "turmeric-powder", variantLabel: "1 kg", qty: 1.5 }]);
    expect("error" in r2).toBe(true);
  });

  it("errors on an unknown product", async () => {
    const r = await recomputeCartTotals([{ productId: "made-up", variantLabel: "1 kg", qty: 1 }]);
    expect("error" in r && r.error).toMatch(/Unknown product/i);
  });

  it("errors on an unknown variant for a real product", async () => {
    const r = await recomputeCartTotals([{ productId: "turmeric-powder", variantLabel: "5 kg", qty: 1 }]);
    expect("error" in r && r.error).toMatch(/Unknown variant/i);
  });

  it("errors when no productPricing doc/variant price exists (unverifiable price)", async () => {
    pricingDocs["turmeric-powder"] = undefined;
    const r = await recomputeCartTotals([{ productId: "turmeric-powder", variantLabel: "1 kg", qty: 1 }]);
    expect("error" in r && r.error).toMatch(/Could not verify price/i);
  });

  it("ignores a client-submitted price and uses the fresh Firestore price", async () => {
    // recomputeCartTotals's input type doesn't even accept a price field —
    // this just confirms the real catalog price (200) is what's used.
    const r = await recomputeCartTotals([{ productId: "turmeric-powder", variantLabel: "1 kg", qty: 2 }]);
    if ("error" in r) throw new Error(r.error);
    expect(r.items[0].pricePerUnit).toBe(200);
    expect(r.itemTotal).toBe(400);
  });

  it("computes GST-inclusive tax as a portion already inside the line total", async () => {
    const r = await recomputeCartTotals([{ productId: "turmeric-powder", variantLabel: "1 kg", qty: 1 }]);
    if ("error" in r) throw new Error(r.error);
    // turmeric-powder is 5% GST: inclusive tax = 200 * 5 / 105
    expect(r.taxTotal).toBeCloseTo((200 * 5) / 105, 6);
    // grandTotal must not add tax again on top of itemTotal.
    expect(r.grandTotal).toBe(r.itemTotal + r.shippingFee);
  });

  it("splits GST as IGST when no buyer state is given (safer default)", async () => {
    const r = await recomputeCartTotals([{ productId: "turmeric-powder", variantLabel: "1 kg", qty: 1 }]);
    if ("error" in r) throw new Error(r.error);
    expect(r.gstBreakdown.cgst).toBe(0);
    expect(r.gstBreakdown.sgst).toBe(0);
    expect(r.gstBreakdown.igst).toBeGreaterThan(0);
  });

  it("splits GST as CGST+SGST when the buyer is in Karnataka (state code 29)", async () => {
    const r = await recomputeCartTotals([{ productId: "turmeric-powder", variantLabel: "1 kg", qty: 1 }], "29");
    if ("error" in r) throw new Error(r.error);
    expect(r.gstBreakdown.igst).toBe(0);
    expect(r.gstBreakdown.cgst).toBeGreaterThan(0);
    expect(r.gstBreakdown.cgst).toBeCloseTo(r.gstBreakdown.sgst, 6);
  });

  it("splits GST as IGST for an out-of-state buyer", async () => {
    const r = await recomputeCartTotals([{ productId: "turmeric-powder", variantLabel: "1 kg", qty: 1 }], "27"); // Maharashtra
    if ("error" in r) throw new Error(r.error);
    expect(r.gstBreakdown.cgst).toBe(0);
    expect(r.gstBreakdown.sgst).toBe(0);
    expect(r.gstBreakdown.igst).toBeGreaterThan(0);
  });

  it("applies the flat shipping fee below the free-shipping threshold", async () => {
    // 200 * 1 = 200, below DEFAULT_SHIPPING_POLICY.freeAboveAmount (999)
    const r = await recomputeCartTotals([{ productId: "turmeric-powder", variantLabel: "1 kg", qty: 1 }]);
    if ("error" in r) throw new Error(r.error);
    expect(r.shippingFee).toBe(79);
  });

  it("waives shipping at or above the free-shipping threshold", async () => {
    // 200 * 5 = 1000, >= 999
    const r = await recomputeCartTotals([{ productId: "turmeric-powder", variantLabel: "1 kg", qty: 5 }]);
    if ("error" in r) throw new Error(r.error);
    expect(r.shippingFee).toBe(0);
  });

  it("uses the admin-configured shippingConfig doc when present", async () => {
    shippingDoc = { flatFee: 50, freeAboveAmount: 500 };
    const r = await recomputeCartTotals([{ productId: "turmeric-powder", variantLabel: "1 kg", qty: 1 }]);
    if ("error" in r) throw new Error(r.error);
    expect(r.shippingFee).toBe(50); // below the configured 500 threshold
  });

  it("falls back to the code default shipping policy if the Firestore read fails", async () => {
    shippingReadShouldThrow = true;
    const r = await recomputeCartTotals([{ productId: "turmeric-powder", variantLabel: "1 kg", qty: 1 }]);
    if ("error" in r) throw new Error(r.error);
    expect(r.shippingFee).toBe(79); // DEFAULT_SHIPPING_POLICY, not a crash
  });

  it("sums multiple lines across different products correctly", async () => {
    const r = await recomputeCartTotals([
      { productId: "turmeric-powder", variantLabel: "1 kg", qty: 1 }, // 200
      { productId: "chat-masala", variantLabel: "500 g", qty: 2 }, // 120 * 2 = 240
    ]);
    if ("error" in r) throw new Error(r.error);
    expect(r.itemTotal).toBe(440);
    expect(r.items).toHaveLength(2);
  });
});
