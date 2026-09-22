import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fetchUnreadEmails } from "@/lib/gmail";
import { parseEmailToLead } from "@/lib/openai";
import { processNewLead, fetchAccountUnits } from "@/lib/lead-processing";
import { LEAD_NOTIFICATION_SUBJECT_PREFIX } from "@/lib/mailer";
import { v4 as uuidv4 } from "uuid";

/**
 * POST /api/cron/check-email
 *
 * Connects to Gmail via IMAP, pulls all unread emails, parses each
 * one with OpenAI, scores against the account's units, and creates
 * lead records.
 *
 * Can be triggered by:
 *   - A cron job (e.g. every 5 minutes)
 *   - The "Check for New Leads" button on the dashboard
 *
 * Auth: x-webhook-secret header or CRON_SECRET query param
 *
 * Account scoping (SaaS): pass `accountId` (query or body) to poll that
 * account's own Gmail config (gmail_configs table). When omitted, falls
 * back to the shared GMAIL_* env mailbox and DEFAULT_ACCOUNT_ID (admin legacy).
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

    // --- Options from request body or query params ---
    let opts = {};
    try {
      opts = await request.json();
    } catch {
      // no body, that's fine
    }

    const accountId =
      opts.accountId || url.searchParams.get("accountId") || null;

    const supabase = getSupabaseAdmin();

    // --- Resolve per-account Gmail config, falling back to shared env ---
    let gmailUser = process.env.GMAIL_USER;
    let gmailPass = process.env.GMAIL_APP_PASSWORD;
    let folder = opts.folder || url.searchParams.get("folder") || "INBOX";
    let filter = opts.filter || url.searchParams.get("filter") || "";
    let leadAccountId = process.env.DEFAULT_ACCOUNT_ID || null;

    if (accountId) {
      const { data: config } = await supabase
        .from("gmail_configs")
        .select("*")
        .eq("account_id", accountId)
        .single();

      if (!config?.gmail_user || !config?.app_password) {
        return NextResponse.json(
          { error: "No Gmail config for this account" },
          { status: 400 }
        );
      }
      gmailUser = config.gmail_user;
      gmailPass = config.app_password;
      folder = config.folder || folder;
      filter = config.subject_filter || filter;
      leadAccountId = accountId;
    }

    if (!gmailUser || !gmailPass) {
      return NextResponse.json(
        { error: "GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env.local" },
        { status: 500 }
      );
    }

    // --- Fetch unread emails from Gmail ---
    const emails = await fetchUnreadEmails({
      folder,
      filter: filter || undefined,
      user: gmailUser,
      pass: gmailPass,
    });

    if (emails.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No new emails found",
        processed: 0,
      });
    }

    // Pre-fetch the account's apartments & units once (shared across all emails)
    let sharedUnits = null;
    let sharedApartmentMap = null;
    async function ensureUnits() {
      if (sharedUnits !== null) return;
      const fetched = await fetchAccountUnits(leadAccountId);
      sharedUnits = fetched.units;
      sharedApartmentMap = fetched.apartmentMap;
    }

    // --- Process each email ---
    const results = [];

    for (const email of emails) {
      try {
        const fromAddr = (email.from || "").toLowerCase();
        const mailboxAddr = (gmailUser || "").toLowerCase();
        const subject = email.subject || "";

        if (fromAddr === mailboxAddr || subject.startsWith(LEAD_NOTIFICATION_SUBJECT_PREFIX)) {
          results.push({
            uid: email.uid,
            subject: email.subject,
            status: "skipped",
            reason: "Self-sent lead notification",
          });
          continue;
        }

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
          account_id:       leadAccountId,
          timeline: [{
            stage: "created",
            timestamp: new Date().toISOString(),
            notes: "Lead created from email submission",
            visibility: "both",
          }],
        };

        await ensureUnits();

        // 2. Insert, score, persist matches, generate summary
        const result = await processNewLead(lead, {
          accountId: leadAccountId,
          units: sharedUnits,
          apartmentMap: sharedApartmentMap,
        });

        results.push({
          uid: email.uid,
          subject: email.subject,
          status: "processed",
          lead_id: result.lead.id,
          matches: result.matchCount,
          results_url: result.resultsUrl,
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