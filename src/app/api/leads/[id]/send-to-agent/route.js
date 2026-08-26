import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendAgentNotificationEmail } from "@/lib/mailer";
import { verifyLeadOwnership } from "@/lib/api-auth";

/**
 * POST /api/leads/[id]/send-to-agent
 * 
 * Lorenzo forwards a lead to another agent via email
 * Updates the lead with the agent's email and creates timeline event
 * 
 * REQUIRES: User to be authenticated and lead to belong to their account
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;

    // Verify lead ownership first
    const authCheck = await verifyLeadOwnership(id);
    if (authCheck.error) return authCheck.response;

    const { agent_email, agent_name = "Agent" } = await request.json();
    const supabase = getSupabaseAdmin();

    if (!agent_email || !agent_email.includes("@")) {
      return NextResponse.json(
        { error: "Valid agent email required" },
        { status: 400 }
      );
    }

    // Fetch full lead data
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

    // Create timeline event
    const newEvent = {
      stage: "forwarded_to_agent",
      timestamp: new Date().toISOString(),
      notes: `Lead forwarded to ${agent_name} (${agent_email})`,
      data: {
        forwarded_to_agent: agent_email,
        forwarded_to_agent_name: agent_name,
      },
      visibility: "admin",
    };

    const updatedTimeline = [...(lead.timeline || []), newEvent];

    // Update lead with agent email
    const { data: updated, error: updateErr } = await supabase
      .from("leads")
      .update({
        assigned_agent_email: agent_email,
        current_status: "forwarded_to_agent",
        timeline: updatedTimeline,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Send notification email to the agent
    try {
      await sendAgentNotificationEmail({
        to: agent_email,
        agent_name: agent_name,
        lead: {
          id: lead.id,
          name: lead.full_name,
          email: lead.email,
          phone: lead.phone,
          budget_min: lead.budget_min,
          budget_max: lead.budget_max,
          bedrooms: lead.bedrooms,
          bathrooms: lead.bathrooms,
          desired_location: lead.desired_location,
          move_in_timeline: lead.move_in_timeline,
          notes: lead.notes,
          current_round: lead.current_round,
          cx_feedback: lead.cx_feedback,
          timeline: lead.timeline,
        },
        fromAgent: "Lorenzo Foster",
      });
    } catch (emailErr) {
      console.error("Error sending agent notification:", emailErr);
      // Don't throw - lead was still updated successfully
    }

    return NextResponse.json({
      success: true,
      message: `Lead forwarded to ${agent_email}. Notification email sent.`,
      lead: updated,
    });
  } catch (err) {
    console.error("Error sending to agent:", err);
    return NextResponse.json(
      { error: err.message || "Failed to send to agent" },
      { status: 500 }
    );
  }
}
