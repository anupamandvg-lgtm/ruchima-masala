import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/requireUser";
import { checkMapsRateLimit, clientIp } from "@/lib/server/mapsRateLimit";
import { autocompleteKey, getCachedAutocomplete, setCachedAutocomplete } from "@/lib/server/autocompleteCache";
import { autocomplete } from "@/lib/olaMaps";

export async function GET(request: Request) {
  // Require a signed-in user — this route proxies a billable Ola call, and the
  // client debounce is UI, not a security boundary. Anonymous callers are out.
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  // Throttle per user + IP so a signed-in abuser can't drain the Ola quota.
  const limited = checkMapsRateLimit(`ac:${auth.uid}:${clientIp(request)}`);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const lat = latParam !== null ? parseFloat(latParam) : undefined;
  const lng = lngParam !== null ? parseFloat(lngParam) : undefined;

  if (!q.trim()) {
    return NextResponse.json({ results: [] });
  }

  // Serve identical recent queries from cache so repeated prefixes while typing
  // don't each bill a fresh Ola call.
  const cacheKey = autocompleteKey(q, lat, lng);
  const cached = getCachedAutocomplete(cacheKey);
  if (cached) return NextResponse.json({ results: cached });

  try {
    // Forward the request's abort signal so a cancelled client fetch (the
    // debounce aborting a stale keystroke) actually aborts the outbound Ola
    // call, instead of billing for a result nobody will read.
    const results = await autocomplete(q, lat, lng, request.signal);
    setCachedAutocomplete(cacheKey, results);
    return NextResponse.json({ results });
  } catch (err) {
    console.error("Ola Maps autocomplete error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Autocomplete failed" },
      { status: 500 },
    );
  }
}
