import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCurrentAccountId } from "@/lib/accounts";

/**
 * PATCH /api/properties/[id]/favorite
 * Toggle the is_favorite flag for a property
 *
 * Body: { "is_favorite": true|false }
 */
export async function PATCH(request, { params }) {
  try {
    const accountId = await getCurrentAccountId();
    const supabase = getSupabaseAdmin();
    const { id } = params;
    const { is_favorite } = await request.json();

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

    // Update favorite status
    const { data: property, error: updateErr } = await supabase
      .from("properties")
      .update({ is_favorite })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      is_favorite: property.is_favorite,
    });
  } catch (err) {
    console.error("PATCH /api/properties/[id]/favorite error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
