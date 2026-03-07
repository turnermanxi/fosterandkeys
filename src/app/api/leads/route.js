import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/leads
 * Returns all leads with their top match score, ordered newest-first.
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data: leads, error } = await supabase
      .from("leads")
      .select("*, lead_matches(score, unit_id, apartment_id)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Attach a top_score for convenience
    const enriched = leads.map((l) => {
      const scores = (l.lead_matches ?? []).map((m) => m.score);
      return {
        ...l,
        top_score: scores.length ? Math.max(...scores) : null,
        match_count: scores.length,
      };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
