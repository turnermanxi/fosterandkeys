import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { addTimelineEvent, PIPELINE_STAGES } from "@/lib/pipelineHelpers";
import { sendResultsEmail } from "@/lib/mailer";
import { verifyLeadOwnership } from "@/lib/api-auth";

/**
 * POST /api/leads/[id]/update-status
 * Updates a lead's pipeline status and adds a timeline event
 * Sends email if transitioning to "recommended_sent"
 * 
 * REQUIRES: User to be authenticated and lead to belong to their account
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;

    // Verify lead ownership first
    const authCheck = await verifyLeadOwnership(id);
    if (authCheck.error) return authCheck.response;

    const { status, notes } = await request.json();

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    // Add timeline event and update status
    const supabase = getSupabaseAdmin();

    // Get current lead
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

    // Get current timeline
    const currentTimeline = lead.timeline || [];

    // Create new timeline event
    const newEvent = {
      stage: status,
      timestamp: new Date().toISOString(),
      notes: notes || `Status updated to ${status}`,
      visibility: "both",
    };

    const updatedTimeline = [...currentTimeline, newEvent];

    // Update lead
    const { data: updated, error: updateErr } = await supabase
      .from("leads")
      .update({
        timeline: updatedTimeline,
        current_status: status,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Send email if transitioning to recommended_sent (for new round recommendations)
    if (status === "recommended_sent") {
      try {
        // Get the matches to include in email
        const { data: matches } = await supabase
          .from("lead_matches")
          .select("id, unit_id, property_id, apartment_id, units(*), apartments(*), properties(*)")
          .eq("lead_id", id)
          .eq("cx_response", "interested");

        // Build properties array for email
        const emailProperties = (matches || []).map((match) => {
          if (match.unit_id && match.units && match.apartments) {
            return {
              property_name: match.apartments.name,
              address: match.apartments.address || "",
              bedrooms: match.units.bedrooms,
              bathrooms: match.units.bathrooms,
              price_min: match.units.rent_min,
              price_max: match.units.rent_max,
            };
          } else if (match.property_id && match.properties) {
            return {
              property_name: match.properties.property_name || "Property",
              address: match.properties.address || "",
              bedrooms: match.properties.bedrooms,
              bathrooms: match.properties.bathrooms,
              price_min: match.properties.price_min,
              price_max: match.properties.price_max,
            };
          } else if (match.apartment_id && match.apartments) {
            return {
              property_name: match.apartments.name || "Apartment",
              address: match.apartments.address || "",
              bedrooms: match.apartments.bedrooms,
              bathrooms: match.apartments.bathrooms,
            };
          }
          return null;
        }).filter(Boolean);

        // Send email to client with recommendations
        await sendResultsEmail({
          to: lead.email,
          clientName: lead.full_name,
          resultsUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/results/${lead.results_token}`,
          aiSummary: lead.ai_summary || `Here are recommended properties for you (Round ${lead.current_round || 1}).`,
          properties: emailProperties,
          agentName: "Lorenzo Foster",
        });

        console.log(`Sent recommendations email for lead ${id} (Round ${lead.current_round || 1})`);
      } catch (emailErr) {
        console.error("Error sending recommendations email:", emailErr);
        // Don't fail the status update if email fails
      }
    }

    return NextResponse.json({
      success: true,
      lead: updated,
    });
  } catch (err) {
    console.error("Error updating lead status:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
