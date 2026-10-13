import "server-only";
import { adminDb } from "./firebaseAdmin";
import { productById } from "@/lib/products";
import { BUSINESS, DEFAULT_SHIPPING_POLICY } from "@/lib/config";
import type { FulfillmentType, GstBreakdown, OrderLineItem, ProductPricingDoc, ShippingConfigDoc } from "@/types";

/**
 * ── SERVER-SIDE PRICE RECOMPUTATION ──────────────────────────────────────
 * Mirrors rakus-kitchen's recomputeOrderTotals (src/lib/menu.ts), adapted for
 * Ruchima's Firestore-backed live pricing instead of a code constant: every
 * touched productPricing/{productId} doc is fetched FRESH here. The client's
 * submitted price/lineTotal are display-only and NEVER trusted — a tampered
 * cart total is caught because the real price is looked up fresh, not
 * re-validated.
 *
 * TAX CONVENTION (confirm with accountant — see products.ts's HSN/GST TODO):
 * `sellingPrice` in productPricing is treated as GST-INCLUSIVE (the retail
 * price the customer actually pays, same convention as a printed MRP). So
 * `taxTotal`/`gstBreakdown` here are the tax PORTION already inside
 * `itemTotal`, backed out as `price * rate / (100 + rate)` — NOT an amount
 * added on top. `grandTotal = itemTotal + shippingFee`.
 */

interface UnpricedLine {
  productId: string;
  variantLabel: string;
  qty: number;
  name?: string;
}

export interface RecomputedCart {
  items: OrderLineItem[];
  itemTotal: number;
  taxTotal: number;
  gstBreakdown: GstBreakdown;
  shippingFee: number;
  grandTotal: number;
}

/** Backs the GST-inclusive tax amount out of a tax-inclusive line total. */
function inclusiveTax(lineTotal: number, gstRatePercent: number): number {
  return (lineTotal * gstRatePercent) / (100 + gstRatePercent);
}

/**
 * Splits a tax amount into CGST+SGST (buyer in Karnataka, same state as the
 * business) or IGST (buyer in any other state). No buyer state at all
 * (guest checkout before address capture) is treated as IGST — the safer
 * default, since it never under-states a cross-state tax obligation.
 */
function splitGst(taxAmount: number, buyerStateCode: string | undefined): GstBreakdown {
  if (buyerStateCode && buyerStateCode === BUSINESS.gstStateCode) {
    return { cgst: taxAmount / 2, sgst: taxAmount / 2, igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: taxAmount };
}

/** Reads the admin-configured shipping policy, falling back to the code default. */
async function getShippingPolicy(): Promise<{ flatFee: number; freeAboveAmount: number }> {
  try {
    const snap = await adminDb().collection("shippingConfig").doc("default").get();
    const data = snap.data() as ShippingConfigDoc | undefined;
    if (data) return { flatFee: data.flatFee, freeAboveAmount: data.freeAboveAmount };
  } catch (err) {
    console.warn("[productPricing] shippingConfig read failed — using code default:", err);
  }
  return DEFAULT_SHIPPING_POLICY;
}

function shippingFeeFor(itemTotal: number, policy: { flatFee: number; freeAboveAmount: number }): number {
  return itemTotal >= policy.freeAboveAmount ? 0 : policy.flatFee;
}

/**
 * Recomputes a cart's full pricing from scratch given only (productId,
 * variantLabel, qty) per line — fetches each touched productPricing doc
 * fresh, ignoring any client-submitted price. Returns `{ error }` rather
 * than a best-effort guess when any line can't be resolved — the caller
 * must reject the order rather than charge an unverified price.
 */
export async function recomputeCartTotals(
  lines: UnpricedLine[],
  buyerStateCode?: string,
  fulfillmentType: FulfillmentType = "delivery",
): Promise<RecomputedCart | { error: string }> {
  if (lines.length === 0) return { error: "Cart is empty" };

  const productIds = Array.from(new Set(lines.map((l) => l.productId)));
  const db = adminDb();
  const pricingSnaps = await db.getAll(
    ...productIds.map((id) => db.collection("productPricing").doc(id)),
  );
  const pricingByProductId = new Map<string, ProductPricingDoc | undefined>(
    productIds.map((id, i) => [id, pricingSnaps[i].data() as ProductPricingDoc | undefined]),
  );

  const items: OrderLineItem[] = [];
  for (const line of lines) {
    if (!Number.isInteger(line.qty) || line.qty <= 0) {
      return { error: `Invalid quantity for ${line.name ?? line.productId}` };
    }

    const product = productById(line.productId);
    if (!product) {
      return { error: `Unknown product: ${line.name ?? line.productId}` };
    }

    const variant = product.variants.find((v) => v.label === line.variantLabel);
    if (!variant) {
      return { error: `Unknown variant "${line.variantLabel}" for ${product.name}` };
    }

    const pricing = pricingByProductId.get(line.productId);
    const variantPricing = pricing?.variants?.[line.variantLabel];
    if (!variantPricing || typeof variantPricing.sellingPrice !== "number" || variantPricing.sellingPrice <= 0) {
      return { error: `Could not verify price for ${product.name} (${line.variantLabel})` };
    }

    const lineTotal = variantPricing.sellingPrice * line.qty;
    items.push({
      productId: product.id,
      name: product.name,
      variantLabel: variant.label,
      weightGrams: variant.weightGrams,
      qty: line.qty,
      pricePerUnit: variantPricing.sellingPrice,
      lineTotal,
      hsnCode: product.hsnCode,
      gstRatePercent: product.gstRatePercent,
    });
  }

  const itemTotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
  const taxTotal = items.reduce((sum, it) => sum + inclusiveTax(it.lineTotal, it.gstRatePercent), 0);
  const gstBreakdown = splitGst(taxTotal, buyerStateCode);
  const shippingFee = fulfillmentType === "pickup"
    ? 0
    : shippingFeeFor(itemTotal, await getShippingPolicy());
  const grandTotal = itemTotal + shippingFee;

  return { items, itemTotal, taxTotal, gstBreakdown, shippingFee, grandTotal };
}
