import { NextResponse } from "next/server";
import { getCurrentAccountId } from "@/lib/accounts";
import { checkForDuplicates } from "@/lib/duplicateDetection";

/**
 * GET /api/properties/check-duplicates
 * Check for probable duplicates based on address and other criteria
 *
 * Query params:
 *   - address (required)
 *   - city (required)
 *   - zip (optional)
 *   - price_min (optional)
 *   - price_max (optional)
 *   - property_name (optional)
 */
export async function GET(request) {
  try {
    const accountId = await getCurrentAccountId();
    const url = new URL(request.url);

    // Build property object from query params
    const property = {
      address: url.searchParams.get("address"),
      city: url.searchParams.get("city"),
      zip: url.searchParams.get("zip"),
      price_min: url.searchParams.get("price_min")
        ? parseFloat(url.searchParams.get("price_min"))
        : null,
      price_max: url.searchParams.get("price_max")
        ? parseFloat(url.searchParams.get("price_max"))
        : null,
      property_name: url.searchParams.get("property_name"),
    };

    if (!property.address || !property.city) {
      return NextResponse.json(
        { error: "address and city are required" },
        { status: 400 }
      );
    }

    // Check for duplicates
    const duplicates = await checkForDuplicates(property, accountId);

    return NextResponse.json({
      duplicates,
    });
  } catch (err) {
    console.error("GET /api/properties/check-duplicates error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
