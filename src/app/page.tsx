import Link from "next/link";
import Image from "next/image";
import { BUSINESS } from "@/lib/config";
import { waMeLink } from "@/lib/whatsapp";
import { PRODUCTS } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import {
  WhatsAppIcon,
  MapPinIcon,
  MasalaPowderTileIcon,
  SpiceBlendTileIcon,
  WholeSpiceTileIcon,
  InstantMixTileIcon,
  FreshIngredientsIcon,
  AuthenticTasteIcon,
  HygienicPrepIcon,
  BulkOrderIcon,
} from "@/components/icons";

const CATEGORY_TILES = [
  {
    Icon: MasalaPowderTileIcon,
    href: "/shop/Masala%20Powders",
    label: "Masala Powders",
    note: "Turmeric, Chilli, Coriander & Jeera",
    tag: "9 Varieties",
    accent: "bg-red-50 text-red-600 border-red-200",
  },
  {
    Icon: SpiceBlendTileIcon,
    href: "/shop/Spice%20Blends",
    label: "Spice Blends",
    note: "Sambar, Biryani, Garam & Chicken",
    tag: "18 Varieties",
    accent: "bg-amber-50 text-amber-600 border-amber-200",
  },
  {
    Icon: InstantMixTileIcon,
    href: "/shop/Instant%20Mixes",
    label: "Ready-to-Cook Mixes",
    note: "Pani Puri, Bisi Bele & Vangi Bath",
    tag: "3 Varieties",
    accent: "bg-emerald-50 text-emerald-600 border-emerald-200",
  },
  {
    Icon: BulkOrderIcon,
    href: "/bulk-order",
    label: "Wholesale Sacks",
    note: "5kg, 10kg, 20kg, 25kg & 50kg Sacks",
    tag: "Up to 50% Off",
    accent: "bg-stone-50 text-stone-700 border-stone-200",
  },
];

const PACKING_STANDARDS = [
  { label: "500 g", type: "Retail Pack", popular: true },
  { label: "1 kg", type: "Family / Standard", popular: true, bestValue: true },
  { label: "2 kg", type: "Catering Pack" },
  { label: "3 kg", type: "Kitchen Pack" },
  { label: "5 kg", type: "Commercial Pack", wholesale: true },
  { label: "10 kg", type: "Bulk Sack", wholesale: true },
  { label: "20 kg", type: "Wholesale Sack", wholesale: true },
  { label: "25 kg", type: "Export Sack", wholesale: true },
  { label: "50 kg", type: "Master Sack", wholesale: true, topDiscount: true },
];

const PILLARS = [
  {
    Icon: FreshIngredientsIcon,
    title: "Freshly Milled",
    text: "Ground fresh in Bangalore close to order time — never stocked for months in warehouses.",
  },
  {
    Icon: AuthenticTasteIcon,
    title: "100% Pure & Lab Tested",
    text: "No preservatives, no artificial colours, no starch fillers. Traditional regional spice recipes.",
  },
  {
    Icon: HygienicPrepIcon,
    title: "FSSAI & Export Quality",
    text: "Clean, hygienic processing and packaging adhering to strict food safety guidelines.",
  },
  {
    Icon: BulkOrderIcon,
    title: "Manufacturer Direct",
    text: "Skip distributors and middlemen. Enjoy up to 50% wholesale savings direct from the mill.",
  },
];

