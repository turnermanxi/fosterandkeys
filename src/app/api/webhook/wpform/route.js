import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { scoreLeadAgainstAll, validateUnitMatch } from "@/lib/scoring";
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
      current_status:   "created",
      account_id:       process.env.DEFAULT_ACCOUNT_ID || null,
      timeline: [{
        stage: "created",
        timestamp: new Date().toISOString(),
        notes: "Lead created from form submission",
        visibility: "both",
      }],
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

    // 5. Validate and filter matches
    const validationIssues = {};
    const filteredScored = scored
      .map((s) => {
        const validation = validateUnitMatch(newLead, s.unit, s.apartment);
        if (!validation.isValid) {
          if (!validationIssues[s.unit.id]) {
            validationIssues[s.unit.id] = validation;
          }
        }
        return { ...s, validation };
      })
      .filter((s) => {
        // Keep matches with score > 30, or if no location was specified keep all
        if (!newLead.desired_location) return s.score > 30;
        // If location was specified, exclude matches with major location mismatches
        const hasLocationMismatch = s.validation.issues.some(i => i.includes("Location"));
        return !hasLocationMismatch && s.score > 25;
      });

    // Log validation issues for debugging
    if (Object.keys(validationIssues).length > 0) {
      console.log(`Lead ${newLead.id} - Validation issues:`, validationIssues);
    }

    // 6. Persist matches (limit to top 5-7)
    const topScored = filteredScored.slice(0, 7); // Take top 7 valid matches
    const matches = topScored.map((s) => ({
      lead_id: newLead.id,
      unit_id: s.unit.id,
      apartment_id: s.unit.apartment_id,
      score: s.score,
    }));

    if (matches.length) {
      // First delete any existing matches for these units
      const unitIds = matches.map(m => m.unit_id);
      await supabase
        .from("lead_matches")
        .delete()
        .eq("lead_id", newLead.id)
        .in("unit_id", unitIds);

      // Then insert the new matches
      const { error: matchErr } = await supabase
        .from("lead_matches")
        .insert(matches);
      if (matchErr) throw matchErr;
    }

    // 7. Generate AI summary
    let aiSummary = "";
    try {
      const topMatches = filteredScored.slice(0, 5);
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
