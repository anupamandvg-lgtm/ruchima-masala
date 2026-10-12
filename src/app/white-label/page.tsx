"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BUSINESS } from "@/lib/config";
import { PRODUCTS } from "@/lib/products";
import { waLinkForWhiteLabelLead } from "@/lib/whatsapp";
import { WhiteLabelIcon, WhatsAppIcon } from "@/components/icons";
import type { WhiteLabelLead } from "@/types";

type Phase = "form" | "submitting" | "done";

const PRODUCT_NAMES = PRODUCTS.filter((p) => p.isWholesaleEligible).map((p) => p.name);

export default function WhiteLabelPage() {
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [waHref, setWaHref] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [qty, setQty] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [brandNameIdea, setBrandNameIdea] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [needsPackagingDesign, setNeedsPackagingDesign] = useState(false);
  const [notes, setNotes] = useState("");
  const [international, setInternational] = useState(false);

  const toggleProduct = (name: string) => {
    setSelectedProducts((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name],
    );
  };

  const canSubmit = useMemo(
    () =>
      businessName.trim() && contactName.trim() && phone.trim().length >= 10
      && selectedProducts.length > 0 && Number(qty) > 0
      && city.trim() && state.trim() && pincode.trim(),
    [businessName, contactName, phone, selectedProducts, qty, city, state, pincode],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || phase === "submitting") return;
    setError(null);
    setPhase("submitting");

    try {
      const res = await fetch("/api/leads/white-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          contactName: contactName.trim(),
          phone: `+91 ${phone.replace(/[^\d]/g, "")}`,
          email: email.trim() || undefined,
          gstin: gstin.trim() || undefined,
          productsInterested: selectedProducts,
          estimatedQtyKgPerMonth: Number(qty),
          deliveryLocation: { city: city.trim(), state: state.trim(), pincode: pincode.trim() },
          brandNameIdea: brandNameIdea.trim() || undefined,
          targetMarket: targetMarket.trim() || undefined,
          needsPackagingDesign,
          notes: notes.trim() || undefined,
          internationalInquiry: international,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Could not submit your enquiry. Please try again.");
      }
      setWaHref(waLinkForWhiteLabelLead(data.lead as WhiteLabelLead));
      setPhase("done");
    } catch (err) {
      setError((err as Error).message);
      setPhase("form");
    }
  };

  if (phase === "done") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-turmericgold/20 text-4xl" aria-hidden>
          ✅
        </span>
        <h1 className="section-title mt-4">Enquiry received!</h1>
        <p className="mt-2 text-sm text-soft">
          Thanks for your interest in the {BUSINESS.name} white-label program. Our team will reach
          out to discuss branding, packaging, and pricing. Send us a WhatsApp message now so it
          reaches us instantly.
        </p>
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-terracotta mt-6 w-full py-4 text-base"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Send enquiry on WhatsApp
          </a>
        )}
        <Link href="/shop" className="btn btn-ghost mt-3 w-full">Browse the shop</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <div className="mb-6 flex items-center gap-2">
        <WhiteLabelIcon className="h-7 w-7 text-terracotta" />
        <div>
          <h1 className="section-title">White-Label Program</h1>
          <p className="text-sm text-soft">
            Launch your own masala brand on our manufacturing — we handle grinding, blending, and
            packaging under your label.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <fieldset className="card p-5">
          <legend className="mb-3 text-sm font-semibold text-cumin">Business details</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="wbusinessName" className="mb-1.5 block text-sm font-semibold">Business name</label>
              <input id="wbusinessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="field" required />
            </div>
            <div>
              <label htmlFor="wcontactName" className="mb-1.5 block text-sm font-semibold">Contact person</label>
              <input id="wcontactName" value={contactName} onChange={(e) => setContactName(e.target.value)} className="field" required />
            </div>
            <div>
              <label htmlFor="wphone" className="mb-1.5 block text-sm font-semibold">Mobile number</label>
              <input
                id="wphone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
                className="field"
                placeholder="10-digit mobile"
                required
              />
            </div>
            <div>
              <label htmlFor="wemail" className="mb-1.5 block text-sm font-semibold">
                Email <span className="text-xs font-normal text-soft">(optional)</span>
              </label>
              <input id="wemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="wgstin" className="mb-1.5 block text-sm font-semibold">
                GSTIN <span className="text-xs font-normal text-soft">(optional)</span>
              </label>
              <input
                id="wgstin"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase().slice(0, 15))}
                className="field"
                placeholder="e.g. 29ABCDE1234F1Z5"
                maxLength={15}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="card p-5">
          <legend className="mb-3 text-sm font-semibold text-cumin">Which masalas do you want to white-label?</legend>
          <div className="flex flex-wrap gap-2">
            {PRODUCT_NAMES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => toggleProduct(n)}
                className={`chip ${selectedProducts.includes(n) ? "chip-active" : ""}`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <label htmlFor="wqty" className="mb-1.5 block text-sm font-semibold">Estimated quantity (kg/month)</label>
            <input
              id="wqty"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="field max-w-xs"
              placeholder="e.g. 500"
              required
            />
          </div>
        </fieldset>

        <fieldset className="card p-5">
          <legend className="mb-3 text-sm font-semibold text-cumin">Your brand</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="brandNameIdea" className="mb-1.5 block text-sm font-semibold">
                Brand name idea <span className="text-xs font-normal text-soft">(optional)</span>
              </label>
              <input id="brandNameIdea" value={brandNameIdea} onChange={(e) => setBrandNameIdea(e.target.value)} className="field" />
            </div>
            <div>
              <label htmlFor="targetMarket" className="mb-1.5 block text-sm font-semibold">
                Target market <span className="text-xs font-normal text-soft">(optional)</span>
              </label>
              <input id="targetMarket" value={targetMarket} onChange={(e) => setTargetMarket(e.target.value)} className="field" placeholder="e.g. Local retail, export, online" />
            </div>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-soft">
            <input
              type="checkbox"
              checked={needsPackagingDesign}
              onChange={(e) => setNeedsPackagingDesign(e.target.checked)}
              className="h-4 w-4 rounded border-line text-terracotta focus:ring-terracotta"
            />
            I need help with packaging design
          </label>
        </fieldset>

        <fieldset className="card p-5">
          <legend className="mb-3 text-sm font-semibold text-cumin">Delivery location</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="wcity" className="mb-1.5 block text-sm font-semibold">City</label>
              <input id="wcity" value={city} onChange={(e) => setCity(e.target.value)} className="field" required />
            </div>
            <div>
              <label htmlFor="wstate" className="mb-1.5 block text-sm font-semibold">State</label>
              <input id="wstate" value={state} onChange={(e) => setState(e.target.value)} className="field" required />
            </div>
            <div>
              <label htmlFor="wpincode" className="mb-1.5 block text-sm font-semibold">Pincode</label>
              <input id="wpincode" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))} className="field" required />
            </div>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-soft">
            <input
              type="checkbox"
              checked={international}
              onChange={(e) => setInternational(e.target.checked)}
              className="h-4 w-4 rounded border-line text-terracotta focus:ring-terracotta"
            />
            This is an international enquiry (e.g. Dubai)
          </label>
        </fieldset>

        <fieldset className="card p-5">
          <legend className="mb-1.5 text-sm font-semibold text-cumin">Anything else we should know?</legend>
          <textarea
            id="wnotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="field min-h-[80px]"
            placeholder="Timeline, launch plans, etc."
          />
        </fieldset>

        {error && (
          <div className="rounded-xl border border-terracotta/30 bg-terracotta/5 px-4 py-3 text-sm font-medium text-terracotta" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || phase === "submitting"}
          className="btn btn-terracotta w-full py-4 text-base disabled:opacity-50"
        >
          {phase === "submitting" ? "Submitting…" : "Enquire about white-label"}
        </button>
        <p className="text-center text-xs text-soft">
          Prefer to talk directly? Call or WhatsApp us at {BUSINESS.phoneDisplay}.
        </p>
      </form>
    </div>
  );
}
