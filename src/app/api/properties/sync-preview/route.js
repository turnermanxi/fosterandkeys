import { generateSyncPreview } from "@/lib/single-sync";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createSupabaseServer } from "@/lib/supabase-server";

/**
 * Resolve the authenticated user's account, throwing a Response-compatible
 * object { status, body } when unauthorized.
 */
async function requireAccount() {
  const supabaseServer = await createSupabaseServer();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();
  if (!user) {
    return { error: { message: "Unauthorized", status: 401 } };
  }

  const supabase = getSupabaseAdmin();
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!account) {
    return { error: { message: "Account not found", status: 404 } };
  }
  return { account };
}

async function resolveOwnedEntity(supabase, propertyId, accountId) {
  const isApartment = propertyId.startsWith("apt_");
  const actualId = isApartment ? propertyId.replace("apt_", "") : propertyId;

  let entity;
  let dbError;

  if (isApartment) {
    const { data, error } = await supabase
      .from("apartments")
      .select("id, name, city, url, property_type, units(bedrooms, bathrooms, rent_min, rent_max)")
      .eq("id", actualId)
      .eq("account_id", accountId)
      .single();
    entity = data;
    dbError = error;
    if (entity && !error) {
      const units = entity.units || [];
      const rentValues = units.map((u) => u.rent_min).filter((v) => v);
      const rentMaxValues = units.map((u) => u.rent_max).filter((v) => v);
      entity = {
        id: `apt_${entity.id}`,
        property_name: entity.name,
        city: entity.city,
        price_min: rentValues.length > 0 ? Math.min(...rentValues) : null,
        price_max: rentMaxValues.length > 0 ? Math.max(...rentMaxValues) : null,
        bedrooms: units[0]?.bedrooms || null,
        bathrooms: units[0]?.bathrooms || null,
        source_url: entity.url,
        property_type: entity.property_type || "apartment",
        _type: "apartment",
      };
    }
  } else {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .eq("account_id", accountId)
      .single();
    entity = data;
    dbError = error;
    if (entity && !error) entity._type = "property";
  }

  if (dbError || !entity) {
    return { error: { message: "Property not found", status: 404 } };
  }
  return { entity, isApartment };
}

/**
 * POST /api/properties/sync-preview
 * Get a preview of what would change for a property
 * Body: { propertyId, mode: 'simple' | 'advanced' }
 * Returns: { comparison, property, extractedData, sourceUrl, error?, mode, extractionMethod }
 */
