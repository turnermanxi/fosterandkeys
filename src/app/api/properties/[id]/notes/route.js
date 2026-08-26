import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCurrentAccountId } from "@/lib/accounts";

/**
 * POST /api/properties/[id]/notes
 * Add a note to a property or apartment
 *
 * Body: { "note": "Contacted landlord today" }
 */
export async function POST(request, { params }) {
  try {
    const accountId = await getCurrentAccountId();
    const supabase = getSupabaseAdmin();
    const { id } = await params;
    const { note } = await request.json();
    console.log("POST /api/properties/[id]/notes - id:", id, "accountId:", accountId);

    if (!note || typeof note !== "string") {
      return NextResponse.json(
        { error: "note is required and must be a string" },
        { status: 400 }
      );
    }

    // Check if this is an apartment (id starts with "apt_")
    const isApartment = id.startsWith("apt_");
    const actualId = isApartment ? id.replace("apt_", "") : id;

    if (isApartment) {
      // For apartments, verify it exists
      const { data: existing } = await supabase
        .from("apartments")
        .select("id, notes")
        .eq("id", actualId)
        .single();

      if (!existing) {
        return NextResponse.json(
          { error: "Apartment not found" },
          { status: 404 }
        );
      }

      // For apartments, store notes as JSON in the notes field
      let existingNotes = [];
      if (existing.notes) {
        try {
          existingNotes = JSON.parse(existing.notes);
          if (!Array.isArray(existingNotes)) {
            existingNotes = [];
          }
        } catch (parseErr) {
          console.warn("Failed to parse apartment notes, starting fresh:", parseErr);
          existingNotes = [];
        }
      }

      const newNoteObj = {
        id: Math.random().toString(36).substring(7),
        note,
        created_by: accountId,
        created_at: new Date().toISOString(),
      };
      const updatedNotes = [...existingNotes, newNoteObj];

      const { error: updateErr } = await supabase
        .from("apartments")
        .update({ notes: JSON.stringify(updatedNotes) })
        .eq("id", actualId);

      if (updateErr) throw updateErr;

      return NextResponse.json({
        success: true,
        notes: updatedNotes,
      });
    } else {
      // For regular properties, verify ownership
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

      // Add note
      const { error: insertErr } = await supabase
        .from("property_notes")
        .insert({
          property_id: id,
          account_id: accountId,
          created_by: accountId,
          note,
        });

      if (insertErr) throw insertErr;

      // Get all notes (newest first)
      const { data: notes } = await supabase
        .from("property_notes")
        .select("id, note, created_by, created_at")
        .eq("property_id", id)
        .order("created_at", { ascending: false });

      return NextResponse.json({
        success: true,
        notes: notes || [],
      });
    }
  } catch (err) {
    console.error("POST /api/properties/[id]/notes error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/properties/[id]/notes
 * Get all notes for a property or apartment
 */
export async function GET(request, { params }) {
  try {
    const accountId = await getCurrentAccountId();
    const supabase = getSupabaseAdmin();
    const { id } = await params;

    // Check if this is an apartment
    const isApartment = id.startsWith("apt_");
    const actualId = isApartment ? id.replace("apt_", "") : id;

    if (isApartment) {
      // For apartments, verify it exists
      const { data: existing } = await supabase
        .from("apartments")
        .select("id, notes")
        .eq("id", actualId)
        .single();

      if (!existing) {
        return NextResponse.json(
          { error: "Apartment not found" },
          { status: 404 }
        );
      }

      // Get notes from apartment's notes field (stored as JSON)
      let notes = [];
      if (existing.notes) {
        try {
          notes = JSON.parse(existing.notes);
        } catch (parseErr) {
          console.warn("Failed to parse apartment notes, treating as empty:", parseErr);
          notes = [];
        }
      }
      
      return NextResponse.json({
        notes: notes || [],
      });
    } else {
      // For properties, verify ownership
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

      // Get all notes (newest first)
      const { data: notes } = await supabase
        .from("property_notes")
        .select("id, note, created_by, created_at")
        .eq("property_id", id)
        .order("created_at", { ascending: false });

      return NextResponse.json({
        notes: notes || [],
      });
    }
  } catch (err) {
    console.error("GET /api/properties/[id]/notes error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

