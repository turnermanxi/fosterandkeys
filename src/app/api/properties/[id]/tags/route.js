import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCurrentAccountId } from "@/lib/accounts";

/**
 * POST /api/properties/[id]/tags
 * Add a tag to a property
 *
 * Body: { "tag": "pet-friendly" }
 */
export async function POST(request, { params }) {
  try {
    const accountId = await getCurrentAccountId();
    const supabase = getSupabaseAdmin();
    const { id } = params;
    const { tag } = await request.json();

    if (!tag || typeof tag !== "string") {
      return NextResponse.json(
        { error: "tag is required and must be a string" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from("properties")
      .select("id")
      .eq("id", id)
      .eq("account_id", accountId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Property not found or unauthorized" },
        { status: 404 }
      );
    }

    // Add tag (will ignore if duplicate due to UNIQUE constraint)
    const { error: insertErr } = await supabase
      .from("property_tags")
      .insert({
        property_id: id,
        account_id: accountId,
        tag: tag.toLowerCase(),
      });

    if (insertErr && !insertErr.message.includes("duplicate")) {
      throw insertErr;
    }

    // Get all tags for this property
    const { data: tags } = await supabase
      .from("property_tags")
      .select("tag")
      .eq("property_id", id)
      .order("created_at");

    return NextResponse.json({
      success: true,
      tags: (tags || []).map((t) => t.tag),
    });
  } catch (err) {
    console.error("POST /api/properties/[id]/tags error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/properties/[id]/tags/[tag]
 * Remove a tag from a property
 */
export async function DELETE(request, { params }) {
  try {
    const accountId = await getCurrentAccountId();
    const supabase = getSupabaseAdmin();
    const { id, tag } = params;

    // Verify ownership
    const { data: existing } = await supabase
      .from("properties")
      .select("id")
      .eq("id", id)
      .eq("account_id", accountId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Property not found or unauthorized" },
        { status: 404 }
      );
    }

    // Remove tag
    const { error: deleteErr } = await supabase
      .from("property_tags")
      .delete()
      .eq("property_id", id)
      .eq("tag", tag.toLowerCase());

    if (deleteErr) throw deleteErr;

    // Get remaining tags
    const { data: tags } = await supabase
      .from("property_tags")
      .select("tag")
      .eq("property_id", id)
      .order("created_at");

    return NextResponse.json({
      success: true,
      tags: (tags || []).map((t) => t.tag),
    });
  } catch (err) {
    console.error("DELETE /api/properties/[id]/tags error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
