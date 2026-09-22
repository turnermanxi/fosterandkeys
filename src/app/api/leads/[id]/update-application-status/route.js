import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyLeadOwnership } from "@/lib/api-auth";

/**
 * POST /api/leads/[id]/update-application-status
 * 
 * Update lead's application status with per-property decisions
 * REQUIRES: User authenticated and lead belongs to their account
 * 
 * Body:
 * {
 *   decision: "approved" | "denied" | "mixed",
 *   approvedUnits: [{unit_id, apartment_name, bedrooms, bathrooms, rent_range}, ...],
 *   deniedUnits: [{unit_id, apartment_name, bedrooms, bathrooms, rent_range, denial_reason}, ...],
 *   newSelections: ["unit_id1", ...] // for reapplication if denied some
 * }
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { decision, approvedUnits, deniedUnits, newSelections, token = null } = body;

    // Authorize via the agent's account OR the client's results_token
    const authCheck = await verifyLeadOwnership(id, token);
    if (authCheck.error) return authCheck.response;

    if (!decision || !["approved", "denied", "mixed"].includes(decision)) {
      return NextResponse.json(
        { error: "Decision must be 'approved', 'denied', or 'mixed'" },
        { status: 400 }
      );
    }

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

    // Determine final decision status based on approved/denied counts
    let finalDecision = decision;
    if (!finalDecision || finalDecision === "mixed") {
      const hasApproved = approvedUnits && approvedUnits.length > 0;
      const hasDenied = deniedUnits && deniedUnits.length > 0;
      
      if (hasApproved && !hasDenied) {
        finalDecision = "approved";
      } else if (hasDenied && !hasApproved) {
        finalDecision = "denied";
      } else {
        finalDecision = "mixed";
      }
    }

    // Build application_status object with property-level decisions
    const applicationStatus = {
      status: finalDecision,
      decision: finalDecision,
      decision_at: new Date().toISOString(),
    };

    // Add property-level tracking
    if (approvedUnits && Array.isArray(approvedUnits) && approvedUnits.length > 0) {
      applicationStatus.approved_units = approvedUnits;
    }
    if (deniedUnits && Array.isArray(deniedUnits) && deniedUnits.length > 0) {
      applicationStatus.denied_units = deniedUnits;
    }

    // Update recommended_units to reflect decisions
    let updatedRecommendedUnits = (lead.recommended_units || []).map((unit) => {
      const approvedUnit = approvedUnits?.find(u => u.unit_id === unit.unit_id);
      const deniedUnit = deniedUnits?.find(u => u.unit_id === unit.unit_id);

      if (approvedUnit) {
        // Mark as approved
        return { ...unit, cx_response: "approved" };
      } else if (deniedUnit) {
        // Mark as explicitly denied
        return { ...unit, cx_response: "denied" };
      }
      return unit;
    });

    // If there are new selections (reapplication), add them to recommended_units
    if (newSelections && Array.isArray(newSelections) && newSelections.length > 0) {
      updatedRecommendedUnits = updatedRecommendedUnits.map((unit) => {
        if (newSelections.includes(unit.unit_id)) {
          return { ...unit, cx_response: "interested" };
        }
        return unit;
      });
    }

    // Determine new status
    let newStatus;
    if (finalDecision === "approved") {
      newStatus = "approved";
    } else if (finalDecision === "denied" && newSelections && newSelections.length > 0) {
      newStatus = "cx_responded"; // Client has selected new properties to try
    } else if (finalDecision === "denied") {
      newStatus = "denied";
    } else {
      newStatus = "cx_responded"; // Mixed decision
    }

    // Create timeline event with property-level details
    const approvedNames = approvedUnits?.map(u => u.apartment_name).join(", ") || "";
    const deniedNames = deniedUnits?.map(u => u.apartment_name).join(", ") || "";
    
    let notes = "";
    if (finalDecision === "approved") {
      notes = `Client approved for application${approvedNames ? `: ${approvedNames}` : ""}`;
    } else if (finalDecision === "denied") {
      notes = `Client denied${deniedNames ? ` for: ${deniedNames}` : ""}`;
    } else {
      notes = `Client approved for: ${approvedNames}; Denied for: ${deniedNames}`;
    }

    const newEvent = {
      stage: finalDecision === "approved" ? "application_approved" : finalDecision === "denied" ? "application_denied" : "application_mixed",
      timestamp: new Date().toISOString(),
      notes,
      data: {
        decision: finalDecision,
        approved_units: approvedUnits || [],
        denied_units: deniedUnits || [],
        reselected_units: newSelections || [],
      },
      visibility: "both",
    };

    const updatedTimeline = [...(lead.timeline || []), newEvent];

    // Update lead
    const { data: updated, error: updateErr } = await supabase
      .from("leads")
      .update({
        application_status: applicationStatus,
        recommended_units: updatedRecommendedUnits,
        current_status: newStatus,
        timeline: updatedTimeline,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      message: `Application decision received: ${finalDecision}${newSelections?.length ? ` with ${newSelections.length} properties selected for reapplication` : ""}`,
      lead: updated,
    });
  } catch (err) {
    console.error("Error updating application status:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
