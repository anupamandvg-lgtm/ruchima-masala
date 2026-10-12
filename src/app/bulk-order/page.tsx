"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BUSINESS } from "@/lib/config";
import { PRODUCTS } from "@/lib/products";
import { waLinkForBulkLead } from "@/lib/whatsapp";
import { BulkOrderIcon, WhatsAppIcon } from "@/components/icons";
import type { BulkLead } from "@/types";

type Phase = "form" | "submitting" | "done";

const PRODUCT_NAMES = PRODUCTS.filter((p) => p.isWholesaleEligible).map((p) => p.name);

export default function BulkOrderPage() {
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
      const res = await fetch("/api/leads/bulk", {
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
          notes: notes.trim() || undefined,
          internationalInquiry: international,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Could not submit your enquiry. Please try again.");
      }
      setWaHref(waLinkForBulkLead(data.lead as BulkLead));
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
          Thanks for reaching out to {BUSINESS.name}. Our wholesale team will get back to you with a
          quote shortly. Send us a WhatsApp message now so it reaches us instantly.
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
        <BulkOrderIcon className="h-7 w-7 text-terracotta" />
        <div>
          <h1 className="section-title">Bulk / Wholesale Enquiry</h1>
          <p className="text-sm text-soft">
            For hotels, caterers, supermarkets, and resellers. Bulk orders up to 10,000 kg/day,
            uniform wholesale pricing, pan-India delivery.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <fieldset className="card p-5">
          <legend className="mb-3 text-sm font-semibold text-cumin">Business details</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="businessName" className="mb-1.5 block text-sm font-semibold">Business name</label>
              <input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="field" required />
            </div>
            <div>
              <label htmlFor="contactName" className="mb-1.5 block text-sm font-semibold">Contact person</label>
              <input id="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} className="field" required />
            </div>
            <div>
              <label htmlFor="bphone" className="mb-1.5 block text-sm font-semibold">Mobile number</label>
              <input
                id="bphone"
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
              <label htmlFor="bemail" className="mb-1.5 block text-sm font-semibold">
                Email <span className="text-xs font-normal text-soft">(optional)</span>
              </label>
              <input id="bemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="bgstin" className="mb-1.5 block text-sm font-semibold">
                GSTIN <span className="text-xs font-normal text-soft">(optional)</span>
              </label>
              <input
                id="bgstin"
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
          <legend className="mb-3 text-sm font-semibold text-cumin">What are you looking to order?</legend>
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
            <label htmlFor="qty" className="mb-1.5 block text-sm font-semibold">Estimated quantity (kg/month)</label>
            <input
              id="qty"
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
          <legend className="mb-3 text-sm font-semibold text-cumin">Delivery location</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="city" className="mb-1.5 block text-sm font-semibold">City</label>
              <input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="field" required />
            </div>
            <div>
              <label htmlFor="state" className="mb-1.5 block text-sm font-semibold">State</label>
              <input id="state" value={state} onChange={(e) => setState(e.target.value)} className="field" required />
            </div>
            <div>
              <label htmlFor="pincode" className="mb-1.5 block text-sm font-semibold">Pincode</label>
              <input id="pincode" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))} className="field" required />
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
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="field min-h-[80px]"
            placeholder="Delivery frequency, packaging preference, etc."
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
          {phase === "submitting" ? "Submitting…" : "Request a wholesale quote"}
        </button>
        <p className="text-center text-xs text-soft">
          Prefer to talk directly? Call or WhatsApp us at {BUSINESS.phoneDisplay}.
        </p>
      </form>
    </div>
  );
}
