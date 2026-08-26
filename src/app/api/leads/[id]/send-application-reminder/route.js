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

    // Get the selected properties details (interested ones)
    const selectedUnitIds = (lead.recommended_units || [])
      .filter((r) => r.cx_response === "interested")
      .map((r) => r.unit_id);

    const { data: selectedUnits } = await supabase
      .from("units")
      .select("id, apartment_id")
      .in("id", selectedUnitIds);

    // Get apartment details for selected units
    const aptIds = (selectedUnits || []).map((u) => u.apartment_id);
    const { data: apartments } = await supabase
      .from("apartments")
      .select("id, name")
      .in("id", aptIds);

    const aptMap = {};
    (apartments || []).forEach((a) => (aptMap[a.id] = a));

    // Build properties array
    const properties = (selectedUnits || []).map((u) => {
      const apt = aptMap[u.apartment_id];
      return {
        name: apt?.name || "Unknown",
      };
    });

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
