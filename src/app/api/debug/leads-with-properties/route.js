import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/debug/leads-with-properties
 * See all leads that have recommended_units
 */
export async function GET(request) {
  try {
    const supabase = getSupabaseAdmin();

    // Get all leads with recommended_units that are not empty
    const { data: leads, error } = await supabase
      .from("leads")
      .select("id, full_name, email, results_token, recommended_units")
      .not("recommended_units", "is", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`Found ${leads?.length} leads with recommended_units`);

    // Filter to only those that have actual units
    const leadsWithUnits = (leads || []).filter(
      (l) => Array.isArray(l.recommended_units) && l.recommended_units.length > 0
    );

    console.log(`${leadsWithUnits.length} leads have non-empty recommended_units`);

    // Show summary
    const summary = {
      total_leads_checked: leads?.length || 0,
      leads_with_recommended_units: leadsWithUnits.length,
      sample_leads: leadsWithUnits.slice(0, 5).map((l) => ({
        id: l.id,
        full_name: l.full_name,
        email: l.email,
        results_token: l.results_token,
        num_recommended: l.recommended_units?.length || 0,
        recommended_units: l.recommended_units,
      })),
    };

    return NextResponse.json(summary);
  } catch (err) {
    console.error("Debug error:", err);
    return NextResponse.json(
      { error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}