export async function POST(req) {
  try {
    const { account, error: accountErr } = await requireAccount();
    if (accountErr) {
      return Response.json({ error: accountErr.message }, { status: accountErr.status });
    }

    const supabase = getSupabaseAdmin();

    const { propertyId, mode = 'simple' } = await req.json();

    if (!propertyId) {
      return Response.json({ error: "propertyId required" }, { status: 400 });
    }

    if (!['simple', 'advanced'].includes(mode)) {
      return Response.json({ error: "mode must be 'simple' or 'advanced'" }, { status: 400 });
    }

    // Resolve and verify ownership of the property/apartment
    const { entity: property, error: resolveErr } = await resolveOwnedEntity(
      supabase,
      propertyId,
      account.id
    );
    if (resolveErr) {
      return Response.json({ error: resolveErr.message }, { status: resolveErr.status });
    }

    // Check if property has source_url
    if (!property.source_url) {
      return Response.json(
        {
          error: "No source URL configured for this property",
          property,
        },
        { status: 400 }
      );
    }

    // Extract + compare via the shared pipeline
    const sync = await generateSyncPreview(property, mode);

    if (!sync.ok) {
      return Response.json(
        { error: sync.error, property: sync.property },
        { status: 400 }
      );
    }

    const { comparison, extractedData, extractionMethod } = sync;

    return Response.json({
      comparison,
      property,
      extractedData,
      sourceUrl: property.source_url,
      mode,
      extractionMethod,
      message: "Preview generated successfully",
    });
  } catch (error) {
    console.error("Sync preview error:", error);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/properties/sync-preview
 * Actually apply the changes to the property
 * Body: { propertyId, changeset, mode, extractionMethod }
 */
export async function PATCH(req) {
  try {
    const { account, error: accountErr } = await requireAccount();
    if (accountErr) {
      return Response.json({ error: accountErr.message }, { status: accountErr.status });
    }

    const supabase = getSupabaseAdmin();

    const { propertyId, changeset, mode = 'simple', extractionMethod = 'html' } = await req.json();

    if (!propertyId || !changeset) {
      return Response.json(
        { error: "propertyId and changeset required" },
        { status: 400 }
      );
    }

    // Verify the property/apartment belongs to this account
    const { entity: owned, error: resolveErr } = await resolveOwnedEntity(
      supabase,
      propertyId,
      account.id
    );
    if (resolveErr) {
      return Response.json({ error: resolveErr.message }, { status: resolveErr.status });
    }
    const isApartment = owned._type === "apartment";
    const actualId = isApartment ? propertyId.replace("apt_", "") : propertyId;

    // Build update object from changeset
    const updateData = {};
    changeset.forEach((change) => {
      updateData[change.field] = change.new_value;
    });

    let updated;

    if (isApartment) {
      // For apartments, we need to handle unit-specific fields differently
      const apartmentFields = {
        name: updateData.property_name,
        url: updateData.website || updateData.source_url,
        notes: updateData.notes,
        specials: updateData.specials,
        property_type: updateData.property_type,
        // Address info
        address: updateData.address,
        city: updateData.city,
        state: updateData.state,
        zip: updateData.zip,
        // Acceptance criteria
        accepts_eviction: updateData.accepts_evictions,
        accepts_broken_lease: updateData.accepts_broken_leases,
        accepts_bankruptcy: updateData.accepts_bankruptcy,
        // Fees
        app_fee: updateData.app_fee,
        admin_fee: updateData.admin_fee,
        deposit_info: updateData.deposit_info,
      };

      // Remove undefined values
      Object.keys(apartmentFields).forEach(
        key => apartmentFields[key] === undefined && delete apartmentFields[key]
      );

      // Update apartment
      const { data, error: updateError } = await supabase
        .from("apartments")
        .update(apartmentFields)
        .eq("id", actualId)
        .eq("account_id", account.id)
        .select();

      if (updateError) {
        return Response.json(
          { error: `Failed to update apartment: ${updateError.message}` },
          { status: 400 }
        );
      }

      // Get the updated apartment data
      updated = data && data[0] ? data[0] : { id: actualId };

      // Update unit-specific fields if provided
      if (updateData.price_min || updateData.price_max || updateData.bedrooms || updateData.bathrooms) {
        const unitFields = {};
        if (updateData.price_min !== undefined) unitFields.rent_min = updateData.price_min;
        if (updateData.price_max !== undefined) unitFields.rent_max = updateData.price_max;
        if (updateData.bedrooms !== undefined) unitFields.bedrooms = updateData.bedrooms;
        if (updateData.bathrooms !== undefined) unitFields.bathrooms = updateData.bathrooms;

        // Get first unit
        const { data: units } = await supabase
          .from("units")
          .select("id")
          .eq("apartment_id", actualId)
          .order("id", { ascending: true })
          .limit(1);

        if (units && units.length > 0) {
          await supabase
            .from("units")
            .update(unitFields)
            .eq("id", units[0].id);
        }
      }
    } else {
      // Update property
      const { data, error: updateError } = await supabase
        .from("properties")
        .update(updateData)
        .eq("id", actualId)
        .eq("account_id", account.id)
        .select()
        .single();

      if (updateError) {
        return Response.json(
          { error: `Failed to update property: ${updateError.message}` },
          { status: 400 }
        );
      }
      updated = data;
    }

    // Log the sync action
    const table = isApartment ? "apartments" : "properties";
    await supabase.from("property_sync_logs").insert({
      property_id: propertyId,
      sync_type: "manual_single",
      status: "completed",
      changes_made: changeset.length,
      source_html: null,
      extracted_data: updateData,
      diff_result: changeset,
      action_taken: "updated",
      sync_mode: mode,
      extraction_method: extractionMethod,
    });

    return Response.json({
      message: "Changes applied successfully",
      property: updated,
      changesApplied: changeset.length,
    });
  } catch (error) {
    console.error("Sync apply error:", error);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
