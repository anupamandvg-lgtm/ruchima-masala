/* ── Retail order lifecycle ──────────────────────────────────────────── */

export type OrderStatus =
  | "Placed"
  | "Paid"
  | "Packed"
  | "Shipped"
  | "Delivered"
  | "Cancelled"
  | "Refunded";

export const ORDER_STATUSES: OrderStatus[] = ["Placed", "Paid", "Packed", "Shipped", "Delivered"];

export const ORDER_STATUS_FLOW: Record<OrderStatus, number> = {
  Placed: 0,
  Paid: 1,
  Packed: 2,
  Shipped: 3,
  Delivered: 4,
  Cancelled: -1,
  Refunded: -1,
};

/** How the customer receives their order: courier delivery, or walk-in pickup
 *  from the warehouse (see BUSINESS.warehouseAddress in src/lib/config.ts). */
export type FulfillmentType = "delivery" | "pickup";

/* ── Lead (B2B / white-label) lifecycle ──────────────────────────────── */

export type LeadStatus = "New" | "Contacted" | "Quoted" | "Won" | "Lost";

export const LEAD_STATUSES: LeadStatus[] = ["New", "Contacted", "Quoted", "Won", "Lost"];

export interface LeadStatusEvent {
  status: LeadStatus;
  at: number; // epoch ms
  by?: string;
}

/* ── Products ─────────────────────────────────────────────────────────  */

export type ProductCategory =
  | "Masala Powders"
  | "Spice Blends"
  | "Whole Spices"
  | "Instant Mixes";

/** A pickable weight for a product, e.g. { label: "500g", weightGrams: 500 }. */
export interface ProductVariant {
  label: string; // "250g" | "500g" | "1kg"
  weightGrams: number;
}

/**
 * Catalog identity — stable, code-defined (src/lib/products.ts). Deliberately
 * holds NO price: prices change often, by non-technical staff, and live in
 * Firestore (productPricing/{productId}) instead — see src/lib/server/productPricing.ts.
 */
export interface Product {
  id: string;
  slug: string;
  category: ProductCategory;
  name: string;
  description: string;
  images: string[];
  variants: ProductVariant[];
  /** HSN code for GST invoicing. */
  hsnCode: string;
  /** GST rate applied to this product, e.g. 5 for 5%. */
  gstRatePercent: number;
  isWholesaleEligible: boolean;
  isRetailEligible: boolean;
  tags: string[];
}

/** Per-variant live price, held in Firestore (productPricing/{productId}). */
export interface VariantPricing {
  sellingPrice: number;
  /** Marketing "original price" shown struck-through, if any. */
  originalPrice?: number;
}

export interface ProductPricingDoc {
  variants: Record<string, VariantPricing>; // keyed by variant label
  updatedAt: number;
}

/** Per-variant live stock, held in Firestore (productInventory/{productId}). */
export interface VariantInventory {
  stockQty: number;
  lowStockThreshold: number;
  /** Manual admin override — hides the variant from the storefront even if stockQty > 0. */
  available: boolean;
}

export interface ProductInventoryDoc {
  variants: Record<string, VariantInventory>;
  updatedAt: number;
}

/* ── Cart & order line items ─────────────────────────────────────────── */

export interface CartItem {
  productId: string;
  name: string;
  slug: string;
  image?: string;
  /** Unit price for quantity 1 (display only — server recomputes on checkout). */
  price: number;
  originalPrice?: number;
  quantity: number;
  variantLabel: string;
}

export interface OrderLineItem {
  productId: string;
  name: string;
  variantLabel: string;
  weightGrams: number;
  qty: number;
  pricePerUnit: number;
  lineTotal: number;
  hsnCode: string;
  gstRatePercent: number;
}

export interface StatusEvent {
  status: OrderStatus;
  at: number; // epoch ms
  by?: string;
}

export type PaymentStatus = "created" | "paid" | "failed";

/** Razorpay payment metadata attached to an order once payment is verified. */
export interface PaymentMeta {
  provider: "razorpay";
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  amount: number; // in paise
  currency: string; // "INR"
  status: PaymentStatus;
  createdAt: number; // epoch ms
  paidAt?: number; // epoch ms
  failureReason?: string;
}

