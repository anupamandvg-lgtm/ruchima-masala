"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product, ProductCategory } from "@/types";
import { useProductAvailability } from "@/lib/product-availability-context";
import { useCart } from "@/lib/cart-context";
import { formatINR } from "@/lib/format";
import {
  CartIcon,
  MasalaPowderCategoryIcon,
  SpiceBlendCategoryIcon,
  WholeSpiceCategoryIcon,
  InstantMixCategoryIcon,
} from "./icons";

const CATEGORY_ICONS: Record<ProductCategory, React.ComponentType<{ className?: string }>> = {
  "Masala Powders": MasalaPowderCategoryIcon,
  "Spice Blends": SpiceBlendCategoryIcon,
  "Whole Spices": WholeSpiceCategoryIcon,
  "Instant Mixes": InstantMixCategoryIcon,
};

interface CustomQuantitySheetProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  selectedVariantLabel?: string;
  onSelectVariant?: (variantLabel: string) => void;
}

export function CustomQuantitySheet({
  product,
  isOpen,
  onClose,
  selectedVariantLabel,
  onSelectVariant,
}: CustomQuantitySheetProps) {
  const { items, add, setQuantity, setCartOpen } = useCart();
  const { pricing: allPricing, inventory: allInventory } = useProductAvailability();

  // Close on Escape & lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const Icon = CATEGORY_ICONS[product.category] || MasalaPowderCategoryIcon;
  const prodDoc = allPricing[product.id];
  const invDoc = allInventory[product.id];

  // Helper to find existing cart item for this product + variant
  const getCartQty = (variantLabel: string) => {
    const found = items.find((i) => i.productId === product.id && i.variantLabel === variantLabel);
    return found ? found.quantity : 0;
  };

  // Helper to get live or computed pricing
  const getVariantPrice = (variantLabel: string, weightGrams: number) => {
    if (prodDoc?.variants?.[variantLabel]) {
      return prodDoc.variants[variantLabel];
    }
    // Proportional fallback
    const anyKey = prodDoc?.variants ? Object.keys(prodDoc.variants)[0] : undefined;
    const anyPricing = anyKey ? prodDoc.variants[anyKey] : undefined;
    const anyVariant = anyKey ? product.variants.find((v) => v.label === anyKey) : undefined;
    if (anyPricing && anyVariant && anyVariant.weightGrams > 0) {
      const ratio = weightGrams / anyVariant.weightGrams;
      let volumeFactor = 1.0;
      if (weightGrams >= 50000) volumeFactor = 0.80;
      else if (weightGrams >= 10000) volumeFactor = 0.88;
      else if (weightGrams >= 5000) volumeFactor = 0.92;
      return {
        sellingPrice: Math.round(anyPricing.sellingPrice * ratio * volumeFactor),
        originalPrice: anyPricing.originalPrice ? Math.round(anyPricing.originalPrice * ratio) : undefined,
      };
    }
    return undefined;
  };

  const isVariantInStock = (variantLabel: string) => {
    const entry = invDoc?.variants?.[variantLabel];
    if (!entry) return true;
    return entry.available && entry.stockQty > 0;
  };

  const handleAddToCart = (variantLabel: string, weightGrams: number) => {
    const priceData = getVariantPrice(variantLabel, weightGrams);
    if (!priceData) return;

    add({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      image: product.images?.[0],
      price: priceData.sellingPrice,
      originalPrice: priceData.originalPrice,
      quantity: 1,
      variantLabel,
    });

    if (onSelectVariant) {
      onSelectVariant(variantLabel);
    }
  };

  // Count how many total units of this product are in cart across all variants
  const totalInCartForProduct = items
    .filter((i) => i.productId === product.id)
    .reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quantity-sheet-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Sheet Container (Slides up on mobile, centered modal on desktop) */}
      <div className="relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-paper shadow-2xl sm:max-h-[80vh] sm:max-w-xl sm:rounded-2xl border-t border-line/50 animate-in fade-in slide-in-from-bottom duration-300">
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2.5 sm:hidden" onClick={onClose}>
          <div className="h-1.5 w-12 rounded-full bg-stone-300" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-3 pr-2">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-turmericgold/20 to-terracotta/15 border border-stone-200">
              {product.images?.[0] ? (
                <Image
                  src={product.images[0]}
                  alt={product.name}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-terracotta" aria-hidden>
                  <Icon className="h-6 w-6" />
                </div>
              )}
            </div>
            <div>
              <h2 id="quantity-sheet-title" className="font-display text-lg font-bold leading-tight text-cumin">
                {product.name}
              </h2>
              <p className="mt-0.5 text-xs text-soft line-clamp-1">
                Choose pack size · Manufacturer direct pricing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition hover:bg-stone-200 hover:text-stone-800"
            aria-label="Close pack size picker"
          >
            ✕
          </button>
        </div>

        {/* Packing sizes banner from business flyer */}
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 px-5 py-2 border-b border-amber-200/60 flex items-center justify-between text-xs">
          <span className="font-semibold text-amber-900 flex items-center gap-1.5">
            <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Standard Business Pack Sizes (Up to 50% wholesale off MRP)
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-terracotta bg-terracotta/10 px-2 py-0.5 rounded-full">
            Direct Mill Sourced
          </span>
        </div>

        {/* Options List */}
        <div className="flex-1 overflow-y-auto divide-y divide-line/60 px-5 py-2">
          {product.variants.map((v) => {
            const pricing = getVariantPrice(v.label, v.weightGrams);
            const inStock = isVariantInStock(v.label);
            const qty = getCartQty(v.label);
            const isSelected = selectedVariantLabel === v.label;

            // Unit rate calculation (e.g. per kg or per 100g)
            let unitRateText = "";
            if (pricing?.sellingPrice) {
              if (v.weightGrams >= 1000) {
                const perKg = (pricing.sellingPrice / (v.weightGrams / 1000)).toFixed(0);
                unitRateText = `₹${perKg}/kg`;
              } else {
                const per100g = ((pricing.sellingPrice / v.weightGrams) * 100).toFixed(1);
                unitRateText = `₹${per100g}/100g`;
              }
            }

            // Discount percentage
            const discountPercent =
              pricing?.originalPrice && pricing.originalPrice > pricing.sellingPrice
                ? Math.round(((pricing.originalPrice - pricing.sellingPrice) / pricing.originalPrice) * 100)
                : null;

            // Special badges for standard business quantities
            let badgeText = "";
            let badgeClass = "";
            if (v.label === "1 kg") {
              badgeText = "Best Value";
              badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300";
            } else if (v.label === "500 g") {
              badgeText = "Popular";
              badgeClass = "bg-blue-100 text-blue-800 border-blue-300";
            } else if (v.weightGrams >= 5000 && v.weightGrams <= 10000) {
              badgeText = "Wholesale Pack";
              badgeClass = "bg-amber-100 text-amber-900 border-amber-300";
            } else if (v.weightGrams >= 20000) {
              badgeText = "Bulk Sack (50% Off)";
              badgeClass = "bg-rose-100 text-rose-900 border-rose-300";
            }

            return (
              <div
                key={v.label}
                className={`flex items-center justify-between gap-3 py-3.5 transition-colors ${
                  isSelected ? "bg-amber-50/40 -mx-3 px-3 rounded-xl" : ""
                }`}
              >
                {/* Left: Thumbnail & Details */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-stone-100 border border-stone-200 shadow-sm">
                    {product.images?.[0] ? (
                      <Image
                        src={product.images[0]}
                        alt={v.label}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-terracotta" aria-hidden>
                        <Icon className="h-6 w-6" />
                      </div>
                    )}
                    {badgeText && (
                      <span
                        className={`absolute left-0 top-0 rounded-br-md border-b border-r px-1.5 py-0.5 text-[9px] font-bold leading-none ${badgeClass}`}
                      >
                        {badgeText}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-stone-900">{v.label}</span>
                      {unitRateText && (
                        <span className="text-xs text-soft font-medium">({unitRateText})</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[11px] font-medium text-emerald-700">
                        {v.weightGrams >= 5000 ? "⚡ Bulk Direct from Mill" : "⚡ Same Day Dispatch"}
                      </span>
                    </div>

                    {!inStock && (
                      <span className="text-xs font-semibold text-rose-600">Currently out of stock</span>
                    )}
                  </div>
                </div>

                {/* Right: Pricing & Add Button */}
                <div className="flex items-center gap-3 shrink-0">
                  {pricing ? (
                    <div className="text-right">
                      <div className="flex items-baseline justify-end gap-1.5">
                        {pricing.originalPrice && pricing.originalPrice > pricing.sellingPrice && (
                          <span className="text-xs line-through text-stone-400">
                            {formatINR(pricing.originalPrice)}
                          </span>
                        )}
                        <span className="text-base font-bold text-stone-900">
                          {formatINR(pricing.sellingPrice)}
                        </span>
                      </div>
                      {discountPercent && discountPercent > 0 && (
                        <span className="text-[11px] font-bold text-emerald-600">
                          {discountPercent}% OFF
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-soft">Price on request</span>
                  )}

                  {/* Add or Stepper Button */}
                  <div>
                    {qty > 0 ? (
                      <div className="flex items-center rounded-lg border-2 border-terracotta bg-terracotta/5 px-1 py-0.5 shadow-sm">
                        <button
                          type="button"
                          onClick={() => setQuantity(product.id, v.label, qty - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md font-bold text-terracotta transition hover:bg-terracotta hover:text-white"
                          aria-label={`Decrease ${product.name} ${v.label}`}
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-bold text-terracotta">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(product.id, v.label, qty + 1)}
                          disabled={!inStock}
                          className="flex h-7 w-7 items-center justify-center rounded-md font-bold text-terracotta transition hover:bg-terracotta hover:text-white disabled:opacity-30"
                          aria-label={`Increase ${product.name} ${v.label}`}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddToCart(v.label, v.weightGrams)}
                        disabled={!inStock || !pricing}
                        className="group relative flex items-center justify-center rounded-lg border-2 border-terracotta bg-white px-4 py-1.5 text-xs font-bold text-terracotta transition-all hover:bg-terracotta hover:text-white disabled:cursor-not-allowed disabled:border-stone-300 disabled:text-stone-400 disabled:hover:bg-white"
                      >
                        {!pricing ? "N/A" : !inStock ? "Out" : "Add"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info & View Cart action if items exist */}
        <div className="border-t border-line bg-stone-50 px-5 py-3 rounded-b-2xl flex items-center justify-between">
          <p className="text-xs text-soft">
            {totalInCartForProduct > 0 ? (
              <span className="font-semibold text-terracotta">
                {totalInCartForProduct} pack{totalInCartForProduct > 1 ? "s" : ""} added to your cart
              </span>
            ) : (
              <span>Tap + to add any quantity to cart</span>
            )}
          </p>

          <button
            type="button"
            onClick={() => {
              onClose();
              setCartOpen(true);
            }}
            className="btn btn-terracotta py-1.5 px-3.5 text-xs font-bold shadow-sm inline-flex items-center gap-1.5"
          >
            <CartIcon className="h-4 w-4" />
            View Cart
          </button>
        </div>
      </div>
    </div>
  );
}
