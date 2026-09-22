import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { processNewLead } from "@/lib/lead-processing";
import { sendLeadNotificationEmail } from "@/lib/mailer";
import { v4 as uuidv4 } from "uuid";

/**
 * POST /api/webhook/wpform
 *
 * Direct JSON webhook — accepts structured lead data.
 * Also used for manual/test submissions.
 * For email-based intake use the Gmail IMAP poller (/api/cron/check-email).
 *
 * Account resolution (SaaS): pass `x-account-slug` (or `x-account-id`).
 * Auth for external callers:
 *   - If the account's intake form has a webhook_secret, it must be sent as
 *     `x-webhook-secret`.
 *   - If a global WEBHOOK_SECRET is configured and no per-account secret is
 *     set, the global secret is accepted (backwards compatibility).
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // --- Resolve target account from headers/slugs ---
    const accountSlug = request.headers.get("x-account-slug");
    const accountIdHeader = request.headers.get("x-account-id");
    const secret = request.headers.get("x-webhook-secret");

    let account = null;
    if (accountSlug || accountIdHeader) {
      let query = supabase.from("accounts").select("*");
      if (accountSlug) query = query.eq("slug", accountSlug).single();
      else query = query.eq("id", accountIdHeader).single();

      const { data, error } = await query;
      if (error || !data) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }
      if (data.status !== "active") {
        return NextResponse.json(
          { error: "Account is not active" },
          { status: 403 }
        );
      }
      account = data;
    }

    // --- Auth check ---
    if (process.env.WEBHOOK_SECRET || account) {
      let expectedSecret = process.env.WEBHOOK_SECRET || "";

      // Prefer the account's form webhook_secret when it exists
      if (account) {
        const { data: form } = await supabase
          .from("lead_forms")
          .select("webhook_secret")
          .eq("account_id", account.id)
          .eq("is_active", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .single();
        if (form?.webhook_secret) {
          expectedSecret = form.webhook_secret;
        }
      }

      if (expectedSecret && secret !== expectedSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const desiredLocations = Array.isArray(body.desired_locations)
      ? body.desired_locations.map((s) => String(s).trim()).filter(Boolean)
      : [];

    const lead = {
      full_name:        body.full_name        ?? body.name      ?? "",
      email:            body.email             ?? "",
      phone:            body.phone             ?? "",
      budget_min:       parseNum(body.budget_min),
      budget_max:       parseNum(body.budget_max),
      desired_location: desiredLocations.length
        ? desiredLocations.join("; ")
        : (body.desired_location ?? body.location ?? ""),
      bedrooms:         parseNum(body.bedrooms),
      bathrooms:        parseNum(body.bathrooms),
      move_in_timeline: body.move_in_timeline  ?? body.timeline  ?? "",
      notes:            body.notes             ?? body.additional_notes ?? "",
      results_token:    uuidv4(),
      current_status:   "created",
      account_id:       account?.id || process.env.DEFAULT_ACCOUNT_ID || null,
      timeline: [
        {
          stage: "created",
          timestamp: new Date().toISOString(),
          notes: "Lead created from form submission",
          visibility: "both",
        },
      ],
    };

    const result = await processNewLead(lead, {
      accountId: lead.account_id,
    });

    const notifyTo = process.env.LEAD_NOTIFICATION_EMAIL;
    if (notifyTo) {
      try {
        await sendLeadNotificationEmail({
          to: notifyTo,
          lead: result.lead,
          resultsUrl: result.resultsUrl,
          dashboardUrl: process.env.NEXT_PUBLIC_BASE_URL
            ? `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`
            : null,
        });
      } catch (notifyErr) {
        console.error("Lead notification email failed (non-fatal):", notifyErr);
      }
    }

    return NextResponse.json({
      success: true,
      lead_id: result.lead.id,
      results_url: result.resultsUrl,
      matches: result.matchCount,
      units_evaluated: result.unitsEvaluated,
      ai_summary: result.aiSummary,
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