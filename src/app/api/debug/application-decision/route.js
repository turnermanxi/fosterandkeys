import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/debug/application-decision?token=xxx
 * Debug endpoint to see what data is in the database
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get the lead
    const { data: lead, error } = await supabase
      .from("leads")
      .select("*")
      .eq("results_token", token)
      .single();

    if (error || !lead) {
      return NextResponse.json(
        { error: "Lead not found", details: error },
        { status: 404 }
      );
    }

    // Check recommended_units structure
    console.log("DEBUG: Lead data:", {
      id: lead.id,
      full_name: lead.full_name,
      recommended_units: lead.recommended_units,
      recommended_units_type: typeof lead.recommended_units,
      recommended_units_length: lead.recommended_units?.length,
    });

    if (!lead.recommended_units || lead.recommended_units.length === 0) {
      return NextResponse.json({
        status: "no_recommended_units",
        lead: {
          id: lead.id,
          full_name: lead.full_name,
          recommended_units: lead.recommended_units,
        },
        message: "Lead has no recommended units",
      });
    }

    // Try to get just the first unit to debug
    const firstUnitId = lead.recommended_units[0]?.unit_id;
    console.log("DEBUG: First unit ID:", firstUnitId);

    if (!firstUnitId) {
      return NextResponse.json({
        status: "no_unit_ids",
        recommended_units: lead.recommended_units,
        message: "recommended_units array exists but has no unit_id fields",
      });
    }

    const { data: accountApartments } = await supabase
      .from("apartments")
      .select("id")
      .eq("account_id", lead.account_id);
    const accountApartmentIds = (accountApartments || []).map((a) => a.id);

    const { data: unit, error: unitError } = await supabase
      .from("units")
      .select("*")
      .eq("id", firstUnitId)
      .in("apartment_id", accountApartmentIds)
      .single();

    console.log("DEBUG: Unit lookup:", { unit, unitError });

    const { data: apartment, error: aptError } = await supabase
      .from("apartments")
      .select("*")
      .eq("id", unit?.apartment_id)
      .eq("account_id", lead.account_id)
      .single();

    console.log("DEBUG: Apartment lookup:", { apartment, aptError });

    return NextResponse.json({
      status: "debug_data",
      lead: {
        id: lead.id,
        full_name: lead.full_name,
        recommended_units: lead.recommended_units,
      },
      first_unit: unit,
      first_apartment: apartment,
      errors: {
        lead_error: error,
        unit_error: unitError,
        apartment_error: aptError,
      },
    });
  } catch (err) {
    console.error("Debug error:", err);
    return NextResponse.json(
      { error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}
