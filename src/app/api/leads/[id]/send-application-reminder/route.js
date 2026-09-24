import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendApplicationReminderEmail } from "@/lib/mailer";
import { verifyLeadOwnership } from "@/lib/api-auth";

/**
 * POST /api/leads/[id]/send-application-reminder
 * 
 * Send application reminder email after tour is completed
 * REQUIRES: User authenticated and lead belongs to their account
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const authCheck = await verifyLeadOwnership(id);
    if (authCheck.error) return authCheck.response;
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

    // Get currently selected/toured properties from lead_matches. Older code
    // used lead.recommended_units, but the live client-selection flow writes to
    // lead_matches.cx_response/toured_status.
    const { data: selectedMatches, error: selectedErr } = await supabase
      .from("lead_matches")
      .select("unit_id, property_id, apartment_id, cx_response, toured_status, units(id), apartments(id, name), properties(id, property_name)")
      .eq("lead_id", id)
      .or("cx_response.eq.interested,toured_status.eq.toured");

    if (selectedErr) throw selectedErr;

    const properties = (selectedMatches || [])
      .map((match) => ({
        name:
          match.apartments?.name ||
          match.properties?.property_name ||
          "Property",
      }))
      .filter((property, index, arr) =>
        property.name &&
        property.name !== "Property"
          ? arr.findIndex((p) => p.name === property.name) === index
          : true
      );

    // Create timeline event
    const newEvent = {
      stage: "application_pending",
      timestamp: new Date().toISOString(),
      notes: "Application reminder email sent to client",
      visibility: "both",
    };

    const updatedTimeline = [...(lead.timeline || []), newEvent];

    // Update lead
    const { data: updated, error: updateErr } = await supabase
      .from("leads")
      .update({
        current_status: "application_pending",
        timeline: updatedTimeline,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Send application reminder email
    try {
      const decisionUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/application-decision/${lead.results_token}`;
      
      await sendApplicationReminderEmail({
        to: lead.email,
        clientName: lead.full_name,
        properties,
        decisionUrl,
        agentName: "Lorenzo Foster",
      });
    } catch (emailErr) {
      console.error("Error sending application reminder email:", emailErr);
      // Don't fail if email fails
    }

    return NextResponse.json({
      success: true,
      message: "Application reminder email sent",
      lead: updated,
    });
  } catch (err) {
    console.error("Error sending application reminder:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
