"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminGate } from "@/components/AdminGate";
import {
  subscribeProductPricing, subscribeProductInventory,
  setVariantPricing, setVariantInventory, batchSetInventory,
  type ProductPricingWithId, type ProductInventoryWithId,
} from "@/lib/db";
import { PRODUCTS } from "@/lib/products";
import { formatINR } from "@/lib/format";

export default function InventoryPage() {
  return (
    <AdminGate>
      <InventoryContent />
    </AdminGate>
  );
}

/** One row per product variant — e.g. Korean Peri Peri Masala contributes two rows (250g, 500g). */
interface Row {
  productId: string;
  productName: string;
  category: string;
  variantLabel: string;
  weightGrams: number;
  sellingPrice: number | null;
  originalPrice: number | null;
  stockQty: number;
  lowStockThreshold: number;
  available: boolean;
}

function InventoryContent() {
  const [pricing, setPricing] = useState<ProductPricingWithId[] | null>(null);
  const [inventory, setInventory] = useState<ProductInventoryWithId[] | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  // Local text-field drafts for price/stock inputs so typing doesn't fight the
  // live Firestore value re-rendering mid-keystroke. Keyed by `${productId}:${variantLabel}:${field}`.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsub = subscribeProductPricing(
      (data) => { setPricingError(null); setPricing(data); },
      (message) => setPricingError(message),
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeProductInventory(
      (data) => { setInventoryError(null); setInventory(data); },
      (message) => setInventoryError(message),
    );
    return unsub;
  }, []);

  const loading = pricing === null || inventory === null;

  // Join the stable catalog (products.ts) with live Firestore pricing/stock —
  // every catalog variant gets a row even before any admin edit has happened.
  const rows: Row[] = loading ? [] : PRODUCTS.flatMap((product) => {
    const priceDoc = pricing!.find((p) => p.productId === product.id);
    const invDoc = inventory!.find((i) => i.productId === product.id);
    return product.variants.map((variant) => {
      const priceEntry = priceDoc?.variants[variant.label];
      const invEntry = invDoc?.variants[variant.label];
      return {
        productId: product.id,
        productName: product.name,
        category: product.category,
        variantLabel: variant.label,
        weightGrams: variant.weightGrams,
        sellingPrice: priceEntry?.sellingPrice ?? null,
        originalPrice: priceEntry?.originalPrice ?? null,
        stockQty: invEntry?.stockQty ?? 0,
        lowStockThreshold: invEntry?.lowStockThreshold ?? 10,
        available: invEntry?.available ?? false,
      };
    });
  });

  const draftKey = (productId: string, variantLabel: string, field: string) =>
    `${productId}:${variantLabel}:${field}`;

  const rowKey = (productId: string, variantLabel: string) => `${productId}:${variantLabel}`;

  const commitPrice = async (row: Row, field: "sellingPrice" | "originalPrice") => {
    const key = draftKey(row.productId, row.variantLabel, field);
    const raw = drafts[key];
    if (raw === undefined) return;
    const parsed = raw.trim() === "" ? undefined : Number.parseFloat(raw);
    if (parsed !== undefined && (Number.isNaN(parsed) || parsed < 0)) {
      alert("Price must be a positive number.");
      return;
    }
    const rk = rowKey(row.productId, row.variantLabel);
    setBusy((prev) => ({ ...prev, [rk]: true }));
    try {
      await setVariantPricing(row.productId, row.variantLabel, {
        sellingPrice: field === "sellingPrice" ? (parsed ?? 0) : row.sellingPrice ?? 0,
        originalPrice: field === "originalPrice" ? parsed : row.originalPrice ?? undefined,
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (err) {
      alert(`Failed to update price: ${(err as Error).message}`);
    } finally {
      setBusy((prev) => ({ ...prev, [rk]: false }));
    }
  };

  const commitStockField = async (
    row: Row,
    field: "stockQty" | "lowStockThreshold",
    value: number,
  ) => {
    if (!Number.isInteger(value) || value < 0) return;
    const rk = rowKey(row.productId, row.variantLabel);
    setBusy((prev) => ({ ...prev, [rk]: true }));
    try {
      await setVariantInventory(row.productId, row.variantLabel, {
        stockQty: field === "stockQty" ? value : row.stockQty,
        lowStockThreshold: field === "lowStockThreshold" ? value : row.lowStockThreshold,
        available: row.available,
      });
    } catch (err) {
      alert(`Failed to update stock: ${(err as Error).message}`);
    } finally {
      setBusy((prev) => ({ ...prev, [rk]: false }));
    }
  };

  const toggleAvailable = async (row: Row) => {
    const rk = rowKey(row.productId, row.variantLabel);
    setBusy((prev) => ({ ...prev, [rk]: true }));
    try {
      await setVariantInventory(row.productId, row.variantLabel, {
        stockQty: row.stockQty,
        lowStockThreshold: row.lowStockThreshold,
        available: !row.available,
      });
    } catch (err) {
      alert(`Failed to update availability: ${(err as Error).message}`);
    } finally {
      setBusy((prev) => ({ ...prev, [rk]: false }));
    }
  };

  const [restockBusy, setRestockBusy] = useState(false);
  const [restockQty, setRestockQty] = useState("");

  /** Bulk-set every variant's stock to the same qty after a fresh production batch. */
  const handleRestockAll = async () => {
    const qty = Number.parseInt(restockQty, 10);
    if (!Number.isInteger(qty) || qty < 0) {
      alert("Enter a valid non-negative stock quantity first.");
      return;
    }
    if (!confirm(
      `Set stock to ${qty} for ALL ${rows.length} product variants and mark them all available?\n\n` +
      `Use this right after a production batch — it overwrites existing stock numbers.`,
    )) return;

    setRestockBusy(true);
    try {
      await batchSetInventory(
        rows.map((row) => ({
          productId: row.productId,
          variantLabel: row.variantLabel,
          stockQty: qty,
          lowStockThreshold: row.lowStockThreshold,
          available: true,
        })),
      );
    } catch (err) {
      alert(`Batch restock failed: ${(err as Error).message}`);
    } finally {
      setRestockBusy(false);
    }
  };

  // Group rows by category for display, in catalog order.
  const categories = Array.from(new Set(rows.map((r) => r.category)));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="section-title">Inventory &amp; pricing</h1>
          <p className="text-sm text-soft">
            Edit live selling price and stock. Changes apply instantly to the storefront — no deploy needed.
          </p>
        </div>
        <Link href="/admin" className="btn btn-ghost px-4 py-2 text-xs">
          ← Back to orders
        </Link>
      </header>

      {(pricingError || inventoryError) && (
        <div className="mb-4 rounded-xl border border-terracotta/30 bg-terracotta/5 px-4 py-3 text-sm text-terracotta">
          Failed to load {pricingError ? "pricing" : ""}{pricingError && inventoryError ? " and " : ""}
          {inventoryError ? "inventory" : ""}: {pricingError || inventoryError}
        </div>
      )}

      {/* Bulk restock — the common "just finished a production batch" workflow */}
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-cardamom/40 p-3">
        <span className="text-sm font-semibold text-cumin">After a production batch:</span>
        <input
          type="number"
          min="0"
          step="1"
          value={restockQty}
          onChange={(e) => setRestockQty(e.target.value)}
          placeholder="Stock qty"
          className="field w-28 py-1.5 text-sm"
        />
        <button
          onClick={handleRestockAll}
          disabled={restockBusy || loading}
          className="btn btn-terracotta px-4 py-2 text-xs"
        >
          {restockBusy ? "Updating…" : `Set all ${rows.length || ""} variants &amp; mark available`.replace("&amp;", "&")}
        </button>
      </div>

      {loading && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-24 animate-pulse bg-cardamom/60 p-5" />
          ))}
        </div>
      )}

      {!loading && categories.map((category) => (
        <div key={category} className="mb-8">
          <h2 className="section-title mb-3 text-base">{category}</h2>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-line bg-cardamom/40">
                  <th className="px-3 py-2.5 text-left font-semibold">Product</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Variant</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Selling price</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Original price</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Stock qty</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Low-stock at</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Available</th>
                </tr>
              </thead>
              <tbody>
                {rows.filter((r) => r.category === category).map((row) => {
                  const rk = rowKey(row.productId, row.variantLabel);
                  const isBusy = !!busy[rk];
                  const lowStock = row.stockQty <= row.lowStockThreshold;
                  const sellingKey = draftKey(row.productId, row.variantLabel, "sellingPrice");
                  const originalKey = draftKey(row.productId, row.variantLabel, "originalPrice");
                  return (
                    <tr key={rk} className="border-b border-line/60 hover:bg-cardamom/20">
                      <td className="px-3 py-3 font-medium text-cumin">{row.productName}</td>
                      <td className="px-3 py-3 text-soft">{row.variantLabel}</td>
                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={drafts[sellingKey] ?? (row.sellingPrice ?? "")}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [sellingKey]: e.target.value }))}
                          onBlur={() => commitPrice(row, "sellingPrice")}
                          disabled={isBusy}
                          placeholder="Not set"
                          className="field w-24 px-2 py-1 text-right text-sm tabular-nums"
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={drafts[originalKey] ?? (row.originalPrice ?? "")}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [originalKey]: e.target.value }))}
                          onBlur={() => commitPrice(row, "originalPrice")}
                          disabled={isBusy}
                          placeholder="—"
                          className="field w-24 px-2 py-1 text-right text-sm tabular-nums"
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={row.stockQty}
                          key={`${rk}-stock-${row.stockQty}`}
                          onBlur={(e) => {
                            const val = Number.parseInt(e.target.value, 10);
                            if (!Number.isNaN(val) && val !== row.stockQty) commitStockField(row, "stockQty", val);
                          }}
                          disabled={isBusy}
                          className={`field w-20 px-2 py-1 text-right text-sm tabular-nums ${lowStock ? "border-terracotta/50 text-terracotta" : ""}`}
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={row.lowStockThreshold}
                          key={`${rk}-threshold-${row.lowStockThreshold}`}
                          onBlur={(e) => {
                            const val = Number.parseInt(e.target.value, 10);
                            if (!Number.isNaN(val) && val !== row.lowStockThreshold) commitStockField(row, "lowStockThreshold", val);
                          }}
                          disabled={isBusy}
                          className="field w-20 px-2 py-1 text-right text-sm tabular-nums"
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => toggleAvailable(row)}
                          disabled={isBusy}
                          className={`inline-block rounded-full px-3 py-1 text-xs font-bold transition ${
                            row.available ? "bg-ok/15 text-ok hover:bg-ok/25" : "bg-terracotta/10 text-terracotta hover:bg-terracotta/20"
                          }`}
                        >
                          {row.available ? "Available" : "Hidden"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="mt-6 rounded-xl border border-line bg-cardamom/30 p-4 text-sm text-soft">
        <p className="font-semibold text-cumin">How it works:</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li><span className="font-semibold">Selling price:</span> live price charged at checkout. Click away from the field (or press Tab) to save.</li>
          <li><span className="font-semibold">Original price:</span> optional — shown struck-through as a discount marker. Leave blank for none.</li>
          <li><span className="font-semibold">Stock qty:</span> actual physical stock. Decrements automatically on each sale; replenish manually after a production batch.</li>
          <li><span className="font-semibold">Low-stock at:</span> stock level (highlighted in red) that signals it&apos;s time to produce more — purely informational, doesn&apos;t hide the item.</li>
          <li><span className="font-semibold">Available:</span> manual on/off switch — turn off to hide a variant from the storefront regardless of stock count.</li>
        </ul>
      </div>
    </div>
  );
}
