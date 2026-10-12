import Link from "next/link";
import { notFound } from "next/navigation";
import { PRODUCTS, productBySlug } from "@/lib/products";
import { ProductDetail } from "@/components/ProductDetail";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const product = productBySlug(params.slug);
  return { title: product?.name ?? "Product" };
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = productBySlug(params.slug);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <Link href={`/shop/${encodeURIComponent(product.category)}`} className="text-sm font-semibold text-terracotta hover:underline">
        ← {product.category}
      </Link>
      <div className="mt-4">
        <ProductDetail product={product} />
      </div>
    </div>
  );
}
