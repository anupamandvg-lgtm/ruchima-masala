import { BUSINESS } from "./config";
import { toLocal10 } from "./phone";
import type { Order } from "@/types";

export interface PorterLocationData {
  name: string;
  phone: string;
  lat: number;
  lng: number;
  addressString: string;
}

export interface PorterBookingPayload {
  pickup: PorterLocationData;
  dropoff: PorterLocationData;
}

/**
 * The exact strings an admin pastes into Porter's booking form.
 * Ordered to match the flow in the Porter app: drop address → building →
 * receiver's name → receiver's mobile. `allDetails` is a formatted block
 * for cases where the admin wants everything at once.
 */
export interface PorterClipboardData {
  /** For Porter's "Where is your Drop?" search field. */
  dropAddress: string;
  /** For Porter's "House / Apartment / Shop (optional)" field. */
  buildingDetails: string;
  /** For Porter's "Receiver's Name" field. */
  receiverName: string;
  /** For Porter's "Receiver's Mobile number" field — plain 10 digits. */
  receiverPhone: string;
  /** Formatted multi-line block for a single "copy all" paste. */
  allDetails: string;
}

/** Placeholder used in the UI when a field genuinely has no data. */
const NOT_SPECIFIED = "—";

/**
 * Normalizes an Indian phone to the 10-digit form Porter's Receiver's Mobile
 * field expects. Orders store phones like "+91 96068 88096"; Porter wants
 * "9606888096". Delegates to the shared normalizer so the country-code peeling
 * and validation live in one place. Returns "" (rather than a corrupted,
 * silently-truncated number) for anything that isn't a valid Indian mobile —
 * the caller renders the "—" placeholder in that case.
 */
export function toPorterPhone(phone: string): string {
  return toLocal10(phone);
}

/**
 * Builds the individual strings the admin pastes into Porter's form.
 * - Prefers structured `addressComponents` (new orders) and falls back to the
 *   legacy plain `deliveryAddress` string.
 * - Appends the landmark to the drop address so Porter's driver sees it in
 *   the search chip they save.
 * - Splits building details out of the address into their own field so
 *   Porter's "House / Apartment / Shop" input can hold them.
 *
 * Intended for routes within Porter's metro-to-metro intercity coverage —
 * long-haul pan-India orders go through src/lib/shiprocket.ts instead.
 */
export function buildPorterClipboardData(order: Order): PorterClipboardData {
  const ac = order.addressComponents;

  const dropAddress = ac
    ? [ac.displayAddress, ac.landmark ? `Landmark: ${ac.landmark}` : ""]
        .filter(Boolean)
        .join(" · ")
    : order.deliveryAddress || NOT_SPECIFIED;

  const buildingDetails = ac?.doorAndBuilding?.trim() || NOT_SPECIFIED;
  const receiverName = order.customerName?.trim() || NOT_SPECIFIED;
  const receiverPhone = toPorterPhone(order.phone);

  const allDetails = [
    `Ruchima Masala — Porter Booking (${order.orderId})`,
    "",
    `Drop Address: ${dropAddress}`,
    `Building: ${buildingDetails}`,
    `Receiver: ${receiverName}`,
    `Mobile: ${receiverPhone}`,
  ].join("\n");

  return { dropAddress, buildingDetails, receiverName, receiverPhone, allDetails };
}

/**
 * Builds the structured Porter deep-link URL and fallback clipboard text for a given order.
 */
export function buildPorterDeepLink(order: Order): {
  androidIntentUrl: string;
  iosSchemeUrl: string;
  clipboardText: string;
  fullSummary: string;
  payload: PorterBookingPayload;
} {
  const pickup: PorterLocationData = {
    name: BUSINESS.name,
    phone: BUSINESS.phone,
    lat: BUSINESS.lat,
    lng: BUSINESS.lng,
    addressString: BUSINESS.warehouseAddress,
  };

  const dropLat = order.addressComponents?.lat ?? BUSINESS.lat;
  const dropLng = order.addressComponents?.lng ?? BUSINESS.lng;
  // Only reached for delivery orders (callers gate on fulfillmentType !== "pickup"),
  // so deliveryAddress is always set in practice — the fallback is defensive only.
  const dropAddress = order.addressComponents
    ? `${order.addressComponents.doorAndBuilding}, ${order.addressComponents.displayAddress}${
        order.addressComponents.landmark ? ` (Landmark: ${order.addressComponents.landmark})` : ""
      }`
    : order.deliveryAddress || NOT_SPECIFIED;

  const dropoff: PorterLocationData = {
    name: order.customerName,
    phone: order.phone,
    lat: dropLat,
    lng: dropLng,
    addressString: dropAddress,
  };

  const payload: PorterBookingPayload = { pickup, dropoff };

  // Format clean address string for 1-tap Gboard/Keyboard paste chip
  const clipboardText = dropAddress;

  // Detailed summary clipboard text (logged/available if needed)
  const fullSummary = `📦 RUCHIMA MASALA DELIVERY (#${order.orderId})\n` +
    `👤 Customer: ${dropoff.name}\n` +
    `📞 Mobile: ${dropoff.phone}\n` +
    `📍 Dropoff Address: ${dropoff.addressString}`;

  // Direct Android Intent URI (Launches com.theporter.android.customerapp directly without Play Store page)
  const androidIntentUrl =
    `intent://#Intent;package=com.theporter.android.customerapp;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;end`;

  // iOS Custom Scheme (porter://)
  const iosSchemeUrl = `porter://`;

  return { androidIntentUrl, iosSchemeUrl, clipboardText, fullSummary, payload };
}

/**
 * Triggers the Porter mobile application on the admin's device via Deep Link,
 * simultaneously copying customer details to the clipboard.
 */
export async function launchPorterAppDeepLink(order: Order) {
  const { androidIntentUrl, iosSchemeUrl, clipboardText } = buildPorterDeepLink(order);

  // Copy clean dropoff address to clipboard so Gboard / keyboard displays 1-tap paste chip
  try {
    await navigator.clipboard.writeText(clipboardText);
    alert(
      `📋 Address copied to clipboard!\n\n` +
      `📍 ${clipboardText}\n\n` +
      `Opening Porter app...\nTap the search box in Porter and tap Paste!`,
    );
  } catch (err) {
    console.warn("Clipboard write failed:", err);
  }

  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isAndroid) {
    window.location.href = androidIntentUrl;
  } else if (isIOS) {
    window.location.href = iosSchemeUrl;
  } else {
    // Desktop browser fallback
    window.location.href = androidIntentUrl;
  }
}
