import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendResultsEmail } from "@/lib/mailer";

/**
 * POST /api/leads/[id]/send
 *
 * Sends the results email to the client, marks the lead as "sent",
 * and returns the client results URL.
 *
 * Optional JSON body:
 *   { "ai_summary": "edited summary text" }
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Parse optional body (edited AI summary)
    let body = {};
    try {
      body = await request.json();
    } catch {
      // no body is fine
    }

    // Get the lead
    const { data: lead, error: fetchErr } = await supabase
      .from("leads")
      .select("id, full_name, email, results_token, status, ai_summary")
      .eq("id", id)
      .single();

    if (fetchErr || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!lead.email) {
      return NextResponse.json(
        { error: "Lead has no email address" },
        { status: 400 }
      );
    }

    const resultsUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/results/${lead.results_token}`;

    // Use the edited summary if provided, otherwise fall back to stored
    const aiSummary = body.ai_summary ?? lead.ai_summary ?? "";

    // If the summary was edited, persist the update
    if (body.ai_summary && body.ai_summary !== lead.ai_summary) {
      await supabase
        .from("leads")
        .update({ ai_summary: body.ai_summary })
        .eq("id", id);
    }

    // Send the email
    await sendResultsEmail({
      to: lead.email,
      clientName: lead.full_name,
      resultsUrl,
      aiSummary,
      agentName: "Lorenzo Foster",
    });

    // Update status to "sent"
    const { error: updateErr } = await supabase
      .from("leads")
      .update({ status: "sent" })
      .eq("id", id);

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      results_url: resultsUrl,
    });
  } catch (err) {
    console.error("Send error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
