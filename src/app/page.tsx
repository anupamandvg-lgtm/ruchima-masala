import Link from "next/link";
import Image from "next/image";
import { BUSINESS } from "@/lib/config";
import { waMeLink } from "@/lib/whatsapp";
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

// Icon-based tiles, not photos — the catalog has no product photography yet
// (see src/lib/products.ts TODOs), so these lean on the hand-rolled SVG set
// instead of referencing images that don't exist in /public.
const CATEGORY_TILES = [
  { Icon: MasalaPowderTileIcon, href: "/shop/Masala%20Powders", label: "Masala Powders", note: "chilli · turmeric · coriander" },
  { Icon: SpiceBlendTileIcon, href: "/shop/Spice%20Blends", label: "Spice Blends", note: "sambar · kitchen king · garam masala" },
  { Icon: WholeSpiceTileIcon, href: "/shop/Whole%20Spices", label: "Whole Spices", note: "coming soon" },
  { Icon: InstantMixTileIcon, href: "/shop/Instant%20Mixes", label: "Instant Mixes", note: "pani puri · rava idli" },
];

const PILLARS = [
  {
    Icon: FreshIngredientsIcon,
    title: "Freshly milled",
    text: "Ground in small batches close to order time, not stocked for months in a warehouse.",
  },
  {
    Icon: AuthenticTasteIcon,
    title: "Authentic taste",
    text: "The same recipes and sourcing that built 20,000+ repeat customers over WhatsApp.",
  },
  {
    Icon: HygienicPrepIcon,
    title: "Hygienic preparation",
    text: "Clean, FSSAI-standard milling and packing on every batch, retail or bulk.",
  },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_80%_-10%,rgba(107,122,58,0.18),transparent),radial-gradient(45rem_25rem_at_10%_110%,rgba(122,46,46,0.14),transparent)]"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pb-14 pt-8 sm:py-20 md:grid-cols-2">
          <div>
            <span className="chip mb-4 border-turmericgold/40 bg-turmericgold/10 text-paprika">
              🌶️ Authentic & Tasty, Straight From the Mill
            </span>
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-cumin sm:text-5xl">
              Real masala powders,{" "}
              <span className="text-terracotta">ordered in one tap.</span>
            </h1>
            <p className="mt-4 max-w-lg text-lg text-soft">
              30+ authentic spice blends and masala powders from Ruchima Masala,
              Bangalore — trusted by 20,000+ customers. Retail packs, bulk
              wholesale, and white-label manufacturing, pan-India.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/shop" className="btn btn-terracotta">
                Shop now
              </Link>
              <Link href="/bulk-order" className="btn btn-turmeric">
                Bulk / wholesale pricing
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-soft">
              <span className="inline-flex items-center gap-1.5">
                <BulkOrderIcon className="h-4 w-4 text-terracotta" /> Bulk orders up to 10,000 kg/day
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPinIcon className="h-4 w-4 text-terracotta" /> Andrahalli, Bangalore
              </span>
            </div>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-sm">
            <div
              aria-hidden
              className="absolute inset-8 rounded-full bg-gradient-to-b from-turmericgold/60 to-terracotta/40 blur-2xl"
            />
            <div className="absolute inset-0 overflow-hidden rounded-full shadow-lift ring-4 ring-turmericgold/20">
              <Image
                src="/images/hero/hero-image.png"
                alt="Fresh ground spices and masala powders"
                fill
                priority
                sizes="(max-width: 640px) 320px, 384px"
                className="object-cover"
              />
            </div>
            <span className="absolute bottom-6 left-0 -rotate-3 rounded-lg bg-paper px-3 py-1.5 text-xs font-semibold shadow-card">
              Uniform wholesale pricing · ~₹259/kg
            </span>
            <span className="absolute right-0 top-4 rotate-2 rounded-lg bg-paper px-3 py-1.5 text-xs font-semibold shadow-card">
              30+ SKUs in stock
            </span>
          </div>
        </div>
      </section>

      {/* Category tiles */}
      <section className="border-y border-line/60 bg-cardamomdark/40">
        <div className="mx-auto grid max-w-6xl gap-3 px-4 py-10 sm:grid-cols-4">
          {CATEGORY_TILES.map((tile) => (
            <Link
              key={tile.label}
              href={tile.href}
              className="card flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-card"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-terracotta/10 text-terracotta" aria-hidden>
                <tile.Icon className="h-7 w-7" />
              </span>
              <span>
                <span className="block font-semibold text-cumin">{tile.label}</span>
                <span className="block text-xs text-soft">{tile.note}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <h2 className="section-title text-center">
          Made for the mill, <span className="text-terracotta">served for the table</span>
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.title} className="card p-6 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-turmericgold/20 text-paprika" aria-hidden>
                <p.Icon className="h-7 w-7" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-soft">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bulk / white-label banner (replaces rakus-kitchen's catering banner —
          Ruchima has no catering; the equivalent high-value lead flow here is
          B2B bulk and private-label manufacturing). */}
      <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="card overflow-hidden bg-gradient-to-br from-paprika to-terracotta p-1">
          <div className="flex flex-col items-start justify-between gap-5 px-6 py-8 sm:flex-row sm:items-center sm:px-8">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl font-bold text-cardamom sm:text-3xl">
                Run a hotel, kitchen, or store? Buy direct.
              </h2>
              <p className="mt-2 text-cardamom/85">
                Wholesale pricing for hotels, caterers, supermarkets and
                resellers — plus white-label manufacturing under your own
                brand. Pan-India delivery, Dubai dealer shipments on request.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
              <Link href="/bulk-order" className="btn btn-turmeric">
                Get bulk pricing
              </Link>
              <Link href="/white-label" className="btn btn-transparent border border-cardamom/40 text-cardamom hover:bg-cardamom/10">
                White label program
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Direct order strip */}
      <section className="border-t border-line/60 bg-cardamomdark/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-center">
          <p className="text-sm font-semibold text-soft">Prefer to just message us?</p>
          <a
            href={waMeLink("Hi Ruchima Masala! I'd like to place an order. 🌶️")}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-terracotta"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Order on WhatsApp · {BUSINESS.phoneDisplay}
          </a>
          <p className="text-xs text-soft">
            Mon–Sat, 9 AM – 7 PM · Pan-India delivery · Bulk orders up to 10,000 kg/day
          </p>
        </div>
      </section>
    </div>
  );
}
