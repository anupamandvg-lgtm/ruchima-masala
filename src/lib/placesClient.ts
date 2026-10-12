import { auth } from "@/lib/firebase";

/** Mirrors the server-side PlaceSuggestion shape (src/lib/olaMaps.ts) without
 *  importing a server-only module into client bundles. */
export interface PlaceSuggestion {
  label: string;
  lat: number;
  lng: number;
  city: string;
  pincode: string;
  placeId?: string;
  state?: string;
}

/** Attaches the signed-in user's ID token so the maps proxy routes (which
 *  require a signed-in caller) can authorize the request. */
async function authHeader(): Promise<HeadersInit> {
  const user = auth?.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

/** As-you-type address suggestions, optionally biased to a lat/lng. */
export async function autocomplete(
  query: string,
  signal?: AbortSignal,
  biasLat?: number,
  biasLng?: number,
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (!q) return [];

  const params = new URLSearchParams({ q });
  if (biasLat !== undefined && biasLng !== undefined) {
    params.set("lat", String(biasLat));
    params.set("lng", String(biasLng));
  }

  const res = await fetch(`/api/maps/autocomplete?${params.toString()}`, {
    headers: await authHeader(),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Address search failed");
  }
  const data = (await res.json()) as { results: PlaceSuggestion[] };
  return data.results ?? [];
}

/** Turns GPS coordinates into a confirmed address (used by the "My location" button). */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<PlaceSuggestion | null> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  const res = await fetch(`/api/maps/reverse-geocode?${params.toString()}`, {
    headers: await authHeader(),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Could not look up that location");
  }
  const data = (await res.json()) as { result: PlaceSuggestion | null };
  return data.result ?? null;
}
