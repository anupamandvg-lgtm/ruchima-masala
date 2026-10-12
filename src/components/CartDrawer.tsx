"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { useVariantInStock } from "@/lib/product-availability-context";
import { formatINR } from "@/lib/format";
import { productById } from "@/lib/products";
import { CartIcon, EmptyCartIcon, ProductPlaceholderIcon } from "./icons";

export function CartDrawer() {
  const {
    items, itemTotal, shippingFeeEstimate, grandTotalEstimate,
    cartOpen, setCartOpen, setQuantity, remove,
  } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCartOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [cartOpen, setCartOpen]);

  if (!cartOpen) return null;

  const goCheckout = () => {
    setCartOpen(false);
    router.push(user ? "/checkout" : "/login");
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Your cart">
      <div className="absolute inset-0 bg-clove/40" onClick={() => setCartOpen(false)} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-paper shadow-lift">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Your cart</h2>
          <button
            onClick={() => setCartOpen(false)}
            className="rounded-full p-2 text-soft transition hover:bg-cardamomdark"
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="text-soft/60" aria-hidden>
              <EmptyCartIcon className="h-14 w-14" />
            </span>
            <p className="font-semibold">Your cart is empty</p>
            <p className="text-sm text-soft">Add some masalas from our shop.</p>
            <Link
              href="/shop"
              onClick={() => setCartOpen(false)}
              className="btn btn-terracotta mt-2"
            >
              Browse shop
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line/60 overflow-y-auto px-5">
              {items.map((item) => (
                <CartLine
                  key={`${item.productId}-${item.variantLabel}`}
                  item={item}
                  onSetQuantity={(qty) => setQuantity(item.productId, item.variantLabel, qty)}
                  onRemove={() => remove(item.productId, item.variantLabel)}
                />
              ))}
            </ul>

            <div className="space-y-1 border-t border-line px-5 py-4 text-sm">
              <div className="flex justify-between text-soft">
                <span>Items</span>
                <span>{formatINR(itemTotal)}</span>
              </div>
              <div className="flex justify-between text-soft">
                <span>Shipping (estimate)</span>
                <span>{shippingFeeEstimate === 0 ? "Free" : formatINR(shippingFeeEstimate)}</span>
              </div>
              <div className="flex justify-between pt-1 text-base font-bold">
                <span>Total</span>
                <span>{formatINR(grandTotalEstimate)}</span>
              </div>
              <p className="pt-1 text-xs text-soft">
                Final shipping fee and GST are confirmed at checkout.
              </p>
              <button onClick={goCheckout} className="btn btn-terracotta w-full">
                <CartIcon className="h-5 w-5" />
                {user ? "Proceed to checkout" : "Log in to checkout"}
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

interface CartItemLike {
  productId: string;
  name: string;
  image?: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  variantLabel: string;
}

function CartLine({
  item, onSetQuantity, onRemove,
}: {
  item: CartItemLike;
  onSetQuantity: (qty: number) => void;
  onRemove: () => void;
}) {
  // CartItem carries its own `image` snapshot from the moment it was added;
  // fall back to the catalog entry's first photo if that's missing.
  const photo = item.image ?? productById(item.productId)?.images?.[0];
  // Live stock check — untracked variants are always purchasable (see
  // product-availability-context.tsx); this only gates the "+" stepper, it
  // never silently removes an already-added line.
  const inStock = useVariantInStock(item.productId, item.variantLabel);

  return (
    <li className="flex items-start gap-3 py-4">
      {photo ? (
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-clove/10">
          <Image src={photo} alt={item.name} fill sizes="48px" className="object-cover" />
        </div>
      ) : (
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-cardamomdark text-soft/50" aria-hidden>
          <ProductPlaceholderIcon className="h-5 w-5" />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-tight">{item.name}</p>
        <p className="text-xs font-medium text-soft">{item.variantLabel}</p>
        <p className="mt-0.5 text-sm text-soft">
          {formatINR(item.price)} {item.quantity > 1 && `× ${item.quantity}`}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-2 rounded-full border border-line px-1.5 py-0.5">
          <button
            onClick={() => onSetQuantity(item.quantity - 1)}
            className="grid h-7 w-7 place-items-center rounded-full text-soft hover:bg-cardamomdark"
            aria-label={`Decrease ${item.name}`}
          >
            −
          </button>
          <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
          <button
            onClick={() => onSetQuantity(item.quantity + 1)}
            disabled={!inStock}
            className="grid h-7 w-7 place-items-center rounded-full text-soft hover:bg-cardamomdark disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={`Increase ${item.name}`}
            title={!inStock ? `${item.name} (${item.variantLabel}) is out of stock` : undefined}
          >
            +
          </button>
        </div>
        <button
          onClick={onRemove}
          className="text-xs font-semibold text-terracotta/70 hover:text-terracotta"
        >
          Remove
        </button>
      </div>
    </li>
  );
}
