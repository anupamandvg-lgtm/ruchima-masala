import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart-context";
import { ProductAvailabilityProvider } from "@/lib/product-availability-context";
import { ClientOrderAlertsProvider } from "@/lib/client-order-alerts-context";
import { Nav } from "@/components/Nav";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { ClientOrderToast } from "@/components/ClientOrderToast";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ruchima Masala — Authentic & Tasty, Straight From the Mill",
    template: "%s · Ruchima Masala",
  },
  description:
    "Authentic masala powders and spice blends from Ruchima Masala, Bangalore. Retail packs, bulk wholesale and white-label manufacturing — order online, pan-India delivery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-dvh flex flex-col">
        <AuthProvider>
          <ClientOrderAlertsProvider>
            <ProductAvailabilityProvider>
              <CartProvider>
                <Nav />
                <main className="flex-1 pb-20 md:pb-0">{children}</main>
                <Footer />
                <CartDrawer />
                <MobileNav />
                <ClientOrderToast />
              </CartProvider>
            </ProductAvailabilityProvider>
          </ClientOrderAlertsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
