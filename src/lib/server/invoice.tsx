import "server-only";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { Document, Page, StyleSheet, Text, View, type DocumentProps } from "@react-pdf/renderer";
import { adminStorage } from "./firebaseAdmin";
import { BUSINESS } from "@/lib/config";
import type { Order } from "@/types";

/**
 * ── GST TAX INVOICE GENERATION ───────────────────────────────────────────
 * No rakus-kitchen precedent — this module is new for Ruchima. Generates a
 * GST-compliant tax invoice PDF for a paid order, uploads it to Firebase
 * Storage, and returns a public download URL to be written onto the order
 * doc as `invoiceUrl`.
 *
 * TAX CONVENTION: mirrors productPricing.ts — `pricePerUnit`/`lineTotal` on
 * each order line are GST-INCLUSIVE. The invoice shows the backed-out
 * taxable value and tax split per line, matching the order's own
 * `gstBreakdown` (CGST+SGST for Karnataka buyers, IGST otherwise).
 *
 * TODO(business/accountant): confirm whether B2C and B2B (GSTIN present)
 * orders need visually distinct invoice formats — see the plan's open
 * questions. This single format currently serves both, showing the buyer's
 * GSTIN when present and omitting the line when absent.
 */

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#241711" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  businessName: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  muted: { color: "#7A6A58", fontSize: 8 },
  invoiceTitle: { fontSize: 14, fontWeight: 700, textAlign: "right" },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 9, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", color: "#7A6A58" },
  table: { borderTopWidth: 1, borderTopColor: "#DECBAE", marginTop: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#DECBAE", paddingVertical: 5 },
  trHead: { backgroundColor: "#F2E7D5", fontWeight: 700 },
  cName: { flex: 3 },
  cHsn: { flex: 1.2, textAlign: "center" },
  cQty: { flex: 0.8, textAlign: "center" },
  cRate: { flex: 1.2, textAlign: "right" },
  cTaxable: { flex: 1.3, textAlign: "right" },
  cGstPct: { flex: 0.8, textAlign: "center" },
  cGstAmt: { flex: 1.2, textAlign: "right" },
  cTotal: { flex: 1.3, textAlign: "right" },
  totalsBlock: { marginTop: 10, alignSelf: "flex-end", width: 220 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: "#241711", fontWeight: 700, fontSize: 11 },
  footer: { marginTop: 24, fontSize: 7.5, color: "#7A6A58", lineHeight: 1.4 },
});

function money(amount: number): string {
  return `Rs. ${amount.toFixed(2)}`;
}

/** Backs the GST-inclusive tax out of a tax-inclusive line total (same convention as productPricing.ts). */
function taxableValue(lineTotal: number, gstRatePercent: number): number {
  return (lineTotal * 100) / (100 + gstRatePercent);
}

function InvoiceDocument({ order }: { order: Order }) {
  const isIntraState = order.gstBreakdown.igst === 0;
  const invoiceDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.businessName}>{BUSINESS.name}</Text>
            <Text style={styles.muted}>{BUSINESS.warehouseAddress}</Text>
            {BUSINESS.gstin ? <Text style={styles.muted}>GSTIN: {BUSINESS.gstin}</Text> : null}
            {BUSINESS.fssaiLicenseNo ? <Text style={styles.muted}>FSSAI: {BUSINESS.fssaiLicenseNo}</Text> : null}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>TAX INVOICE</Text>
            <Text style={[styles.muted, { textAlign: "right", marginTop: 4 }]}>Invoice No: {order.orderId}</Text>
            <Text style={[styles.muted, { textAlign: "right" }]}>Date: {invoiceDate}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Billed / Shipped To</Text>
          <Text>{order.customerName}</Text>
          <Text style={styles.muted}>{order.phone}</Text>
          <Text style={styles.muted}>{order.deliveryAddress}</Text>
          {order.gstin ? <Text style={styles.muted}>Buyer GSTIN: {order.gstin}</Text> : null}
          <Text style={styles.muted}>
            Place of supply: {order.addressComponents?.state || "—"} ({isIntraState ? "Intra-state — CGST+SGST" : "Inter-state — IGST"})
          </Text>
        </View>

        <View style={styles.table}>
          <View style={[styles.tr, styles.trHead]}>
            <Text style={styles.cName}>Item</Text>
            <Text style={styles.cHsn}>HSN</Text>
            <Text style={styles.cQty}>Qty</Text>
            <Text style={styles.cRate}>Rate</Text>
            <Text style={styles.cTaxable}>Taxable Val.</Text>
            <Text style={styles.cGstPct}>GST %</Text>
            <Text style={styles.cGstAmt}>GST Amt</Text>
            <Text style={styles.cTotal}>Total</Text>
          </View>
          {order.items.map((it) => {
            const taxable = taxableValue(it.lineTotal, it.gstRatePercent);
            const gstAmt = it.lineTotal - taxable;
            return (
              <View style={styles.tr} key={`${it.productId}-${it.variantLabel}`}>
                <Text style={styles.cName}>{it.name} ({it.variantLabel})</Text>
                <Text style={styles.cHsn}>{it.hsnCode}</Text>
                <Text style={styles.cQty}>{it.qty}</Text>
                <Text style={styles.cRate}>{money(it.pricePerUnit)}</Text>
                <Text style={styles.cTaxable}>{money(taxable)}</Text>
                <Text style={styles.cGstPct}>{it.gstRatePercent}%</Text>
                <Text style={styles.cGstAmt}>{money(gstAmt)}</Text>
                <Text style={styles.cTotal}>{money(it.lineTotal)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text>Taxable value</Text>
            <Text>{money(order.itemTotal - order.taxTotal)}</Text>
          </View>
          {isIntraState ? (
            <>
              <View style={styles.totalsRow}><Text>CGST</Text><Text>{money(order.gstBreakdown.cgst)}</Text></View>
              <View style={styles.totalsRow}><Text>SGST</Text><Text>{money(order.gstBreakdown.sgst)}</Text></View>
            </>
          ) : (
            <View style={styles.totalsRow}><Text>IGST</Text><Text>{money(order.gstBreakdown.igst)}</Text></View>
          )}
          <View style={styles.totalsRow}>
            <Text>Shipping</Text>
            <Text>{money(order.shippingFee)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text>Grand Total</Text>
            <Text>{money(order.grandTotal)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          This is a computer-generated invoice. Tax amounts are reverse-calculated from GST-inclusive
          selling prices. For queries, contact {BUSINESS.name} at {BUSINESS.phoneDisplay} or write to{" "}
          {BUSINESS.grievanceOfficer.email}.
        </Text>
      </Page>
    </Document>
  );
}

/**
 * Renders the invoice PDF for `order` and uploads it to Firebase Storage at
 * `invoices/{orderId}.pdf`, returning a long-lived public download URL. Safe
 * to call more than once for the same order (e.g. a retry) — it simply
 * overwrites the same storage path and re-issues a token.
 */
export async function generateInvoicePdf(order: Order): Promise<string> {
  // @react-pdf/renderer's renderToBuffer types its argument as
  // ReactElement<DocumentProps> — a wrapped function component element
  // doesn't structurally match that even though it renders a <Document> at
  // runtime (the library only ever reads the element tree, not the type).
  const element = <InvoiceDocument order={order} /> as unknown as React.ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);

  const bucket = adminStorage().bucket();
  const file = bucket.file(`invoices/${order.orderId}.pdf`);
  const token = crypto.randomUUID();

  await file.save(buffer, {
    contentType: "application/pdf",
    metadata: {
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  const encodedPath = encodeURIComponent(file.name);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
}
