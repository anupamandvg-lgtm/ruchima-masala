"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Product, ProductCategory } from "@/types";
import { useVariantPricing, useVariantInStock } from "@/lib/product-availability-context";
import { useCart } from "@/lib/cart-context";
import { formatINR } from "@/lib/format";
import { CustomQuantitySheet } from "./CustomQuantitySheet";
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

export function ProductCard({ product }: { product: Product }) {
  const { items, add, setQuantity } = useCart();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Default to 1 kg if available (most popular business size), else first variant
  const defaultVariant =
    product.variants.find((v) => v.label === "1 kg")?.label ??
    product.variants[0]?.label ??
    "";
  const [selectedVariantLabel, setSelectedVariantLabel] = useState(defaultVariant);

  const hasMultipleOptions = product.variants.length > 1;

  // Selected variant live pricing & stock
  const pricing = useVariantPricing(product.id, selectedVariantLabel);
  const inStock = useVariantInStock(product.id, selectedVariantLabel);
  const priceKnown = !!pricing;
  const disabled = !inStock || !priceKnown;
  const Icon = CATEGORY_ICONS[product.category] || MasalaPowderCategoryIcon;

  // Find quantity of the currently selected variant in the cart
  const currentCartItem = items.find(
    (i) => i.productId === product.id && i.variantLabel === selectedVariantLabel,
  );
  const currentQty = currentCartItem ? currentCartItem.quantity : 0;

  // Total quantity of any variant of this product in cart
  const totalCartQty = items
    .filter((i) => i.productId === product.id)
    .reduce((sum, i) => sum + i.quantity, 0);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (hasMultipleOptions && currentQty === 0) {
      // Like Flipkart Minutes: tapping "Add (X options)" opens the custom quantity selector sheet
      setIsSheetOpen(true);
      return;
    }

    if (!pricing) return;
    add({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      image: product.images?.[0],
      price: pricing.sellingPrice,
      originalPrice: pricing.originalPrice,
      quantity: 1,
      variantLabel: selectedVariantLabel,
    });
  };

  const handleOpenSheet = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsSheetOpen(true);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setQuantity(product.id, selectedVariantLabel, currentQty + 1);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setQuantity(product.id, selectedVariantLabel, currentQty - 1);
  };

  // Compute discount percentage if originalPrice is present
  const discountPercent =
    pricing?.originalPrice && pricing.originalPrice > pricing.sellingPrice
      ? Math.round(((pricing.originalPrice - pricing.sellingPrice) / pricing.originalPrice) * 100)
      : null;

  return (
    <>
      <div className="group relative flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-2.5 sm:p-3 shadow-xs transition-all duration-200 hover:border-terracotta/40 hover:shadow-md">
        {/* Top: Product Image, Badges & Rating */}
        <div>
          <Link
            href={`/product/${product.slug}`}
            className="relative block aspect-square w-full overflow-hidden rounded-xl bg-gradient-to-br from-amber-50 to-orange-50/60"
          >
            {product.images?.[0] ? (
              <Image
                src={product.images[0]}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 180px, (max-width: 1024px) 240px, 280px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-terracotta" aria-hidden>
                <Icon className="h-12 w-12 sm:h-16 sm:w-16" />
              </div>
            )}

            {/* Bestseller / Wholesale Badge (top left) */}
            <span className="absolute left-2 top-2 rounded-md bg-[#2874f0] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs tracking-tight">
              {product.isWholesaleEligible ? "Wholesale" : "Pure Spice"}
            </span>

            {/* Rating pill (bottom left) */}
            <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-white/95 px-1.5 py-0.5 text-[11px] font-bold text-stone-800 shadow-xs backdrop-blur-xs">
              <span className="text-emerald-700">4.8 ★</span>
            </div>

            {/* Out of stock overlay if applicable */}
            {priceKnown && !inStock && (
              <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-xs grid place-items-center rounded-xl">
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-rose-700 shadow-sm">
                  Out of stock
                </span>
              </div>
            )}
          </Link>

          {/* Action Row right below image: Clickable Quantity Pill + Add/Stepper Button */}
          <div className="mt-2.5 flex items-center justify-between gap-1.5">
            {/* Tappable Quantity Pill (Flipkart Minutes Style) */}
            <button
              type="button"
              onClick={handleOpenSheet}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-100/90 px-2 py-1 text-xs font-semibold text-stone-800 transition-colors hover:border-terracotta hover:bg-amber-50 hover:text-paprika"
              title="Tap to select custom packing size (500g, 1kg, 2kg, 5kg, 10kg, 25kg, 50kg)"
              aria-label={`Select quantity for ${product.name}, current is ${selectedVariantLabel}`}
            >
              <span>{selectedVariantLabel}</span>
              {hasMultipleOptions && (
                <svg
                  className="h-3 w-3 text-stone-500 transition-transform group-hover:translate-y-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>

            {/* Quick Add / Stepper Button */}
            {currentQty > 0 ? (
              <div className="flex items-center rounded-lg border-2 border-terracotta bg-terracotta/5 px-1 py-0.5 shadow-xs">
                <button
                  type="button"
                  onClick={handleDecrement}
                  className="flex h-6 w-6 items-center justify-center rounded-md font-bold text-terracotta transition hover:bg-terracotta hover:text-white"
                  aria-label={`Decrease ${product.name} ${selectedVariantLabel}`}
                >
                  −
                </button>
                <span className="w-5 text-center text-xs font-bold text-terracotta">
                  {currentQty}
                </span>
                <button
                  type="button"
                  onClick={handleIncrement}
                  disabled={!inStock}
                  className="flex h-6 w-6 items-center justify-center rounded-md font-bold text-terracotta transition hover:bg-terracotta hover:text-white disabled:opacity-30"
                  aria-label={`Increase ${product.name} ${selectedVariantLabel}`}
                >
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                disabled={disabled}
                className="group/btn relative flex min-w-[72px] flex-col items-center justify-center rounded-lg border-2 border-terracotta bg-white px-2.5 py-1 text-xs font-bold text-terracotta transition-all hover:bg-terracotta hover:text-white disabled:cursor-not-allowed disabled:border-stone-300 disabled:text-stone-400 disabled:hover:bg-white"
                aria-label={`Add ${product.name} to cart`}
              >
                <span className="leading-tight">
                  {!priceKnown ? "N/A" : !inStock ? "Out" : "Add"}
                </span>
                {hasMultipleOptions && inStock && (
                  <span className="text-[9px] font-semibold leading-none text-terracotta/80 group-hover/btn:text-white/90">
                    {product.variants.length} options
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Product Title */}
          <Link
            href={`/product/${product.slug}`}
            className="mt-2 block font-semibold leading-snug text-stone-900 transition-colors hover:text-terracotta line-clamp-2 text-sm sm:text-[15px]"
          >
            {product.name}
          </Link>
        </div>

        {/* Bottom Section: Pricing, Discount & Delivery Info */}
        <div className="mt-2.5 border-t border-stone-100 pt-2">
          {/* Discount & Price */}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            {priceKnown ? (
              <>
                <span className="text-base sm:text-lg font-bold text-stone-900">
                  {formatINR(pricing!.sellingPrice)}
                </span>
                {pricing!.originalPrice && pricing!.originalPrice > pricing!.sellingPrice && (
                  <span className="text-xs line-through text-stone-400 font-medium">
                    {formatINR(pricing!.originalPrice)}
                  </span>
                )}
                {discountPercent && discountPercent > 0 && (
                  <span className="text-xs font-bold text-emerald-700">
                    {discountPercent}% OFF
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs font-semibold text-stone-500">Price on request</span>
            )}
          </div>

          {/* Delivery & Dispatch Note */}
          <div className="mt-1 flex items-center justify-between text-[11px] text-stone-500">
            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Same day dispatch
            </span>

            {/* Indicator if user has other variants in cart */}
            {totalCartQty > 0 && totalCartQty !== currentQty && (
              <span className="text-[10px] font-semibold text-terracotta">
                {totalCartQty} in cart
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Commerce Custom Quantity Bottom Sheet Modal */}
      <CustomQuantitySheet
        product={product}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        selectedVariantLabel={selectedVariantLabel}
        onSelectVariant={(label) => setSelectedVariantLabel(label)}
      />
    </>
  );
}
