import { BUSINESS } from "./config";
import { toWaIntl } from "./phone";
import { formatINR as rupees } from "./format";
import type { BulkLead, Order, OrderStatus, WhiteLabelLead } from "@/types";

export const waMeLink = (message?: string) =>
  `https://wa.me/${BUSINESS.phoneIntl}${message ? `?text=${encodeURIComponent(message)}` : ""}`;

/** WhatsApp message for a freshly placed order, addressed to the business. */
export const buildOrderMessage = (order: Order): string => {
  const addressLines: string[] = [];
  if (order.fulfillmentType === "pickup") {
    addressLines.push("🏬 Self-pickup from our store");
    addressLines.push(`   ${BUSINESS.warehouseAddress}`);
  } else if (order.addressComponents) {
    addressLines.push(`📍 Address: ${order.addressComponents.displayAddress}`);
    addressLines.push(`   Flat/Building: ${order.addressComponents.doorAndBuilding}`);
    if (order.addressComponents.landmark) {
      addressLines.push(`   Landmark: ${order.addressComponents.landmark}`);
    }
  } else {
    addressLines.push(`📍 Address: ${order.deliveryAddress}`);
  }

  const lines: string[] = [
    "🟠 *Ruchima Masala — NEW ORDER*",
    "",
    `🧾 Order ID: *${order.orderId}*`,
    `👤 Name: *${order.customerName}*`,
    `📞 Phone: ${order.phone}`,
    ...addressLines,
    "",
    "---- Items ----",
    ...order.items.map(
      (it) => `• ${it.name} (${it.variantLabel}) ×${it.qty} — ${rupees(it.lineTotal)}`,
    ),
    "",
    `Items total: ${rupees(order.itemTotal)}`,
    `Shipping: ${rupees(order.shippingFee)}`,
    `*GRAND TOTAL: ${rupees(order.grandTotal)}*`,
    "",
    "Please confirm this order and arrange delivery. Thank you! 🙏",
  ];
  return lines.join("\n");
};

/** Full wa.me link addressed to the business for a placed order. */
export const waLinkToKitchen = (order: Order): string => waMeLink(buildOrderMessage(order));

/* ── Order-status notifications (admin → customer) ─────────────────────── */

export const phoneToIntl = (phone: string): string => toWaIntl(phone);

const lineItems = (order: Order): string =>
  order.items.map((it) => `${it.qty}× ${it.name} (${it.variantLabel})`).join(", ");

const signOff = `— *${BUSINESS.name}* · ${BUSINESS.tagline}`;

const refCard = (order: Order, includeItems = true) => {
  const lines = [`🧾 Order ID: *${order.orderId}*`];
  if (includeItems) lines.push(`📦 ${lineItems(order)}`, `💰 Total: *${rupees(order.grandTotal)}*`);
  return lines.join("\n");
};

/** Per-status templates, mirroring order flow Placed → Paid → Packed → Shipped → Delivered. */
export const STATUS_MESSAGES: Record<OrderStatus, (order: Order) => string> = {
  Placed: (order) =>
    [
      "📝 *Ruchima Masala — Order Received*",
      "",
      `Hi ${order.customerName}, we've received your order and will confirm it shortly.`,
      "",
      refCard(order),
      "",
      signOff,
    ].join("\n"),

  Paid: (order) =>
    [
      "✅ *Ruchima Masala — Payment Confirmed*",
      "",
      `Hi ${order.customerName}, your payment is confirmed and your order is being processed. 🧡`,
      "",
      refCard(order),
      "",
      "We'll let you know as soon as it's packed and ready to ship.",
      "",
      signOff,
    ].join("\n"),

  Packed: (order) =>
    order.fulfillmentType === "pickup"
      ? [
        "📦 *Ruchima Masala — Order Packed*",
        "",
        `Hi ${order.customerName}, great news — your order is packed and ready for pickup!`,
        "",
        refCard(order),
        "",
        `Swing by during business hours: ${BUSINESS.warehouseAddress}`,
        "",
        signOff,
      ].join("\n")
      : [
        "📦 *Ruchima Masala — Order Packed*",
        "",
        `Hi ${order.customerName}, great news — your order is packed and ready to ship!`,
        "",
        refCard(order),
        "",
        "You'll get a message the moment it's handed to our delivery partner.",
        "",
        signOff,
      ].join("\n"),

  Shipped: (order) =>
    [
      "🚚 *Ruchima Masala — Shipped*",
      "",
      `Hi ${order.customerName}, your order is on its way! 🎉`,
      "",
      refCard(order, false),
      order.deliveryMeta?.trackingUrl ? `\n📍 Track: ${order.deliveryMeta.trackingUrl}` : "",
      "",
      "Our delivery partner will contact you shortly — please keep your phone handy.",
      "",
      signOff,
    ].join("\n"),

  Delivered: (order) =>
    order.fulfillmentType === "pickup"
      ? [
        "🎉 *Ruchima Masala — Picked Up!*",
        "",
        `Hi ${order.customerName}, thanks for picking up your order! Hope you enjoy your masalas. Thank you for choosing *Ruchima Masala*! 🧡`,
        "",
        `If you loved it, a quick word on Instagram (@${BUSINESS.instagram}) means the world to us. 📸`,
        "",
        "We can't wait to serve you again.",
        "",
        signOff,
      ].join("\n")
      : [
        "🎉 *Ruchima Masala — Delivered!*",
        "",
        `Hi ${order.customerName}, we hope your masalas arrive fresh and full of flavour. Thank you for choosing *Ruchima Masala*! 🧡`,
        "",
        `If you loved it, a quick word on Instagram (@${BUSINESS.instagram}) means the world to us. 📸`,
        "",
        "We can't wait to serve you again.",
        "",
        signOff,
      ].join("\n"),

  Cancelled: (order) =>
    [
      "🟠 *Ruchima Masala — Order Cancelled*",
      "",
      `Hi ${order.customerName}, your order ${order.orderId} has been cancelled as requested.`,
      "",
      "If there's anything we could have done differently, just reply here — we'd love to make it right. 🙏",
      "",
      signOff,
    ].join("\n"),

  Refunded: (order) =>
    [
      "💸 *Ruchima Masala — Order Refunded*",
      "",
      `Hi ${order.customerName}, your refund for order ${order.orderId} has been processed.`,
      "",
      "It should reflect in your original payment method within a few business days.",
      "",
      signOff,
    ].join("\n"),
};

