import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/requireUser";
import { checkMapsRateLimit, clientIp } from "@/lib/server/mapsRateLimit";
import { reverseGeocode } from "@/lib/olaMaps";

export async function GET(request: Request) {
  // Require a signed-in user — this route proxies a billable Ola call.
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  // Throttle per user + IP so a signed-in abuser can't drain the Ola quota.
  const limited = checkMapsRateLimit(`rg:${auth.uid}:${clientIp(request)}`);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "Missing or invalid lat/lng" }, { status: 400 });
  }

  try {
    // Forward the request's abort signal so a cancelled client fetch aborts the
    // outbound Ola call rather than billing for a result nobody will read.
    const result = await reverseGeocode(lat, lng, request.signal);
    return NextResponse.json({ result });
  } catch (err) {
    console.error("Ola Maps reverse geocode error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Reverse geocode failed" },
      { status: 500 },
    );
  }
}
