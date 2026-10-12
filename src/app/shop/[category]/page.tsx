import Link from "next/link";
import { notFound } from "next/navigation";
import { PRODUCT_CATEGORIES, PRODUCTS_BY_CATEGORY } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import type { ProductCategory } from "@/types";

/**
 * No slug/reverse-lookup helper exists for categories yet — PRODUCTS_BY_CATEGORY
 * is keyed by the raw ProductCategory string ("Masala Powders", with the
 * space). Rather than add new slug infrastructure, this route decodes the
 * URL segment and matches it directly against that raw string — the same
 * convention the home page's CATEGORY_TILES already link with
 * (/shop/Masala%20Powders). If the category set grows or needs prettier
 * URLs later, a real slugify/reverse-lookup map should replace this.
 */
function resolveCategory(raw: string): ProductCategory | undefined {
  const decoded = decodeURIComponent(raw);
  return PRODUCT_CATEGORIES.find((c) => c.toLowerCase() === decoded.toLowerCase());
}

export function generateStaticParams() {
  return PRODUCT_CATEGORIES.map((category) => ({ category }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const { category: raw } = await params;
  const category = resolveCategory(raw);
  return { title: category ?? "Shop" };
}

export default async function ShopCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: raw } = await params;
  const category = resolveCategory(raw);
  if (!category) notFound();

  const products = PRODUCTS_BY_CATEGORY[category] ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <div className="mb-6">
        <Link href="/shop" className="text-sm font-semibold text-terracotta hover:underline">
          ← All products
        </Link>
        <h1 className="section-title mt-2">{category}</h1>
      </div>

      {products.length === 0 ? (
        <div className="card p-8 text-center text-soft">
          <p className="font-semibold text-cumin">Coming soon</p>
          <p className="mt-1 text-sm">
            We don&apos;t have {category.toLowerCase()} listed online yet. Message us on WhatsApp and we&apos;ll
            sort you out.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
