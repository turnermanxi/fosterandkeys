import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fetchUnreadEmails } from "@/lib/gmail";
import { parseEmailToLead, generateMatchSummary } from "@/lib/openai";
import { scoreLeadAgainstAll, validateUnitMatch } from "@/lib/scoring";
import { v4 as uuidv4 } from "uuid";

/**
 * POST /api/cron/check-email
 *
 * Connects to Gmail via IMAP, pulls all unread emails, parses each
 * one with OpenAI, scores against units, and creates lead records.
 *
 * Can be triggered by:
 *   - A cron job (e.g. every 5 minutes)
 *   - The "Check for New Leads" button on the dashboard
 *
 * Auth: x-webhook-secret header or CRON_SECRET query param
 *
 * Optional query params:
 *   - folder: IMAP folder to check (default: INBOX)
 *   - filter: subject substring filter (e.g. "New Lead")
 */
export async function POST(request) {
  try {
    // --- Auth check ---
    // External callers (cron jobs) must provide the secret.
    // Dashboard calls from the browser don't send a secret — that's OK.
    const secret = request.headers.get("x-webhook-secret");
    const url = new URL(request.url);
    const cronSecret = url.searchParams.get("secret");
    const hasSecret = secret || cronSecret;

    if (
      hasSecret &&
      process.env.WEBHOOK_SECRET &&
      secret !== process.env.WEBHOOK_SECRET &&
      cronSecret !== process.env.WEBHOOK_SECRET
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // --- Check that Gmail env vars are configured ---
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return NextResponse.json(
        { error: "GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env.local" },
        { status: 500 }
      );
    }

    // --- Options from request body or query params ---
    let opts = {};
    try {
      opts = await request.json();
    } catch {
      // no body, that's fine
    }

    const folder = opts.folder || url.searchParams.get("folder") || "INBOX";
    const filter = opts.filter || url.searchParams.get("filter") || "";

    // --- Fetch unread emails from Gmail ---
    const emails = await fetchUnreadEmails({ folder, filter: filter || undefined });

    if (emails.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No new emails found",
        processed: 0,
      });
    }

    const supabase = getSupabaseAdmin();

    // Pre-fetch apartments & units once (shared across all emails)
    const { data: apartments, error: aptErr } = await supabase
      .from("apartments")
      .select("*");
    if (aptErr) throw aptErr;

    const apartmentMap = {};
    (apartments ?? []).forEach((a) => (apartmentMap[a.id] = a));

    const { data: units, error: unitErr } = await supabase
      .from("units")
      .select("*");
    if (unitErr) throw unitErr;

    // --- Process each email ---
    const results = [];

    for (const email of emails) {
      try {
        // Prefer text body, fall back to HTML
        const emailContent = email.textBody || email.htmlBody || "";

        if (emailContent.trim().length < 10) {
          results.push({
            uid: email.uid,
            subject: email.subject,
            status: "skipped",
            reason: "Email body too short",
          });
          continue;
        }

        // 1. OpenAI parses the email
        const parsed = await parseEmailToLead(emailContent);

        // Build lead object
        const lead = {
          full_name:        parsed.full_name        || email.from || "Unknown",
          email:            parsed.email             || email.from || null,
          phone:            parsed.phone             || null,
          budget_min:       toNum(parsed.budget_min),
          budget_max:       toNum(parsed.budget_max),
          desired_location: parsed.desired_location  || null,
          bedrooms:         toNum(parsed.bedrooms),
          bathrooms:        toNum(parsed.bathrooms),
          move_in_timeline: parsed.move_in_timeline  || null,
          notes:            parsed.notes             || null,
          raw_email:        emailContent.substring(0, 10000),
          results_token:    uuidv4(),
          current_status:   "created",
          timeline: [{
            stage: "created",
            timestamp: new Date().toISOString(),
            notes: "Lead created from email submission",
            visibility: "both",
          }],
        };

        // 2. Insert lead
        const { data: newLead, error: leadErr } = await supabase
          .from("leads")
          .insert(lead)
          .select()
          .single();

        if (leadErr) throw leadErr;

        // 3. Score
        const scored = scoreLeadAgainstAll(newLead, units ?? [], apartmentMap);

        // 4. Validate and filter matches
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

        // 5. Persist matches (limit to top 5-7)
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

        // 6. Generate AI summary
        let aiSummary = "";
        try {
          const topMatches = filteredScored.slice(0, 5);
          aiSummary = await generateMatchSummary(newLead, topMatches);

          await supabase
            .from("leads")
            .update({ ai_summary: aiSummary })
            .eq("id", newLead.id);
        } catch (aiErr) {
          console.error("AI summary failed (non-fatal):", aiErr);
        }

        results.push({
          uid: email.uid,
          subject: email.subject,
          status: "processed",
          lead_id: newLead.id,
          matches: scored.length,
          results_url: `${process.env.NEXT_PUBLIC_BASE_URL}/results/${newLead.results_token}`,
        });
      } catch (emailErr) {
        console.error(`Failed to process email UID ${email.uid}:`, emailErr);
        results.push({
          uid: email.uid,
          subject: email.subject,
          status: "error",
          error: emailErr.message,
        });
      }
    }

    const processed = results.filter((r) => r.status === "processed").length;
    const errored = results.filter((r) => r.status === "error").length;

    return NextResponse.json({
      success: true,
      message: `Processed ${processed} email(s)${errored ? `, ${errored} error(s)` : ""}`,
      processed,
      total: emails.length,
      results,
    });
  } catch (err) {
    console.error("check-email error:", err);
    return NextResponse.json(
      { error: err.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

function toNum(val) {
  if (val == null || val === "") return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}
