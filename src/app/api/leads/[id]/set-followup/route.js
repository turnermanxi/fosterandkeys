import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyLeadOwnership } from "@/lib/api-auth";

/**
 * POST /api/leads/[id]/set-followup
 * 
 * Sets a follow-up reminder for a lead (e.g., if client is delayed)
 * REQUIRES: User authenticated and lead belongs to their account
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const authCheck = await verifyLeadOwnership(id);
    if (authCheck.error) return authCheck.response;
    const { reminder_at } = await request.json();
    const supabase = getSupabaseAdmin();

    if (!reminder_at) {
      return NextResponse.json(
        { error: "reminder_at required" },
        { status: 400 }
      );
    }

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

    // Create timeline event
    const newEvent = {
      stage: "follow_up_set",
      timestamp: new Date().toISOString(),
      notes: `Follow-up reminder set for ${new Date(reminder_at).toLocaleDateString()}`,
      visibility: "agent_only",
    };

    const updatedTimeline = [...(lead.timeline || []), newEvent];

    // Update lead with follow-up flag
    const { data: updated, error: updateErr } = await supabase
      .from("leads")
      .update({
        follow_up_needed: true,
        follow_up_reminder_at: reminder_at,
        timeline: updatedTimeline,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      message: "Follow-up reminder set",
      lead: updated,
    });
  } catch (err) {
    console.error("Error setting follow-up:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
