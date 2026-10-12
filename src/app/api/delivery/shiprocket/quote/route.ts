import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getShiprocketQuote } from "@/lib/shiprocket";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as {
      dropPincode?: string;
      weightKg?: number;
    };

    if (!body.dropPincode || !body.weightKg) {
      return NextResponse.json(
        { error: "Missing dropPincode or weightKg for Shiprocket fare quote" },
        { status: 400 },
      );
    }

    const result = await getShiprocketQuote({
      dropPincode: body.dropPincode,
      weightKg: body.weightKg,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Shiprocket fare quote error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to fetch Shiprocket fare quote" },
      { status: 500 },
    );
  }
}
