// Server-only Ola Maps (Krutrim) client for reverse geocoding and address
// autocomplete. The API key is read from process.env here and must never be
// exposed to the browser — routes in src/app/api/maps/* proxy these calls
// for the client.

const OLA_BASE = "https://api.olamaps.io/places/v1";

/** A single geocode/autocomplete result, flattened into what AddressPicker needs. */
export interface PlaceSuggestion {
  /** Human-readable label to show in the suggestions list / confirmed address. */
  label: string;
  lat: number;
  lng: number;
  city: string;
  pincode: string;
  /** Ola Maps place identifier (format "ola-platform:<id>"), if present. */
  placeId?: string;
}

interface OlaAddressComponent {
  types: string[];
  long_name: string;
  short_name: string;
}

interface OlaGeometry {
  location: { lat: number; lng: number };
}

interface OlaReverseGeocodeResult {
  formatted_address: string;
  place_id?: string;
  geometry: OlaGeometry;
  address_components: OlaAddressComponent[];
}

interface OlaReverseGeocodeResponse {
  status: string;
  results: OlaReverseGeocodeResult[];
}

interface OlaPrediction {
  description: string;
  place_id?: string;
  geometry: OlaGeometry;
  structured_formatting?: { main_text: string; secondary_text: string };
}

interface OlaAutocompleteResponse {
  status: string;
  predictions: OlaPrediction[];
}

function apiKey(): string {
  const key = process.env.OLA_MAPS_API_KEY;
  if (!key) throw new Error("OLA_MAPS_API_KEY is not configured.");
  return key;
}

/** City with the same fallback chain the old Google address_components parsing used. */
function extractCityPincode(components: OlaAddressComponent[]): { city: string; pincode: string } {
  let city = "";
  let pincode = "";
  for (const c of components) {
    const types = c.types ?? [];
    if (types.includes("locality") && !city) city = c.long_name;
    if (types.includes("administrative_area_level_2") && !city) city = c.long_name;
    if (types.includes("administrative_area_level_1") && !city) city = c.long_name;
    if (types.includes("postal_code")) pincode = c.long_name;
  }
  return { city, pincode };
}

/** Extracts the state name (administrative_area_level_1), used to decide
 *  CGST+SGST vs IGST at checkout. */
export function extractState(components: OlaAddressComponent[]): string {
  for (const c of components) {
    if ((c.types ?? []).includes("administrative_area_level_1")) return c.long_name;
  }
  return "";
}

/** Reverse geocode — turns GPS coordinates into a confirmed address.
 *  Pass the incoming request's AbortSignal so a cancelled client request
 *  actually aborts the outbound Ola call (and stops billing for it). */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<(PlaceSuggestion & { state?: string }) | null> {
  const url = `${OLA_BASE}/reverse-geocode?latlng=${lat},${lng}&api_key=${apiKey()}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Ola Maps reverse geocode failed (${res.status})`);
  const data = (await res.json()) as OlaReverseGeocodeResponse;
  const result = data.results?.[0];
  if (!result) return null;

  const { city, pincode } = extractCityPincode(result.address_components ?? []);
  return {
    label: result.formatted_address,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    city,
    pincode,
    placeId: result.place_id,
    state: extractState(result.address_components ?? []),
  };
}

/**
 * Forward search — as-you-type address suggestions, optionally biased to a
 * lat/lng (e.g. the warehouse's location, the whole service area).
 */
export async function autocomplete(
  query: string,
  biasLat?: number,
  biasLng?: number,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (!q) return [];

  let url = `${OLA_BASE}/autocomplete?input=${encodeURIComponent(q)}&api_key=${apiKey()}`;
  if (biasLat !== undefined && biasLng !== undefined) {
    url += `&location=${biasLat},${biasLng}`;
  }

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Ola Maps autocomplete failed (${res.status})`);
  const data = (await res.json()) as OlaAutocompleteResponse;

  return (data.predictions ?? [])
    .filter((p) => p.geometry?.location)
    .map((p) => ({
      label: p.description,
      lat: p.geometry.location.lat,
      lng: p.geometry.location.lng,
      city: "",
      pincode: "",
      placeId: p.place_id,
    }));
}
