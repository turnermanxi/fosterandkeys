import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/properties
 * Returns all apartments with their units, newest-first.
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // Fetch apartments with nested units
    const { data: apartments, error: aptErr } = await supabase
      .from("apartments")
      .select("*, units(*)")
      .order("created_at", { ascending: false });

    if (aptErr) throw aptErr;

    // Also return a flat units list + apartment map for easy lookup
    const { data: units, error: unitErr } = await supabase
      .from("units")
      .select("*")
      .order("apartment_id");

    if (unitErr) throw unitErr;

    return NextResponse.json({ apartments, units });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
