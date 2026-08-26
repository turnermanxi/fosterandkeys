import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCurrentAccountId } from "@/lib/accounts";

/**
 * PATCH /api/email-templates/[id]
 * Update an email template
 */
export async function PATCH(request, { params }) {
  try {
    const accountId = await getCurrentAccountId();
    const supabase = getSupabaseAdmin();
    const { id } = params;
    const body = await request.json();

    // Verify ownership
    const { data: existing } = await supabase
      .from("email_templates")
      .select("id")
      .eq("id", id)
      .eq("account_id", accountId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Template not found or unauthorized" },
        { status: 404 }
      );
    }

    // If setting as default, unset other defaults first
    if (body.is_default) {
      await supabase
        .from("email_templates")
        .update({ is_default: false })
        .eq("account_id", accountId)
        .neq("id", id);
    }

    const { data: template, error: updateErr } = await supabase
      .from("email_templates")
      .update({
        name: body.name,
        subject: body.subject,
        body: body.body,
        is_default: body.is_default,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (err) {
    console.error("PATCH /api/email-templates/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/email-templates/[id]
 * Delete an email template
 */
export async function DELETE(request, { params }) {
  try {
    const accountId = await getCurrentAccountId();
    const supabase = getSupabaseAdmin();
    const { id } = params;

    // Verify ownership
    const { data: existing } = await supabase
      .from("email_templates")
      .select("id")
      .eq("id", id)
      .eq("account_id", accountId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Template not found or unauthorized" },
        { status: 404 }
      );
    }

    const { error: deleteErr } = await supabase
      .from("email_templates")
      .delete()
      .eq("id", id);

    if (deleteErr) throw deleteErr;

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error("DELETE /api/email-templates/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
