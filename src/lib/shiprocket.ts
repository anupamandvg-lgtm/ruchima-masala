import { BUSINESS } from "./config";
import { toLocal10 } from "./phone";

/**
 * Shiprocket courier-aggregator — server-side client.
 *
 * Covers pan-India destinations outside Porter's metro-to-metro intercity
 * coverage (see src/lib/porterDeepLink.ts for that path). Mirrors
 * rakus-kitchen's src/lib/shadowfax.ts shape: a quote call plus a
 * create-order call, both falling back to MOCK mode when SHIPROCKET_* env
 * vars are unset so the admin UI works before the client's Shiprocket
 * account is onboarded.
 *
 * NOTE: Shiprocket's actual auth flow is token-based (POST /auth/login with
 * email+password returns a bearer token, cached and refreshed — not a
 * static API key). The exact field names below are placeholders modelled on
 * their public API docs and MUST be confirmed against the live Shiprocket
 * account at onboarding. Response parsing is deliberately defensive (tries
 * several field names) so a minor naming mismatch degrades to a clear error
 * rather than a crash. If the client's actual account is Delhivery instead,
 * this file is the pattern to re-model against Delhivery's API — the
 * quote/createOrder/MOCK-fallback shape stays the same.
 */

const SHIPROCKET_API_BASE =
  process.env.SHIPROCKET_API_BASE || "https://apiv2.shiprocket.in/v1/external";

/* ── Shared shapes ─────────────────────────────────────────────────────── */

interface ShiprocketLocation {
  name: string;
  address: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
}

/** Payload for the serviceability/rate-check (quote) endpoint. */
export interface ShiprocketQuotePayload {
  pickup_postcode: string;
  delivery_postcode: string;
  weight_kg: number;
  cod: 0 | 1;
}

/** Payload for the create-order (adhoc order) endpoint. */
export interface ShiprocketCreateOrderPayload {
  order_id: string;
  pickup: ShiprocketLocation;
  drop: ShiprocketLocation;
  weight_kg: number;
  order_details?: { description?: string };
}

export interface ShiprocketQuoteResult {
  fareEstimate: number;
  currency: string;
  etaDays?: number;
  courierName?: string;
  mock?: boolean;
}

export interface ShiprocketOrderResult {
  carrierId: "aggregator";
  carrierOrderId: string;
  fareEstimate?: number;
  trackingUrl?: string;
  awbNumber?: string;
  mock?: boolean;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function apiToken(): string | undefined {
  const t = process.env.SHIPROCKET_API_TOKEN;
  return t && t.trim() !== "" ? t.trim() : undefined;
}

/** Reads response JSON defensively — a non-JSON body becomes a readable error. */
async function readJson(response: Response, context: string): Promise<Record<string, unknown>> {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Shiprocket ${context} returned a non-JSON response (HTTP ${response.status}): ${text.slice(0, 200)}`,
    );
  }
}

/** Picks the first defined numeric field from a set of candidate keys. */
function pickNumber(obj: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return undefined;
}

/** Picks the first defined non-empty string field from candidate keys. */
function pickString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim() !== "") return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

function pickupLocation(): ShiprocketLocation {
  return {
    name: BUSINESS.name,
    address: BUSINESS.warehouseAddress,
    phone: BUSINESS.phone,
  };
}

/* ── Serviceability / rate check (quote) ───────────────────────────────── */

/**
 * Fetches a shipping-rate estimate from Shiprocket BEFORE booking, so the
 * admin can see the cost first. Falls back to a mock estimate when no API
 * token is set.
 */
export async function getShiprocketQuote(params: {
  dropPincode: string;
  weightKg: number;
}): Promise<ShiprocketQuoteResult> {
  const token = apiToken();

  if (!token) {
    // MOCK: rough flat placeholder so the UI renders a number pre-onboarding.
    return { fareEstimate: 120, currency: "INR", etaDays: 4, courierName: "Mock Courier", mock: true };
  }

  const params_ = new URLSearchParams({
    pickup_postcode: "560091", // Andrahalli warehouse pincode
    delivery_postcode: params.dropPincode,
    weight: String(params.weightKg),
    cod: "0",
  });

  const response = await fetch(`${SHIPROCKET_API_BASE}/courier/serviceability/?${params_}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await readJson(response, "quote");

  if (!response.ok) {
    const msg =
      pickString(data, "message", "error", "detail") || `Quote failed (HTTP ${response.status})`;
    throw new Error(msg);
  }

  const companies = (data.data as { available_courier_companies?: Record<string, unknown>[] } | undefined)
    ?.available_courier_companies;
  const best = Array.isArray(companies) && companies.length > 0 ? companies[0] : undefined;

  const fare = best ? pickNumber(best, "rate", "freight_charge", "total_charge") : undefined;
  if (fare === undefined) {
    throw new Error("Shiprocket quote returned no courier rate — check the response field names.");
  }

  return {
    fareEstimate: fare,
    currency: "INR",
    etaDays: best ? pickNumber(best, "estimated_delivery_days", "etd") : undefined,
    courierName: best ? pickString(best, "courier_name") : undefined,
  };
}

/* ── Booking (create order) ────────────────────────────────────────────── */

/**
 * Creates a Shiprocket delivery order. Falls back to MOCK mode (a fake
 * booking) when SHIPROCKET_API_TOKEN is unset, identical in spirit to the
 * ShadowFax client's behaviour in rakus-kitchen.
 */
export async function createShiprocketOrder(params: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  dropAddress: string;
  dropCity: string;
  dropState: string;
  dropPincode: string;
  weightKg: number;
}): Promise<ShiprocketOrderResult> {
  const token = apiToken();

  if (!token) {
    const mockId = `SHIPROCKET-${Date.now().toString().slice(-6)}`;
    return {
      carrierId: "aggregator",
      carrierOrderId: mockId,
      fareEstimate: 120,
      trackingUrl: `https://shiprocket.co/tracking/${mockId}`,
      awbNumber: `MOCKAWB${Date.now().toString().slice(-8)}`,
      mock: true,
    };
  }

  const payload: ShiprocketCreateOrderPayload = {
    order_id: params.orderId,
    pickup: pickupLocation(),
    drop: {
      name: params.customerName,
      address: params.dropAddress,
      city: params.dropCity,
      state: params.dropState,
      pincode: params.dropPincode,
      // Normalize to a bare 10-digit mobile; falls back to the raw string only
      // if it can't be resolved, so a valid number is always cleanly formatted.
      phone: toLocal10(params.customerPhone) || params.customerPhone,
    },
    weight_kg: params.weightKg,
    order_details: { description: `Masala Order - ${BUSINESS.name} Order #${params.orderId}` },
  };

  const response = await fetch(`${SHIPROCKET_API_BASE}/orders/create/adhoc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await readJson(response, "create-order");

  if (!response.ok) {
    const msg =
      pickString(data, "message", "error", "detail") ||
      `Shiprocket API HTTP error ${response.status}`;
    throw new Error(msg);
  }

  const carrierOrderId = pickString(data, "shipment_id", "order_id", "id");
  if (!carrierOrderId) {
    throw new Error("Shiprocket booking succeeded but returned no order id — check response fields.");
  }

  return {
    carrierId: "aggregator",
    carrierOrderId,
    fareEstimate: pickNumber(data, "freight_charge", "total_charge"),
    trackingUrl: pickString(data, "tracking_url", "track_url"),
    awbNumber: pickString(data, "awb_code", "awb"),
  };
}
