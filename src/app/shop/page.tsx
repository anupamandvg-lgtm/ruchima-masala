import { PRODUCT_CATEGORIES, PRODUCTS, PRODUCTS_BY_CATEGORY } from "@/lib/products";
import { ShopCatalogClient } from "@/components/ShopCatalogClient";

export const metadata = {
  title: "Shop Masala Powders & Spice Blends | Ruchima Masala",
  description:
    "Buy fresh ground turmeric, chilli, sambar, and 30+ authentic Karnataka masala blends. Pick custom packing sizes from 500g to 50kg bulk sacks.",
};

export default function ShopPage() {
  const categories = PRODUCT_CATEGORIES.filter((cat) => PRODUCTS_BY_CATEGORY[cat]?.length);

  return (
    <ShopCatalogClient
      products={PRODUCTS}
      categories={categories}
      productsByCategory={PRODUCTS_BY_CATEGORY}
    />
  );
}