export default function HomePage() {
  // Top 8 bestselling products for the Quick Commerce showcase
  const popularIds = [
    "turmeric-powder",
    "bright-chilli-powder",
    "sambar-powder-spicy",
    "dum-biryani-masala",
    "grand-chicken-masala",
    "royal-garam-masala",
    "kitchen-king",
    "kabab-masala",
  ];
  const featuredProducts = popularIds
    .map((id) => PRODUCTS.find((p) => p.id === id))
    .filter((p): p is (typeof PRODUCTS)[number] => !!p);

  return (
    <div className="bg-white text-stone-900">
      {/* ── HERO SECTION ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-100 bg-white">
        {/* Subtle decorative background gradient */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(55rem_30rem_at_80%_-10%,rgba(217,119,6,0.08),transparent),radial-gradient(45rem_25rem_at_10%_100%,rgba(179,38,30,0.06),transparent)]"
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:py-20 md:grid-cols-2">
          {/* Left Column: Headline & Value Proposition */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50/80 px-3 py-1 text-xs font-bold text-amber-900">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Direct from Bangalore Mill · 32+ Varieties
            </div>

            <h1 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight text-stone-900 sm:text-5xl lg:text-[3.25rem]">
              Authentic Indian Masalas,{" "}
              <span className="text-terracotta">milled fresh & fast.</span>
            </h1>

            <p className="mt-4 max-w-lg text-base sm:text-lg text-stone-600 leading-relaxed">
              Karnataka&apos;s trusted spice mill. Pick custom packing sizes from{" "}
              <strong className="text-stone-900">500g home packs to 50kg wholesale sacks</strong>.
              Pure, unadulterated spices delivered straight to your door or kitchen.
            </p>

            {/* Quick trust checkmarks */}
            <div className="mt-5 grid grid-cols-2 gap-2 text-xs font-semibold text-stone-700">
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                100% Pure & Lab Tested
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                No Artificial Colours
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                FSSAI Certified Milling
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Multiple Packing Sizes
              </span>
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link
                href="/shop"
                className="btn btn-terracotta px-7 py-3.5 text-sm font-bold shadow-sm inline-flex items-center justify-center gap-2"
              >
                Explore All Products →
              </Link>
              <Link
                href={waMeLink("Hi Ruchima Masala! I want to order freshly ground spices.")}
                target="_blank"
                rel="noopener noreferrer"
                className="btn bg-emerald-600 text-white hover:bg-emerald-700 px-6 py-3.5 text-sm font-bold shadow-sm inline-flex items-center justify-center gap-2"
              >
                <WhatsAppIcon className="h-4 w-4" />
                Order on WhatsApp
              </Link>
            </div>

            {/* Trust footer info */}
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-stone-500 pt-4 border-t border-slate-100">
              <span className="inline-flex items-center gap-1.5">
                <BulkOrderIcon className="h-4 w-4 text-terracotta" /> Up to 10,000 kg/day milling capacity
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPinIcon className="h-4 w-4 text-terracotta" /> Andrahalli, Bangalore
              </span>
            </div>
          </div>

          {/* Right Column: Hero Graphic with Badges */}
          <div className="relative mx-auto aspect-square w-full max-w-md">
            <div
              aria-hidden
              className="absolute inset-4 rounded-full bg-gradient-to-tr from-amber-400/20 to-terracotta/20 blur-2xl"
            />
            <div className="relative h-full w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-3 shadow-xl">
              <div className="relative h-full w-full overflow-hidden rounded-2xl">
                <Image
                  src="/images/hero/hero-image.png"
                  alt="Freshly ground pure spices and masala powders"
                  fill
                  priority
                  sizes="(max-width: 640px) 340px, 420px"
                  className="object-cover"
                />
              </div>

              {/* Floating trust badges */}
              <div className="absolute top-6 right-6 rounded-xl border border-slate-100 bg-white/95 px-3 py-1.5 shadow-md backdrop-blur-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Fresh Stock</p>
                <p className="text-xs font-bold text-stone-900">32+ Milled SKUs</p>
              </div>

              <div className="absolute bottom-6 left-6 rounded-xl border border-slate-100 bg-white/95 px-3.5 py-2 shadow-md backdrop-blur-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-terracotta">Wholesale Direct</p>
                <p className="text-xs font-bold text-stone-900">500g to 50kg Sacks</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CATEGORY EXPLORER ──────────────────────────────────────────── */}
      <section className="bg-slate-50/70 py-10 sm:py-14 border-b border-slate-100">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-terracotta">Catalog</span>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-900">
                Explore by Category
              </h2>
            </div>
            <Link href="/shop" className="text-xs font-bold text-terracotta hover:underline">
              View full shop →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {CATEGORY_TILES.map((tile) => (
              <Link
                key={tile.label}
                href={tile.href}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition-all hover:-translate-y-1 hover:border-terracotta/40 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-terracotta group-hover:bg-terracotta group-hover:text-white transition-colors" aria-hidden>
                      <tile.Icon className="h-5 w-5" />
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-stone-600">
                      {tile.tag}
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-stone-900 group-hover:text-terracotta transition-colors text-sm sm:text-base">
                    {tile.label}
                  </h3>
                  <p className="mt-1 text-xs text-stone-500 line-clamp-1">{tile.note}</p>
                </div>
                <span className="mt-3 text-[11px] font-bold text-terracotta">Browse items →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUICK COMMERCE FEATURED PRODUCTS ────────────────────────────── */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-bold text-amber-900 mb-1.5">
                ⚡ Quick Commerce Feature
              </div>
              <h2 className="font-display text-2xl font-bold sm:text-3xl text-stone-900">
                Bestselling Spices & Masalas
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-stone-600 max-w-xl">
                Tap on any quantity pill (e.g. <strong className="text-stone-800">1 kg ▾</strong>) on the card to open the custom pack size selector from 500g to 50kg!
              </p>
            </div>
            <Link
              href="/shop"
              className="btn btn-terracotta py-2 px-4 text-xs font-bold shadow-xs inline-flex items-center gap-1"
            >
              View All 30+ SKUs →
            </Link>
          </div>

          {/* Quick Commerce 2-col on mobile, 4-col on desktop */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {featuredProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* ── BUSINESS PACKING STANDARDS (FROM SCREENSHOT 3) ──────────────── */}
      <section className="bg-gradient-to-b from-slate-50 to-white py-12 sm:py-16 border-y border-slate-100">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="rounded-full bg-amber-100 border border-amber-300 px-3 py-1 text-xs font-bold text-amber-900">
              Ruchima Business Standards
            </span>
            <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl text-stone-900">
              Standard Packing Sizes Available
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-stone-600">
              Manufacturer direct to homes, restaurants, caterers, and supermarkets. All products are packaged in certified airtight containers and master sacks.
            </p>
          </div>

          {/* Grid of 9 standard packing sizes */}
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-9 sm:gap-3">
            {PACKING_STANDARDS.map((s) => (
              <div
                key={s.label}
                className={`relative flex flex-col items-center justify-center rounded-2xl border bg-white p-3 text-center shadow-xs transition-all hover:border-terracotta hover:shadow-sm ${
                  s.bestValue
                    ? "border-emerald-300 ring-2 ring-emerald-500/20"
                    : s.wholesale
                    ? "border-amber-300"
                    : "border-slate-200"
                }`}
              >
                {s.bestValue && (
                  <span className="absolute -top-2 rounded-full bg-emerald-600 px-1.5 py-0.2 text-[9px] font-bold text-white">
                    Best Value
                  </span>
                )}
                {s.topDiscount && (
                  <span className="absolute -top-2 rounded-full bg-rose-600 px-1.5 py-0.2 text-[9px] font-bold text-white">
                    50% Off
                  </span>
                )}
                <span className="text-base sm:text-lg font-bold text-stone-900">{s.label}</span>
                <span className="mt-1 text-[10px] font-semibold text-stone-500 leading-tight">
                  {s.type}
                </span>
              </div>
            ))}
          </div>

          {/* Wholesale highlight card */}
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-terracotta/10 text-terracotta">
                  <BulkOrderIcon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                    Need Custom White-Labeling or Bulk Ton Supply?
                  </h3>
                  <p className="text-xs text-stone-600 mt-0.5">
                    For private-label packaging with your own brand name or daily hotel supply up to 10,000 kg.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <Link
                  href="/white-label"
                  className="btn btn-ghost py-2 px-3.5 text-xs font-bold flex-1 sm:flex-initial"
                >
                  White Label
                </Link>
                <Link
                  href="/bulk-order"
                  className="btn btn-terracotta py-2 px-4 text-xs font-bold flex-1 sm:flex-initial"
                >
                  Bulk Inquiry
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY RUCHIMA MASALA (PILLARS) ─────────────────────────────────── */}
      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-terracotta">Quality Guarantee</span>
            <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl text-stone-900">
              Why 20,000+ Customers Trust Ruchima
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-stone-600">
              Fresh raw spice sourcing directly from Guntur, Wayanad, and Salem farmers.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-slate-300 hover:shadow-md"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-50 text-terracotta mb-4" aria-hidden>
                  <p.Icon className="h-6 w-6" />
                </span>
                <h3 className="font-display font-bold text-base text-stone-900">{p.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-stone-600">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DIRECT WHATSAPP & PHONE ACTION STRIP ────────────────────────── */}
      <section className="bg-slate-50 border-t border-slate-200/80 py-12">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-300 px-3 py-1 text-xs font-bold text-emerald-900 mb-3">
            💬 Quick Order & Customer Support
          </span>
          <h2 className="font-display text-2xl font-bold sm:text-3xl text-stone-900">
            Prefer to order directly via WhatsApp or Phone?
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-stone-600 max-w-lg mx-auto">
            Our Bangalore mill team is online Mon–Sat from 9 AM to 7 PM to take orders, suggest spice quantities, and dispatch same-day.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href={waMeLink("Hi Ruchima Masala! I want to place an order.")}
              target="_blank"
              rel="noopener noreferrer"
              className="btn bg-emerald-600 text-white hover:bg-emerald-700 px-6 py-3 text-sm font-bold shadow-sm inline-flex items-center gap-2"
            >
              <WhatsAppIcon className="h-5 w-5" />
              WhatsApp: {BUSINESS.phoneDisplay}
            </a>

            <Link
              href="/shop"
              className="btn btn-terracotta px-6 py-3 text-sm font-bold shadow-sm"
            >
              Browse Shop Online
            </Link>
          </div>

          <p className="mt-4 text-[11px] text-stone-500">
            Pan-India delivery via Porter, Delhivery & Shiprocket · Same-day dispatch on Bangalore orders
          </p>
        </div>
      </section>
    </div>
  );
}
