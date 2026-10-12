import "server-only";
import type { PlaceSuggestion } from "@/lib/olaMaps";

/**
 * Short-TTL in-memory cache for autocomplete results.
 *
 * Typing an address produces many near-identical queries (the same prefix as
 * the user pauses, the same full string retyped), and each miss is a billable
 * Ola call. Caching identical (query + bias) results for a few seconds collapses
 * those repeats into one call — the single biggest quota saver for the heaviest
 * Ola product. Per serverless instance and best-effort by design: a cache miss
 * just falls through to a normal Ola call, so correctness never depends on it.
 */

const TTL_MS = 60_000;
const MAX_ENTRIES = 2_000;

interface Entry {
  results: PlaceSuggestion[];
  expires: number;
}

const cache = new Map<string, Entry>();

/** Normalized cache key for a query + optional location bias. */
export function autocompleteKey(q: string, lat?: number, lng?: number): string {
  return `${q.trim().toLowerCase()}|${lat ?? ""}|${lng ?? ""}`;
}

export function getCachedAutocomplete(key: string): PlaceSuggestion[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.results;
}

export function setCachedAutocomplete(key: string, results: PlaceSuggestion[]): void {
  // Simple bound: clear the whole map when it gets large. The TTL is short, so
  // a periodic full flush is cheaper than tracking per-entry eviction order.
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(key, { results, expires: Date.now() + TTL_MS });
}
