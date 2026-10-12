"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminGate } from "@/components/AdminGate";
import { useAuth } from "@/lib/auth-context";
import {
  subscribeBulkLeads, subscribeWhiteLabelLeads,
  updateLeadStatus, setLeadQuotedPrice, setLeadNotes,
  type LeadCollection,
} from "@/lib/db";
import { waLinkForBulkLead, waLinkForWhiteLabelLead } from "@/lib/whatsapp";
import { formatINR } from "@/lib/format";
import { LEAD_STATUSES } from "@/types";
import type { BulkLead, LeadStatus, WhiteLabelLead } from "@/types";

type LeadTab = "bulk" | "whiteLabel";

const STATUS_COLORS: Record<LeadStatus, string> = {
  New: "bg-line/40 text-soft border-line",
  Contacted: "bg-turmericgold/15 text-turmericdark border-turmericgold/30",
  Quoted: "bg-ok/15 text-ok border-ok/30",
  Won: "bg-cumin/10 text-cumin border-cumin/20",
  Lost: "bg-terracotta/10 text-terracotta border-terracotta/30",
};

export default function LeadsPage() {
  return (
    <AdminGate>
      <LeadsContent />
    </AdminGate>
  );
}

function LeadsContent() {
  const [tab, setTab] = useState<LeadTab>("bulk");
  const [bulkLeads, setBulkLeads] = useState<BulkLead[] | null>(null);
  const [whiteLabelLeads, setWhiteLabelLeads] = useState<WhiteLabelLead[] | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [whiteLabelError, setWhiteLabelError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LeadStatus | "all">("all");

  useEffect(() => {
    const unsub = subscribeBulkLeads(
      (data) => { setBulkError(null); setBulkLeads(data); },
      (message) => setBulkError(message),
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeWhiteLabelLeads(
      (data) => { setWhiteLabelError(null); setWhiteLabelLeads(data); },
      (message) => setWhiteLabelError(message),
    );
    return unsub;
  }, []);

  const leads: (BulkLead | WhiteLabelLead)[] | null = tab === "bulk" ? bulkLeads : whiteLabelLeads;
  const leadCollection: LeadCollection = tab === "bulk" ? "bulkLeads" : "whiteLabelLeads";
  const error = tab === "bulk" ? bulkError : whiteLabelError;

  const counts = (leads ?? []).reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {});

  const visible = (leads ?? [])
    .filter((l) => filter === "all" || l.status === filter)
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-12">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="section-title">B2B leads</h1>
          <p className="text-sm text-soft">Bulk-wholesale and white-label enquiries, in one pipeline.</p>
        </div>
        <Link href="/admin" className="btn btn-ghost px-4 py-2 text-xs">
          ← Back to orders
        </Link>
      </header>

      {/* Bulk vs White Label tabs */}
      <div role="tablist" aria-label="Lead type" className="mb-4 flex gap-2">
        {([
          { key: "bulk" as const, label: "Bulk / wholesale", count: bulkLeads?.length ?? 0 },
          { key: "whiteLabel" as const, label: "White label", count: whiteLabelLeads?.length ?? 0 },
        ]).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => { setTab(t.key); setFilter("all"); }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              tab === t.key
                ? "border-terracotta bg-terracotta text-cardamom"
                : "border-line bg-paper text-cumin hover:border-soft"
            }`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${tab === t.key ? "bg-cardamom/20" : "bg-cardamom"}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-terracotta/30 bg-terracotta/5 px-4 py-3 text-sm text-terracotta">
          Failed to load leads: {error}
        </div>
      )}

      {/* Pipeline status filter */}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {(["all", ...LEAD_STATUSES] as const).map((s) => {
          const selected = filter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                selected ? "border-terracotta bg-terracotta text-cardamom" : "border-line bg-paper text-cumin hover:border-soft"
              }`}
            >
              {s === "all" ? "All" : s}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${selected ? "bg-cardamom/20" : "bg-cardamom"}`}>
                {s === "all" ? (leads?.length ?? 0) : (counts[s] ?? 0)}
              </span>
            </button>
          );
        })}
      </div>

      {leads === null && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-32 animate-pulse bg-cardamom/60 p-5" />
          ))}
        </div>
      )}

      {leads !== null && leads.length === 0 && (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <span className="text-4xl" aria-hidden>📋</span>
          <p className="font-semibold">No {tab === "bulk" ? "bulk" : "white-label"} enquiries yet</p>
          <p className="text-sm text-soft">New submissions from the form will appear here instantly.</p>
        </div>
      )}

      {leads !== null && leads.length > 0 && visible.length === 0 && (
        <div className="card p-8 text-center text-sm text-soft">No leads match this filter.</div>
      )}

      <div className="space-y-4">
        {visible.map((lead) => (
          <LeadCard key={lead.id} lead={lead} leadCollection={leadCollection} />
        ))}
      </div>
    </div>
  );
}

function LeadCard({ lead, leadCollection }: { lead: BulkLead | WhiteLabelLead; leadCollection: LeadCollection }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [quoteDraft, setQuoteDraft] = useState(lead.quotedPrice !== undefined ? String(lead.quotedPrice) : "");
  const [notesDraft, setNotesDraft] = useState(lead.notes ?? "");
  const isWhiteLabel = leadCollection === "whiteLabelLeads";
  const waLink = isWhiteLabel
    ? waLinkForWhiteLabelLead(lead as WhiteLabelLead)
    : waLinkForBulkLead(lead as BulkLead);

  const time = new Date(lead.createdAt).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });

  const changeStatus = async (status: LeadStatus) => {
    if (status === lead.status) return;
    setBusy(true);
    try {
      await updateLeadStatus(leadCollection, lead.id, status, user?.email ?? undefined);
    } catch (err) {
      alert(`Couldn't update lead status: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const commitQuote = async () => {
    const parsed = quoteDraft.trim() === "" ? undefined : Number.parseFloat(quoteDraft);
    if (parsed !== undefined && (Number.isNaN(parsed) || parsed < 0)) {
      alert("Quoted price must be a positive number.");
      return;
    }
    setBusy(true);
    try {
      await setLeadQuotedPrice(leadCollection, lead.id, parsed);
    } catch (err) {
      alert(`Couldn't save quoted price: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const commitNotes = async () => {
    if (notesDraft === (lead.notes ?? "")) return;
    setBusy(true);
    try {
      await setLeadNotes(leadCollection, lead.id, notesDraft);
    } catch (err) {
      alert(`Couldn't save notes: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`card overflow-hidden ${lead.internationalInquiry ? "border-2 border-turmericgold" : ""}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-cardamom/40 px-4 py-3 sm:px-5">
        <div>
          <p className="font-display font-bold">{lead.businessName}</p>
          <p className="text-xs text-soft">{time}</p>
        </div>
        <div className="flex items-center gap-2">
          {lead.internationalInquiry && (
            <span className="chip border border-turmericgold/50 bg-turmericgold/10 text-turmericdark">
              🌍 Dubai / international
            </span>
          )}
          <span className={`chip border ${STATUS_COLORS[lead.status]}`}>{lead.status}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:px-5 md:grid-cols-[1fr_auto]">
        <div className="min-w-0 space-y-2 text-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-semibold">{lead.contactName}</span>
            <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} className="text-paprika hover:underline">
              {lead.phone}
            </a>
            {lead.email && <span className="text-soft">{lead.email}</span>}
          </div>
          {lead.gstin && <p className="text-soft">GSTIN: <span className="text-cumin">{lead.gstin}</span></p>}

          <div className="rounded-xl border border-line bg-paper p-3 text-xs space-y-1">
            <p><span className="font-semibold text-cumin">Products:</span> {lead.productsInterested.join(", ")}</p>
            <p><span className="font-semibold text-cumin">Est. qty:</span> {lead.estimatedQtyKgPerMonth} kg/month</p>
            <p>
              <span className="font-semibold text-cumin">Location:</span>{" "}
              {lead.deliveryLocation.city}, {lead.deliveryLocation.state} {lead.deliveryLocation.pincode}
            </p>
            {isWhiteLabel && (
              <>
                {(lead as WhiteLabelLead).brandNameIdea && (
                  <p><span className="font-semibold text-cumin">Brand idea:</span> {(lead as WhiteLabelLead).brandNameIdea}</p>
                )}
                {(lead as WhiteLabelLead).targetMarket && (
                  <p><span className="font-semibold text-cumin">Target market:</span> {(lead as WhiteLabelLead).targetMarket}</p>
                )}
                {(lead as WhiteLabelLead).needsPackagingDesign && (
                  <p className="font-semibold text-turmericdark">📦 Needs packaging design support</p>
                )}
              </>
            )}
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-soft" htmlFor={`notes-${lead.id}`}>
              Notes
            </label>
            <textarea
              id={`notes-${lead.id}`}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={commitNotes}
              disabled={busy}
              rows={2}
              placeholder="Internal notes about this lead…"
              className="field mt-1 text-xs"
            />
          </div>

          {lead.statusHistory.length > 1 && (
            <p className="text-[11px] text-soft">
              Flow: {lead.statusHistory.map((h) => h.status).join(" → ")}
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2 md:w-52 md:items-stretch">
          <label className="text-xs font-bold uppercase tracking-wider text-soft" htmlFor={`status-${lead.id}`}>
            Pipeline status
          </label>
          <select
            id={`status-${lead.id}`}
            value={lead.status}
            disabled={busy}
            onChange={(e) => changeStatus(e.target.value as LeadStatus)}
            className="field py-2.5 text-sm font-semibold"
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <label className="mt-1 text-xs font-bold uppercase tracking-wider text-soft" htmlFor={`quote-${lead.id}`}>
            Quoted price (₹/kg)
          </label>
          <input
            id={`quote-${lead.id}`}
            type="number"
            min="0"
            step="1"
            value={quoteDraft}
            onChange={(e) => setQuoteDraft(e.target.value)}
            onBlur={commitQuote}
            disabled={busy}
            placeholder="Not quoted"
            className="field py-2 text-sm tabular-nums"
          />
          {lead.quotedPrice !== undefined && (
            <p className="text-[11px] text-soft">Current quote: {formatINR(lead.quotedPrice)}/kg</p>
          )}

          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-terracotta mt-1 py-2 text-xs"
          >
            Message on WhatsApp
          </a>
        </div>
      </div>
    </article>
  );
}
