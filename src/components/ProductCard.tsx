"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Product, ProductCategory } from "@/types";
import { useVariantPricing, useVariantInStock } from "@/lib/product-availability-context";
import { useCart } from "@/lib/cart-context";
import { formatINR } from "@/lib/format";
import { QtyStepper } from "./QtyStepper";
import {
  CartIcon,
  MasalaPowderCategoryIcon,
  SpiceBlendCategoryIcon,
  WholeSpiceCategoryIcon,
  InstantMixCategoryIcon,
} from "./icons";

// Falls back to category icon if a product image is not present.
const CATEGORY_ICONS: Record<ProductCategory, React.ComponentType<{ className?: string }>> = {
  "Masala Powders": MasalaPowderCategoryIcon,
  "Spice Blends": SpiceBlendCategoryIcon,
  "Whole Spices": WholeSpiceCategoryIcon,
  "Instant Mixes": InstantMixCategoryIcon,
};

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [variantLabel, setVariantLabel] = useState(product.variants[0]?.label ?? "");
  const hasVariants = product.variants.length > 1;

  // Price/stock are never read from products.ts (it deliberately has no
  // price) — both come live from the productPricing/productInventory
  // Firestore collections via ProductAvailabilityProvider.
  const pricing = useVariantPricing(product.id, variantLabel);
  const inStock = useVariantInStock(product.id, variantLabel);
  const priceKnown = !!pricing;
  const disabled = !inStock || !priceKnown;
  const Icon = CATEGORY_ICONS[product.category];

  const handleAdd = () => {
    if (!pricing) return;
    add({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      image: product.images?.[0],
      price: pricing.sellingPrice,
      originalPrice: pricing.originalPrice,
      quantity: qty,
      variantLabel,
    });
    setQty(1);
  };

  return (
    <div className="card group flex items-stretch gap-3.5 p-3">
      <Link
        href={`/product/${product.slug}`}
        className="relative block h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-turmericgold/20 to-terracotta/15 sm:h-28 sm:w-28"
      >
        {product.images?.[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 96px, 112px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-terracotta" aria-hidden>
            <Icon className="h-10 w-10 sm:h-12 sm:w-12" />
          </div>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/product/${product.slug}`} className="min-w-0 font-semibold leading-snug hover:underline">
            {product.name}
          </Link>
          {priceKnown && !inStock && (
            <span className="shrink-0 rounded-full bg-clove/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-soft">
              Out of stock
            </span>
          )}
        </div>

        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-soft">{product.description}</p>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex flex-col gap-1">
            {priceKnown ? (
              <p className="text-sm font-bold text-terracotta">
                {formatINR(pricing!.sellingPrice)}
                {pricing!.originalPrice && pricing!.originalPrice > pricing!.sellingPrice && (
                  <span className="price-strike ml-1.5">{formatINR(pricing!.originalPrice)}</span>
                )}
              </p>
            ) : (
              <p className="text-sm font-semibold text-soft">Price on request</p>
            )}
            {hasVariants ? (
              <div className="flex flex-wrap gap-1.5">
                {product.variants.map((v) => (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => setVariantLabel(v.label)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
                      variantLabel === v.label
                        ? "border-terracotta bg-terracotta/10 text-paprika"
                        : "border-line text-soft hover:border-terracotta/40"
                    }`}
                    aria-pressed={variantLabel === v.label}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-soft">{product.variants[0]?.label}</p>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <QtyStepper value={qty} onChange={setQty} max={20} labelFor={product.name} disabled={disabled} />
            <button
              onClick={handleAdd}
              disabled={disabled}
              className="btn btn-terracotta px-3.5 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Add ${qty} ${variantLabel} ${product.name} to cart`}
              title={
                !priceKnown
                  ? "Price not set yet — message us on WhatsApp"
                  : !inStock
                    ? `${product.name} (${variantLabel}) is out of stock`
                    : undefined
              }
            >
              <CartIcon className="h-4 w-4" />
              {!priceKnown ? "N/A" : !inStock ? "Out of stock" : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