/** WhatsApp draft for a customer about to be notified of a new status. */
export const buildStatusMessage = (order: Order, status: OrderStatus): string =>
  STATUS_MESSAGES[status]?.(order) ?? `Your order ${order.orderId} is now "${status}".`;

/** Full wa.me link addressed to the customer for a given status. */
export const waLinkToCustomer = (order: Order, status: OrderStatus): string =>
  `https://wa.me/${phoneToIntl(order.phone)}?text=${encodeURIComponent(buildStatusMessage(order, status))}`;

/* ── B2B lead messages ───────────────────────────────────────────────────── */

/** Message a bulk/wholesale lead sends to the business on form submit. */
export const buildBulkLeadMessage = (lead: BulkLead): string => {
  const lines = [
    "📋 *Bulk Order Enquiry — Ruchima Masala*",
    "",
    `🏢 Business: *${lead.businessName}*`,
    `👤 Contact: ${lead.contactName}`,
    `📞 Phone: ${lead.phone}`,
    lead.email ? `✉️ Email: ${lead.email}` : "",
    lead.gstin ? `🧾 GSTIN: ${lead.gstin}` : "",
    "",
    `Products of interest: ${lead.productsInterested.join(", ")}`,
    `Estimated qty: ${lead.estimatedQtyKgPerMonth} kg/month`,
    `Delivery location: ${lead.deliveryLocation.city}, ${lead.deliveryLocation.state} ${lead.deliveryLocation.pincode}`,
    lead.notes ? `Notes: ${lead.notes}` : "",
    lead.internationalInquiry ? "🌍 International (Dubai) inquiry" : "",
    "",
    "We'd like a wholesale quote. Thank you!",
  ].filter(Boolean);
  return lines.join("\n");
};

export const waLinkForBulkLead = (lead: BulkLead): string => waMeLink(buildBulkLeadMessage(lead));

/** Message a white-label lead sends to the business on form submit. */
export const buildWhiteLabelLeadMessage = (lead: WhiteLabelLead): string => {
  const lines = [
    "🏷️ *White-Label Enquiry — Ruchima Masala*",
    "",
    `🏢 Business: *${lead.businessName}*`,
    `👤 Contact: ${lead.contactName}`,
    `📞 Phone: ${lead.phone}`,
    lead.email ? `✉️ Email: ${lead.email}` : "",
    lead.gstin ? `🧾 GSTIN: ${lead.gstin}` : "",
    lead.brandNameIdea ? `✨ Brand name idea: ${lead.brandNameIdea}` : "",
    lead.targetMarket ? `🎯 Target market: ${lead.targetMarket}` : "",
    lead.needsPackagingDesign ? "📦 Needs packaging design support" : "",
    "",
    `Products of interest: ${lead.productsInterested.join(", ")}`,
    `Estimated qty: ${lead.estimatedQtyKgPerMonth} kg/month`,
    lead.notes ? `Notes: ${lead.notes}` : "",
    lead.internationalInquiry ? "🌍 International (Dubai) inquiry" : "",
    "",
    "We'd like to discuss the white-label program. Thank you!",
  ].filter(Boolean);
  return lines.join("\n");
};

export const waLinkForWhiteLabelLead = (lead: WhiteLabelLead): string =>
  waMeLink(buildWhiteLabelLeadMessage(lead));
