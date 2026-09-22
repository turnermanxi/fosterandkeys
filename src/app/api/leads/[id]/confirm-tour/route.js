import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/leads/[id]/confirm-tour
 *
 * CX confirms which properties they toured
 * Updates lead_matches with toured_status
 *
 * Auth: client-facing. Accepts `token` (results_token) in the body as a
 * capability credential OR an authenticated agent session with ownership.
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { toured_properties, property_feedback = {}, token = null } = body;
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

    // Authorize via the client's results_token
    if (!token || lead.results_token !== token) {
      return NextResponse.json(
        { error: "Forbidden: invalid tour confirmation link" },
        { status: 403 }
      );
    }

    // Get all interested matches
    const { data: interestedMatches, error: matchErr } = await supabase
      .from("lead_matches")
      .select("id, unit_id, property_id, apartment_id")
      .eq("lead_id", id)
      .eq("cx_response", "interested");

    if (matchErr) throw matchErr;

    // Update each match with toured status and interest level
    if (interestedMatches && interestedMatches.length > 0) {
      for (const match of interestedMatches) {
        const matchId = match.unit_id 
          ? `unit-${match.unit_id}` 
          : match.property_id
          ? `property-${match.property_id}`
          : `apartment-${match.apartment_id}`;
        
        const wasToured = toured_properties.includes(matchId);
        const interestLevel = property_feedback[matchId] || "not_visited";

        const { error: updateErr } = await supabase
          .from("lead_matches")
          .update({
            toured_status: wasToured ? "toured" : "not_toured",
            toured_at: wasToured ? new Date().toISOString() : null,
            interest_level: interestLevel, // Store interest level (not_visited, not_interested, interested, very_interested)
          })
          .eq("id", match.id);

        if (updateErr) throw updateErr;
      }
    }

    // Determine overall status
    const touredCount = toured_properties.length;
    const newStatus = touredCount > 0 ? "tour_completed" : "tour_rescheduled";

    // Create timeline event
    const newEvent = {
      stage: "tour_confirmed",
      timestamp: new Date().toISOString(),
      notes: `Client confirmed tour follow-up. Toured ${touredCount} of ${interestedMatches?.length || 0} properties`,
      data: {
        toured_count: touredCount,
        total_scheduled: interestedMatches?.length || 0,
        toured_properties,
        property_feedback,
      },
      visibility: "both",
    };

    const updatedTimeline = [...(lead.timeline || []), newEvent];

    // Update lead
    const updateData = {
      current_status: newStatus,
      timeline: updatedTimeline,
      follow_up_needed: false,
      property_feedback: property_feedback, // Store feedback for reference
    };

    const { data: updated, error: updateErr } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      message: `Tour confirmation received for ${touredCount} property/ies`,
      lead: updated,
    });
  } catch (err) {
    console.error("Error confirming tour:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
