"use client";

import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import type { CartItem } from "@/types";
import { DEFAULT_SHIPPING_POLICY } from "./config";

const STORAGE_KEY = "ruchima-masala-cart-v1";

interface CartContextValue {
  items: CartItem[];
  totalUnits: number;
  itemTotal: number;
  /** Display-only estimate (DEFAULT_SHIPPING_POLICY) — the server recomputes
   *  the real shippingFee from the shippingConfig doc at checkout. */
  shippingFeeEstimate: number;
  grandTotalEstimate: number;
  add: (item: CartItem) => void;
  setQuantity: (productId: string, variantLabel: string, quantity: number) => void;
  remove: (productId: string, variantLabel: string) => void;
  clear: () => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  // Hydrate from localStorage once, client-side.
  useEffect(() => {
    setItems(loadCart());
    setHydrated(true);
  }, []);

  // Persist whenever the cart changes.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable (private mode) — cart still works in-memory */
    }
  }, [items, hydrated]);

  // A cart line is keyed by (productId, variantLabel) so the same product at
  // different weights (e.g. 250g vs 500g) stays a separate line.
  const lineMatches = (item: CartItem, productId: string, variantLabel: string) =>
    item.productId === productId && item.variantLabel === variantLabel;

  const add = (item: CartItem) =>
    setItems((prev) => {
      const existing = prev.find((i) => lineMatches(i, item.productId, item.variantLabel));
      if (!existing) return [...prev, item];
      return prev.map((i) =>
        lineMatches(i, item.productId, item.variantLabel)
          ? { ...i, quantity: i.quantity + item.quantity }
          : i,
      );
    });

  const setQuantity = (productId: string, variantLabel: string, quantity: number) =>
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => !lineMatches(i, productId, variantLabel))
        : prev.map((i) => (lineMatches(i, productId, variantLabel) ? { ...i, quantity } : i)),
    );

  const remove = (productId: string, variantLabel: string) =>
    setItems((prev) => prev.filter((i) => !lineMatches(i, productId, variantLabel)));

  const clear = () => setItems([]);

  const value = useMemo<CartContextValue>(() => {
    const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
    const itemTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const shippingFeeEstimate =
      itemTotal === 0 || itemTotal >= DEFAULT_SHIPPING_POLICY.freeAboveAmount
        ? 0
        : DEFAULT_SHIPPING_POLICY.flatFee;
    return {
      items,
      totalUnits,
      itemTotal,
      shippingFeeEstimate,
      grandTotalEstimate: itemTotal + shippingFeeEstimate,
      add,
      setQuantity,
      remove,
      clear,
      cartOpen,
      setCartOpen,
    };
  }, [items, cartOpen]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
