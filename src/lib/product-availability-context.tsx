"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { retryingListener } from "./db";
import type { ProductInventoryDoc, ProductPricingDoc } from "@/types";

interface ProductAvailabilityContextValue {
  /** Keyed by productId. Missing key = no pricing doc yet. */
  pricing: Record<string, ProductPricingDoc>;
  /** Keyed by productId. Missing key = no inventory doc yet = untracked/available
   *  (same convention as rakus-kitchen's menuConfig: untracked never blocks a sale). */
  inventory: Record<string, ProductInventoryDoc>;
  loading: boolean;
}

const ProductAvailabilityContext = createContext<ProductAvailabilityContextValue | null>(null);

/**
 * Live subscription to the productPricing and productInventory collections
 * (both public read — see firestore.rules), so every shop page / product card /
 * cart drawer on the site reflects an admin's price or stock change without a
 * page reload. This is Ruchima's equivalent of rakus-kitchen's
 * MenuAvailabilityProvider — same retryingListener resilience, but subscribing
 * to two live-pricing collections instead of one menuConfig collection, since
 * Ruchima's price itself (not just availability) is admin-editable at runtime.
 */
export function ProductAvailabilityProvider({ children }: { children: ReactNode }) {
  const [pricing, setPricing] = useState<Record<string, ProductPricingDoc>>({});
  const [inventory, setInventory] = useState<Record<string, ProductInventoryDoc>>({});
  const [pricingLoaded, setPricingLoaded] = useState(false);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);

  useEffect(() => {
    if (!db) {
      setPricingLoaded(true);
      setInventoryLoaded(true);
      return;
    }
    const firestore = db;

    const unsubPricing = retryingListener("subscribeProductPricing:ctx", (onSnapshotError) =>
      onSnapshot(
        collection(firestore, "productPricing"),
        (snap) => {
          const next: Record<string, ProductPricingDoc> = {};
          snap.docs.forEach((d) => {
            next[d.id] = d.data() as ProductPricingDoc;
          });
          setPricing(next);
          setPricingLoaded(true);
        },
        onSnapshotError,
      ),
    );

    const unsubInventory = retryingListener("subscribeProductInventory:ctx", (onSnapshotError) =>
      onSnapshot(
        collection(firestore, "productInventory"),
        (snap) => {
          const next: Record<string, ProductInventoryDoc> = {};
          snap.docs.forEach((d) => {
            next[d.id] = d.data() as ProductInventoryDoc;
          });
          setInventory(next);
          setInventoryLoaded(true);
        },
        onSnapshotError,
      ),
    );

    return () => {
      unsubPricing();
      unsubInventory();
    };
  }, []);

  const value = useMemo<ProductAvailabilityContextValue>(
    () => ({ pricing, inventory, loading: !pricingLoaded || !inventoryLoaded }),
    [pricing, inventory, pricingLoaded, inventoryLoaded],
  );

  return (
    <ProductAvailabilityContext.Provider value={value}>
      {children}
    </ProductAvailabilityContext.Provider>
  );
}

export function useProductAvailability(): ProductAvailabilityContextValue {
  const ctx = useContext(ProductAvailabilityContext);
  if (!ctx) throw new Error("useProductAvailability must be used inside <ProductAvailabilityProvider>");
  return ctx;
}

import { productById } from "./products";

/** Convenience: live selling/original price for one variant, or undefined if untracked. */
export function useVariantPricing(productId: string, variantLabel: string) {
  const { pricing } = useProductAvailability();
  const prodDoc = pricing[productId];
  if (!prodDoc?.variants) return undefined;
  if (prodDoc.variants[variantLabel]) return prodDoc.variants[variantLabel];

  // Fallback to proportional calculation from any available variant of this product
  const product = productById(productId);
  const targetVariant = product?.variants.find((v) => v.label === variantLabel);
  const anyKey = Object.keys(prodDoc.variants)[0];
  const anyPricing = anyKey ? prodDoc.variants[anyKey] : undefined;
  const anyVariant = anyKey && product ? product.variants.find((v) => v.label === anyKey) : undefined;
  if (targetVariant && anyPricing && anyVariant && anyVariant.weightGrams > 0) {
    const ratio = targetVariant.weightGrams / anyVariant.weightGrams;
    let volumeFactor = 1.0;
    if (targetVariant.weightGrams >= 50000) volumeFactor = 0.80;
    else if (targetVariant.weightGrams >= 10000) volumeFactor = 0.88;
    else if (targetVariant.weightGrams >= 5000) volumeFactor = 0.92;
    return {
      sellingPrice: Math.round(anyPricing.sellingPrice * ratio * volumeFactor),
      originalPrice: anyPricing.originalPrice ? Math.round(anyPricing.originalPrice * ratio) : undefined,
    };
  }
  return undefined;
}

/**
 * Convenience: is this variant purchasable right now? Untracked (no inventory
 * doc, or no entry for this variant) = treated as in-stock, matching the
 * design choice already made in src/lib/server/productInventory.ts.
 */
export function useVariantInStock(productId: string, variantLabel: string): boolean {
  const { inventory } = useProductAvailability();
  const entry = inventory[productId]?.variants?.[variantLabel];
  if (!entry) return true;
  return entry.available && entry.stockQty > 0;
}
