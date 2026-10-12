import Link from "next/link";
import { PRODUCT_CATEGORIES, PRODUCTS_BY_CATEGORY } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import {
  MasalaPowderCategoryIcon,
  SpiceBlendCategoryIcon,
  WholeSpiceCategoryIcon,
  InstantMixCategoryIcon,
  WhatsAppIcon,
} from "@/components/icons";
import { waMeLink } from "@/lib/whatsapp";
import type { ProductCategory } from "@/types";

export const metadata = { title: "Shop" };

const CATEGORY_ICONS: Record<ProductCategory, React.ComponentType<{ className?: string }>> = {
  "Masala Powders": MasalaPowderCategoryIcon,
  "Spice Blends": SpiceBlendCategoryIcon,
  "Whole Spices": WholeSpiceCategoryIcon,
  "Instant Mixes": InstantMixCategoryIcon,
};

export default function ShopPage() {
  // Only categories with at least one product get a section — "Whole
  // Spices" has none in the catalog yet (see products.ts), so it's omitted
  // here rather than rendering an empty section.
  const categories = PRODUCT_CATEGORIES.filter((cat) => PRODUCTS_BY_CATEGORY[cat]?.length);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <div className="mb-6 text-center">
        <h1 className="section-title">Full catalog</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-soft">
          30+ masala powders, spice blends and instant mixes. Buying by the
          sack for a hotel or store?{" "}
          <Link href="/bulk-order" className="font-semibold text-terracotta hover:underline">
            See wholesale pricing
          </Link>
          .
        </p>
        <Link
          href={waMeLink("Hi Ruchima Masala! I have a question about a product.")}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-transparent mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs"
        >
          <WhatsAppIcon className="h-4 w-4" /> Ask about a product
        </Link>
      </div>

      {/* Sticky category quick-nav — mirrors rakus-kitchen's menu page pattern */}
      <div className="sticky top-16 z-30 mb-8 -mx-4 overflow-x-auto bg-paper/95 px-4 py-2.5 backdrop-blur border-y border-line/60">
        <div className="flex items-center justify-center gap-2 min-w-max">
          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat];
            const targetId = cat.replace(/\s+/g, "-").toLowerCase();
            return (
              <a
                key={cat}
                href={`#${targetId}`}
                className="flex items-center gap-2 rounded-full border border-line bg-cardamomdark/50 px-3.5 py-1.5 text-xs font-semibold text-cumin transition hover:border-terracotta hover:bg-terracotta/10 hover:text-paprika"
              >
                <Icon className="h-4 w-4 stroke-[1.8] text-paprika" />
                {cat}
              </a>
            );
          })}
        </div>
      </div>

      {categories.map((category) => (
        <section key={category} id={category.replace(/\s+/g, "-").toLowerCase()} className="mb-10 scroll-mt-20">
          <div className="mb-4 flex items-end justify-between border-b border-line pb-2">
            <h2 className="font-display text-xl font-semibold sm:text-2xl">{category}</h2>
            <Link
              href={`/shop/${encodeURIComponent(category)}`}
              className="text-sm font-semibold text-terracotta hover:underline"
            >
              View only this →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {PRODUCTS_BY_CATEGORY[category].map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
