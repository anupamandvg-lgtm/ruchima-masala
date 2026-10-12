import Link from "next/link";
import Image from "next/image";
import { BUSINESS } from "@/lib/config";
import { waMeLink } from "@/lib/whatsapp";

export function Footer() {
  return (
    <footer className="border-t border-line/70 bg-cardamomdark/50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Image
            src="/images/brand/logo-wide-h120.png"
            alt="Ruchima Masala"
            width={246}
            height={120}
            className="h-12 w-auto"
          />
          <p className="max-w-xs text-sm text-soft">
            Authentic & tasty masala powders, straight from the mill. Trusted by
            20,000+ customers — retail packs, bulk wholesale, and white-label
            manufacturing.
          </p>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-soft">Shop</p>
          <ul className="space-y-2 text-sm">
            <li><Link className="text-cumin hover:text-terracotta" href="/shop">Full Catalog</Link></li>
            <li><Link className="text-cumin hover:text-terracotta" href="/bulk-order">Bulk / Wholesale</Link></li>
            <li><Link className="text-cumin hover:text-terracotta" href="/white-label">White Label</Link></li>
            <li><Link className="text-cumin hover:text-terracotta" href="/orders">Track My Order</Link></li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-soft">Visit & order</p>
          <ul className="space-y-2 text-sm text-soft">
            <li>{BUSINESS.address}</li>
            <li>Pan-India delivery · Dubai dealer shipments on request</li>
            <li>Bulk orders up to 10,000 kg/day</li>
            <li>Mon–Sat, 9 AM – 7 PM</li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-soft">Talk to us</p>
          <div className="space-y-2 text-sm">
            <a href={`tel:${BUSINESS.phone}`} className="block text-cumin hover:text-terracotta">
              {BUSINESS.phoneDisplay}
            </a>
            <a
              href={waMeLink("Hi Ruchima Masala! I'd like to place an order.")}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-terracotta font-semibold hover:underline"
            >
              WhatsApp us
            </a>
            <a
              href={BUSINESS.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-cumin hover:text-terracotta"
            >
              Instagram @{BUSINESS.instagram}
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-line/60 px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-soft">
        <p>© {new Date().getFullYear()} Ruchima Masala · Authentic & Tasty, Straight From the Mill · Bangalore</p>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-cumin hover:underline">
            Privacy Policy & DPDP Notice
          </Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-cumin hover:underline">
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  );
}
