import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { createShiprocketOrder } from "@/lib/shiprocket";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as {
      orderId?: string;
      customerName?: string;
      customerPhone?: string;
      dropAddress?: string;
      dropCity?: string;
      dropState?: string;
      dropPincode?: string;
      weightKg?: number;
    };

    if (
      !body.orderId || !body.customerName || !body.customerPhone || !body.dropAddress
      || !body.dropCity || !body.dropState || !body.dropPincode || !body.weightKg
    ) {
      return NextResponse.json(
        { error: "Missing required order parameters for Shiprocket delivery" },
        { status: 400 },
      );
    }

    const result = await createShiprocketOrder({
      orderId: body.orderId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      dropAddress: body.dropAddress,
      dropCity: body.dropCity,
      dropState: body.dropState,
      dropPincode: body.dropPincode,
      weightKg: body.weightKg,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Shiprocket delivery booking error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to book Shiprocket delivery" },
      { status: 500 },
    );
  }
}
