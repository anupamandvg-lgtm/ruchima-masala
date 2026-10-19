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

const CATEGORY_ICONS: Record<ProductCategory, React.ComponentType<{ className?: string }>> = {
  "Masala Powders": MasalaPowderCategoryIcon,
  "Spice Blends": SpiceBlendCategoryIcon,
  "Whole Spices": WholeSpiceCategoryIcon,
  "Instant Mixes": InstantMixCategoryIcon,
};

export function ProductDetail({ product }: { product: Product }) {
  const { add, setCartOpen } = useCart();
  const [qty, setQty] = useState(1);
  const [variantLabel, setVariantLabel] = useState(product.variants[0]?.label ?? "");
  const hasVariants = product.variants.length > 1;

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
    // Open the drawer so the add is visually confirmed, same pattern as a
    // typical "add to cart" flow on a dedicated product page.
    setCartOpen(true);
  };

  return (
    <div className="card grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-turmericgold/20 to-terracotta/15 shadow-sm">
        {product.images?.[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            priority
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-terracotta" aria-hidden>
            <Icon className="h-24 w-24" />
          </div>
        )}
      </div>

      <div className="flex flex-col">
        <span className="chip w-fit border-terracotta/30 bg-terracotta/10 text-paprika">{product.category}</span>
        <h1 className="mt-3 font-display text-2xl font-bold text-cumin sm:text-3xl">{product.name}</h1>
        <p className="mt-2 text-sm leading-relaxed text-soft">{product.description}</p>

        <div className="mt-5">
          {priceKnown ? (
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl font-bold text-cumin">
                {formatINR(pricing!.sellingPrice)}
              </span>
              {pricing!.originalPrice && pricing!.originalPrice > pricing!.sellingPrice && (
                <>
                  <span className="price-strike text-lg text-soft">
                    {formatINR(pricing!.originalPrice)}
                  </span>
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                    {Math.round(((pricing!.originalPrice - pricing!.sellingPrice) / pricing!.originalPrice) * 100)}% OFF
                  </span>
                </>
              )}
            </div>
          ) : (
            <p className="text-lg font-semibold text-soft">Price on request</p>
          )}
          {!priceKnown && (
            <p className="mt-1 text-xs text-soft">
              This item&apos;s online price isn&apos;t set yet — message us on WhatsApp for pricing.
            </p>
          )}
          {priceKnown && !inStock && (
            <p className="mt-1 text-xs font-semibold text-terracotta">{variantLabel} is currently out of stock.</p>
          )}
        </div>

        {hasVariants && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-soft">Select Pack Size (Business Standard)</p>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Bulk discounts up to 50%
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <button
                  key={v.label}
                  type="button"
                  onClick={() => setVariantLabel(v.label)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                    variantLabel === v.label
                      ? "border-terracotta bg-terracotta/10 text-paprika shadow-xs"
                      : "border-line text-soft hover:border-terracotta/40 hover:bg-stone-50"
                  }`}
                  aria-pressed={variantLabel === v.label}
                >
                  <span>{v.label}</span>
                  {v.weightGrams >= 5000 && (
                    <span className="text-[9px] uppercase font-bold text-terracotta bg-terracotta/10 px-1 py-0.2 rounded">
                      Wholesale
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <QtyStepper value={qty} onChange={setQty} max={20} labelFor={product.name} disabled={disabled} />
          <button
            onClick={handleAdd}
            disabled={disabled}
            className="btn btn-terracotta flex-1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CartIcon className="h-5 w-5" />
            {!priceKnown ? "Price not set" : !inStock ? "Out of stock" : "Add to cart"}
          </button>
        </div>

        {product.isWholesaleEligible && (
          <p className="mt-4 text-xs text-soft">
            Buying in bulk?{" "}
            <Link href="/bulk-order" className="font-semibold text-terracotta hover:underline">
              See wholesale pricing
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
