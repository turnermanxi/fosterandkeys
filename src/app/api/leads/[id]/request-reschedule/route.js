import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyLeadOwnership } from "@/lib/api-auth";

/**
 * POST /api/leads/[id]/request-reschedule
 * 
 * Lorenzo requests a new round of recommendations for a lead
 * Archives previous round's data and increments round number
 * Status becomes "reschedule_requested" to flag for follow-up
 * REQUIRES: User authenticated and lead belongs to their account
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const authCheck = await verifyLeadOwnership(id);
    if (authCheck.error) return authCheck.response;
    const { reason = "", notes = "" } = await request.json();
    const supabase = getSupabaseAdmin();

    // Get the lead
    const { data: lead, error: fetchErr } = await supabase
      .from("leads")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    // Archive current round's recommendations
    const currentRoundMatch = {
      round: lead.current_round,
      recommended_units: lead.recommended_units || [],
      archived_at: new Date().toISOString(),
    };
    const updatedMatchHistory = [...(lead.match_history || []), currentRoundMatch];

    // Archive current round's tour details
    let updatedTourHistory = lead.tour_history || [];
    if (lead.tour_details) {
      updatedTourHistory = [
        ...updatedTourHistory,
        {
          round: lead.current_round,
          tour_details: lead.tour_details,
          archived_at: new Date().toISOString(),
        },
      ];
    }

    // Create timeline event
    const newEvent = {
      stage: "reschedule_requested",
      timestamp: new Date().toISOString(),
      notes: `Requested new recommendations (Round ${lead.current_round + 1}). Reason: ${reason || "Not specified"}${notes ? " - " + notes : ""}`,
      data: {
        round: lead.current_round,
        reason,
        notes,
      },
      visibility: "both",
    };

    const updatedTimeline = [...(lead.timeline || []), newEvent];

    // Update lead: increment round, clear matches/tours, set status
    const { data: updated, error: updateErr } = await supabase
      .from("leads")
      .update({
        current_round: lead.current_round + 1,
        current_status: "reschedule_requested",
        recommended_units: [], // Clear for new round
        tour_details: null, // Clear for new round
        property_feedback: null, // Clear feedback
        match_history: updatedMatchHistory,
        tour_history: updatedTourHistory,
        timeline: updatedTimeline,
        follow_up_needed: true,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      message: `Lead moved to Round ${lead.current_round + 1}. Ready for new recommendations.`,
      lead: updated,
    });
  } catch (err) {
    console.error("Error requesting reschedule:", err);
    return NextResponse.json(
      { error: err.message || "Failed to request reschedule" },
      { status: 500 }
    );
  }
}
