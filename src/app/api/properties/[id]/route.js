import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCurrentAccountId } from "@/lib/accounts";

/**
 * PATCH /api/properties/[id]
 * Update a property
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const accountId = await getCurrentAccountId();
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    console.log("PATCH /api/properties/[id]", { id, accountId, body });

    // Check if this is an apartment (id starts with "apt_")
    if (id.startsWith("apt_")) {
      const apartmentId = id.replace("apt_", "");
      console.log("Updating apartment:", apartmentId);

      // Update the apartments table with acceptance criteria and fees
      const { data: apartment, error: aptUpdateErr } = await supabase
        .from("apartments")
        .update({
          name: body.property_name,
          address: body.address,
          city: body.city,
          state: body.state,
          zip: body.zip,
          notes: body.notes,
          specials: body.specials,
          admin_fee: body.admin_fee,
          app_fee: body.app_fee,
          url: body.website,
          pet_friendly: body.pet_friendly,
          accepts_eviction: body.accepts_evictions,
          accepts_broken_lease: body.accepts_broken_leases,
          accepts_low_credit: body.accepts_low_credit,
          accepts_itin: body.accepts_itin,
          accepts_second_chance: body.accepts_second_chance,
          deposit_info: body.deposit_info,
          property_type: body.property_type,
        })
        .eq("id", apartmentId)
        .select()
        .single();

      if (aptUpdateErr) throw aptUpdateErr;

      // Also update the first unit with pricing and unit details (if any units exist)
      if (body.price_min !== null || body.price_max !== null || body.bedrooms || body.bathrooms) {
        const { data: units } = await supabase
          .from("units")
          .select("id")
          .eq("apartment_id", apartmentId)
          .order("id", { ascending: true })
          .limit(1);

        if (units && units.length > 0) {
          const firstUnitId = units[0].id;
          await supabase
            .from("units")
            .update({
              bedrooms: body.bedrooms ? parseInt(body.bedrooms) : null,
              bathrooms: body.bathrooms ? parseFloat(body.bathrooms) : null,
              rent_min: body.price_min,
              rent_max: body.price_max,
            })
            .eq("id", firstUnitId);
        }
      }

      return NextResponse.json({
        success: true,
        property: apartment,
      });
    }

    // Otherwise, handle as a regular property (UUID id)
    // Verify ownership
    const { data: existing, error: selectErr } = await supabase
      .from("properties")
      .select("id")
      .eq("id", id)
      .eq("account_id", accountId)
      .single();

    console.log("Existing property check:", { existing, selectErr });

    if (selectErr || !existing) {
      console.error("Property lookup failed:", selectErr?.message || "Property not found");
      return NextResponse.json(
        { error: "Property not found or unauthorized" },
        { status: 404 }
      );
    }

    // Update the property
    const { data: property, error: updateErr } = await supabase
      .from("properties")
      .update({
        property_name: body.property_name,
        address: body.address,
        city: body.city,
        state: body.state,
        zip: body.zip,
        lat: body.lat,
        lng: body.lng,
        price_min: body.price_min,
        price_max: body.price_max,
        bedrooms: body.bedrooms,
        bedrooms_min: body.bedrooms_min,
        bedrooms_max: body.bedrooms_max,
        bathrooms: body.bathrooms,
        sqft: body.sqft,
        sqft_min: body.sqft_min,
        sqft_max: body.sqft_max,
        studio_price_min: body.studio_price_min,
        studio_price_max: body.studio_price_max,
        bedroom_1_price_min: body.bedroom_1_price_min,
        bedroom_1_price_max: body.bedroom_1_price_max,
        bedroom_2_price_min: body.bedroom_2_price_min,
        bedroom_2_price_max: body.bedroom_2_price_max,
        bedroom_3_price_min: body.bedroom_3_price_min,
        bedroom_3_price_max: body.bedroom_3_price_max,
        property_type: body.property_type,
        pet_friendly: body.pet_friendly,
        accepts_evictions: body.accepts_evictions,
        accepts_broken_leases: body.accepts_broken_leases,
        accepts_low_credit: body.accepts_low_credit,
        accepts_itin: body.accepts_itin,
        accepts_second_chance: body.accepts_second_chance,
        admin_fee: body.admin_fee,
        app_fee: body.app_fee,
        deposit_info: body.deposit_info,
        amenities: body.amenities,
        notes: body.notes,
        contact_name: body.contact_name,
        contact_phone: body.contact_phone,
        contact_email: body.contact_email,
        website: body.website,
        source_url: body.source_url,
        is_active: body.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      property,
    });
  } catch (err) {
    console.error("PATCH /api/properties/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/properties/[id]
 * Archive (soft delete) or permanently delete a property
 *
 * Query param:
 *   - hard=true for permanent deletion
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const accountId = await getCurrentAccountId();
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const hardDelete = url.searchParams.get("hard") === "true";

    // Check if this is an apartment (id starts with "apt_")
    if (id.startsWith("apt_")) {
      const apartmentId = id.replace("apt_", "");
      console.log("Deleting apartment:", apartmentId);

      if (hardDelete) {
        // Permanent deletion
        const { error: deleteErr } = await supabase
          .from("apartments")
          .delete()
          .eq("id", apartmentId);

        if (deleteErr) throw deleteErr;
      } else {
        // For apartments, we'll just delete them directly (no soft delete concept)
        const { error: deleteErr } = await supabase
          .from("apartments")
          .delete()
          .eq("id", apartmentId);

        if (deleteErr) throw deleteErr;
      }

      return NextResponse.json({
        success: true,
      });
    }

    // Otherwise, handle as a regular property (UUID id)
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

    if (hardDelete) {
      // Permanent deletion
      const { error: deleteErr } = await supabase
        .from("properties")
        .delete()
        .eq("id", id);

      if (deleteErr) throw deleteErr;
    } else {
      // Soft archive
      const { error: archiveErr } = await supabase
        .from("properties")
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (archiveErr) throw archiveErr;
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error("DELETE /api/properties/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