/**
 * Geo-coded, structured delivery address (Ola Maps Places / Geocoding).
 */
export interface AddressComponents {
  lat: number;
  lng: number;
  placeId?: string;
  displayAddress: string;
  doorAndBuilding: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
}

/**
 * Carrier-agnostic delivery/booking metadata. "porter" uses the deep-link
 * flow (admin pastes details into the Porter app manually); "aggregator"
 * uses an automated courier-aggregator API booking (Shiprocket/Delhivery —
 * see src/lib/shiprocket.ts); "other" is any manually-booked courier
 * (India Post, DTDC, etc.) for destinations outside both of the above,
 * recorded by the admin typing in a tracking number by hand.
 */
export interface DeliveryMeta {
  carrierId?: "porter" | "aggregator" | "other";
  fareEstimate?: number;
  carrierOrderId?: string;
  bookedAt?: number;
  trackingUrl?: string;
  /** Manually-entered Air Waybill / tracking number — used by "other" and as
   *  a fallback when the aggregator API doesn't return one immediately. */
  awbNumber?: string;
}

/** CGST+SGST (intra-Karnataka) vs IGST (inter-state) breakdown for an order. */
export interface GstBreakdown {
  cgst: number;
  sgst: number;
  igst: number;
}

export interface Order {
  id: string; // Firestore doc id
  orderId: string; // human-friendly RM-XXXXX
  customerId: string;
  customerName: string;
  phone: string;
  gstin?: string; // optional, captured for B2B-leaning retail buyers
  fulfillmentType: FulfillmentType;
  deliveryAddress?: string;
  addressComponents?: AddressComponents;
  deliveryMeta?: DeliveryMeta;
  items: OrderLineItem[];
  itemTotal: number;
  shippingFee: number;
  taxTotal: number;
  gstBreakdown: GstBreakdown;
  grandTotal: number;
  status: OrderStatus;
  statusHistory: StatusEvent[];
  notes?: string;
  payment?: PaymentMeta;
  /** Set once the GST invoice PDF has been generated and stored. */
  invoiceUrl?: string;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}

/* ── B2B leads (bulk wholesale & white-label) ────────────────────────── */

export interface DeliveryLocation {
  city: string;
  state: string;
  pincode: string;
}

export interface BulkLead {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  email?: string;
  gstin?: string;
  productsInterested: string[];
  estimatedQtyKgPerMonth: number;
  deliveryLocation: DeliveryLocation;
  notes?: string;
  status: LeadStatus;
  quotedPrice?: number;
  internationalInquiry: boolean;
  statusHistory: LeadStatusEvent[];
  createdAt: number;
  updatedAt: number;
}

export interface WhiteLabelLead {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  email?: string;
  gstin?: string;
  productsInterested: string[];
  estimatedQtyKgPerMonth: number;
  deliveryLocation: DeliveryLocation;
  brandNameIdea?: string;
  targetMarket?: string;
  needsPackagingDesign: boolean;
  notes?: string;
  status: LeadStatus;
  quotedPrice?: number;
  internationalInquiry: boolean;
  statusHistory: LeadStatusEvent[];
  createdAt: number;
  updatedAt: number;
}

/* ── Audit logging ───────────────────────────────────────────────────── */

export type AuditAction =
  | "order.created"
  | "order.status_changed"
  | "order.cancelled"
  | "order.refunded"
  | "inventory.stock_changed"
  | "inventory.price_changed"
  | "inventory.override_changed"
  | "lead.created"
  | "lead.status_changed"
  | "courier.booked"
  | "invoice.generated";

export interface AuditLogEntry {
  id?: string;
  action: AuditAction;
  actor: {
    uid?: string;
    email?: string;
    name?: string;
    type: "admin" | "customer" | "system";
  };
  targetId?: string; // e.g. "RM-00001" or a productId
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  /** Auto-expiry timestamp (30-day retention) so logs never accumulate as a database burden. */
  expiresAt: number;
}

/* ── Shipping policy ─────────────────────────────────────────────────── */

export interface ShippingConfigDoc {
  flatFee: number;
  freeAboveAmount: number;
  updatedAt: number;
}
