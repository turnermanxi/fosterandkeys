import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCurrentAccountId } from "@/lib/accounts";

/**
 * GET /api/email-templates
 * Get all email templates for the current account
 */
export async function GET() {
  try {
    const accountId = await getCurrentAccountId();
    const supabase = getSupabaseAdmin();

    const { data: templates, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      templates: templates || [],
    });
  } catch (err) {
    console.error("GET /api/email-templates error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/email-templates
 * Create a new email template
 *
 * Body:
 *   - name (required)
 *   - subject (required)
 *   - body (required) - HTML template with {{placeholder}} support
 *   - is_default (optional, default false)
 */
export async function POST(request) {
  try {
    const accountId = await getCurrentAccountId();
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    if (!body.name || !body.subject || !body.body) {
      return NextResponse.json(
        { error: "name, subject, and body are required" },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults first
    if (body.is_default) {
      await supabase
        .from("email_templates")
        .update({ is_default: false })
        .eq("account_id", accountId);
    }

    const { data: template, error: createErr } = await supabase
      .from("email_templates")
      .insert({
        account_id: accountId,
        name: body.name,
        subject: body.subject,
        body: body.body,
        is_default: body.is_default || false,
      })
      .select()
      .single();

    if (createErr) throw createErr;

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (err) {
    console.error("POST /api/email-templates error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
