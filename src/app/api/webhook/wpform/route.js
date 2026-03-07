import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { scoreLeadAgainstAll } from "@/lib/scoring";
import { generateMatchSummary } from "@/lib/openai";
import { v4 as uuidv4 } from "uuid";

/**
 * POST /api/webhook/wpform
 *
 * Direct JSON webhook — accepts structured lead data.
 * Also used for manual/test submissions.
 * For email-based intake use the Gmail IMAP poller (/api/cron/check-email).
 */
export async function POST(request) {
  try {
    // --- Optional: verify shared secret ---
    const secret = request.headers.get("x-webhook-secret");
    if (
      process.env.WEBHOOK_SECRET &&
      secret !== process.env.WEBHOOK_SECRET
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const lead = {
      full_name:        body.full_name        ?? body.name      ?? "",
      email:            body.email             ?? "",
      phone:            body.phone             ?? "",
      budget_min:       parseNum(body.budget_min),
      budget_max:       parseNum(body.budget_max),
      desired_location: body.desired_location  ?? body.location  ?? "",
      bedrooms:         parseNum(body.bedrooms),
      bathrooms:        parseNum(body.bathrooms),
      move_in_timeline: body.move_in_timeline  ?? body.timeline  ?? "",
      notes:            body.notes             ?? body.additional_notes ?? "",
      results_token:    uuidv4(),
    };

    const supabase = getSupabaseAdmin();

    // 1. Insert the lead
    const { data: newLead, error: leadErr } = await supabase
      .from("leads")
      .insert(lead)
      .select()
      .single();

    if (leadErr) throw leadErr;

    // 2. Fetch all apartments
    const { data: apartments, error: aptErr } = await supabase
      .from("apartments")
      .select("*");
    if (aptErr) throw aptErr;

    const apartmentMap = {};
    (apartments ?? []).forEach((a) => (apartmentMap[a.id] = a));

    // 3. Fetch all units
    const { data: units, error: unitErr } = await supabase
      .from("units")
      .select("*");
    if (unitErr) throw unitErr;

    // 4. Score
    const scored = scoreLeadAgainstAll(newLead, units ?? [], apartmentMap);

    // 5. Persist matches
    const matches = scored.map((s) => ({
      lead_id: newLead.id,
      unit_id: s.unit.id,
      apartment_id: s.unit.apartment_id,
      score: s.score,
    }));

    if (matches.length) {
      const { error: matchErr } = await supabase
        .from("lead_matches")
        .upsert(matches, { onConflict: "lead_id,unit_id" });
      if (matchErr) throw matchErr;
    }

    // 6. Generate AI summary
    let aiSummary = "";
    try {
      const topMatches = scored.slice(0, 5);
      aiSummary = await generateMatchSummary(newLead, topMatches);
      await supabase
        .from("leads")
        .update({ ai_summary: aiSummary })
        .eq("id", newLead.id);
    } catch (aiErr) {
      console.error("AI summary generation failed (non-fatal):", aiErr);
    }

    return NextResponse.json({
      success: true,
      lead_id: newLead.id,
      results_url: `${process.env.NEXT_PUBLIC_BASE_URL}/results/${newLead.results_token}`,
      matches: scored.length,
      ai_summary: aiSummary,
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json(
      { error: err.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

function parseNum(val) {
  if (val == null || val === "") return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}
