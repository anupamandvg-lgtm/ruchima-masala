"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import {
  MasalaPowderCategoryIcon,
  SpiceBlendCategoryIcon,
  WholeSpiceCategoryIcon,
  InstantMixCategoryIcon,
  WhatsAppIcon,
} from "@/components/icons";
import { waMeLink } from "@/lib/whatsapp";
import type { Product, ProductCategory } from "@/types";

const CATEGORY_ICONS: Record<ProductCategory, React.ComponentType<{ className?: string }>> = {
  "Masala Powders": MasalaPowderCategoryIcon,
  "Spice Blends": SpiceBlendCategoryIcon,
  "Whole Spices": WholeSpiceCategoryIcon,
  "Instant Mixes": InstantMixCategoryIcon,
};

interface ShopCatalogClientProps {
  products: Product[];
  categories: ProductCategory[];
  productsByCategory: Record<string, Product[]>;
}

export function ShopCatalogClient({
  products,
  categories,
  productsByCategory,
}: ShopCatalogClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Filter products by search & selected category
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory =
        selectedCategory === "All" ||
        (selectedCategory === "Bulk" ? p.isWholesaleEligible : p.category === selectedCategory);

      if (!matchesCategory) return false;
      if (!q) return true;

      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, searchQuery, selectedCategory]);

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-6 py-6 sm:py-10">
      {/* Hero / Quick Commerce Header */}
      <div className="mb-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-300 px-3 py-1 text-xs font-bold text-amber-900 mb-2">
            🌶️ Direct from Bangalore Mill · 32+ Varieties
          </div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl text-stone-900">
            Freshly Ground Masala Powders & Blends
          </h1>
          <p className="mx-auto mt-1.5 max-w-xl text-xs sm:text-sm text-stone-600">
            Select any packing size:{" "}
            <span className="font-semibold text-stone-800">
              500g | 1kg | 2kg | 3kg | 5kg | 10kg | 20kg | 25kg | 50kg
            </span>
            .{" "}
            <Link href="/bulk-order" className="font-bold text-terracotta hover:underline">
              Wholesale up to 50% off market price →
            </Link>
          </p>
        </div>

        {/* Quick Commerce Search Bar (Flipkart Minutes Style) */}
        <div className="mt-5 mx-auto max-w-2xl relative">
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-stone-400" aria-hidden>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search turmeric powder, sambar, biryani masala, chicken masala..."
              className="w-full rounded-2xl border-2 border-stone-200 bg-white py-3 pl-11 pr-10 text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/20 shadow-xs transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Business Standards Flyer Banner (from Screenshot 3) */}
        <div className="mt-4 mx-auto max-w-4xl rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-terracotta p-0.5 shadow-sm">
          <div className="rounded-[14px] bg-white px-3.5 py-2.5 sm:px-5 sm:py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-800 shrink-0 font-bold">
                ✓
              </span>
              <div>
                <p className="font-bold text-stone-900 leading-tight">
                  Ruchima Masala Business Standards
                </p>
                <p className="text-[11px] text-stone-600">
                  Packing sizes: 500g · 1kg · 2kg · 3kg · 5kg · 10kg · 20kg · 25kg · 50kg sacks
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                50% Bulk Discount
              </span>
              <Link
                href={waMeLink("Hi Ruchima Masala! I need wholesale inquiry for packing sizes.")}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-terracotta py-1 px-2.5 text-xs inline-flex items-center gap-1 font-bold shadow-xs"
              >
                <WhatsAppIcon className="h-3.5 w-3.5" />
                Inquire
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Category & Filter Pills (Quick Commerce Style) */}
      <div className="sticky top-16 z-30 mb-6 -mx-3 sm:-mx-6 overflow-x-auto bg-paper/95 px-3 sm:px-6 py-2.5 backdrop-blur-md border-y border-line/60">
        <div className="flex items-center gap-2 min-w-max">
          <button
            type="button"
            onClick={() => setSelectedCategory("All")}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
              selectedCategory === "All"
                ? "bg-stone-900 text-white shadow-xs"
                : "border border-stone-200 bg-white text-stone-700 hover:border-stone-400"
            }`}
          >
            All ({products.length})
          </button>

          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat] || MasalaPowderCategoryIcon;
            const isSelected = selectedCategory === cat;
            const count = productsByCategory[cat]?.length ?? 0;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? "All" : cat)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-terracotta text-white shadow-xs"
                    : "border border-stone-200 bg-white text-stone-700 hover:border-terracotta/50 hover:bg-amber-50/50"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isSelected ? "text-white" : "text-terracotta"}`} />
                <span>{cat}</span>
                <span className={`text-[10px] ${isSelected ? "text-white/80" : "text-stone-400"}`}>
                  ({count})
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setSelectedCategory(selectedCategory === "Bulk" ? "All" : "Bulk")}
            className={`flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
              selectedCategory === "Bulk"
                ? "bg-amber-800 text-white shadow-xs"
                : "border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
            }`}
          >
            ⚡ Wholesale Sacks (5kg - 50kg)
          </button>
        </div>
      </div>

      {/* Product Grid: 2 columns on mobile (Quick Commerce Standard), 3-4 on desktop */}
      {filteredProducts.length === 0 ? (
        <div className="my-12 rounded-2xl border border-dashed border-stone-300 p-8 text-center bg-stone-50">
          <p className="font-bold text-stone-800">No masalas match &quot;{searchQuery}&quot;</p>
          <p className="mt-1 text-xs text-soft">
            Try searching for turmeric, chilli, sambar, puliyogare, or clear the search.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("All");
            }}
            className="btn btn-terracotta mt-4 px-4 py-1.5 text-xs"
          >
            Show all varieties
          </button>
        </div>
      ) : selectedCategory === "All" && !searchQuery ? (
        // When viewing all without search, group by category sections
        <div className="space-y-10">
          {categories.map((category) => {
            const catProducts = productsByCategory[category] ?? [];
            if (catProducts.length === 0) return null;

            return (
              <section key={category} className="scroll-mt-28">
                <div className="mb-3.5 flex items-end justify-between border-b border-line pb-2">
                  <div>
                    <h2 className="font-display text-lg sm:text-xl font-bold text-stone-900">
                      {category}
                    </h2>
                    <p className="text-xs text-soft">
                      Tap quantity pill on any card to select custom packing size
                    </p>
                  </div>
                  <Link
                    href={`/shop/${encodeURIComponent(category)}`}
                    className="text-xs font-bold text-terracotta hover:underline"
                  >
                    View all {catProducts.length} →
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {catProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        // Filtered view (by search query or specific filter pill)
        <div>
          <div className="mb-3 flex items-center justify-between text-xs text-soft">
            <span>
              Showing <strong className="text-stone-900">{filteredProducts.length}</strong> items
              {searchQuery && ` for "${searchQuery}"`}
            </span>
            {(searchQuery || selectedCategory !== "All") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                }}
                className="font-bold text-terracotta hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
