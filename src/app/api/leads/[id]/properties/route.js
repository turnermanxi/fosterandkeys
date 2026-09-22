import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCurrentAccountId } from "@/lib/accounts";

/**
 * GET /api/leads/[id]/properties
 * Get all properties available and which ones are selected for this lead
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const accountId = await getCurrentAccountId();
    const supabase = getSupabaseAdmin();

    // Get all properties for this account
    const { data: allProperties, error: propsErr } = await supabase
      .from("properties")
      .select(
        `
        id,
        property_name,
        address,
        city,
        state,
        zip,
        price_min,
        price_max,
        bedrooms,
        bathrooms,
        contact_name,
        contact_phone,
        contact_email,
        website,
        is_favorite
      `
      )
      .eq("account_id", accountId)
      .eq("is_archived", false)
      .order("property_name", { ascending: true });

    if (propsErr) throw propsErr;

    // Get all apartments (account-scoped)
    const { data: allApartments, error: aptsErr } = await supabase
      .from("apartments")
      .select(
        `
        id,
        name,
        address,
        city,
        state,
        zip,
        price_min,
        price_max,
        bedrooms,
        bathrooms,
        url
      `
      )
      .eq("account_id", accountId)
      .neq("is_archived", true)
      .order("name", { ascending: true });

    if (aptsErr) throw aptsErr;

    // Convert apartments to properties format
    const convertedApartments = (allApartments || []).map((apt) => ({
      id: `apt_${apt.id}`,
      property_name: apt.name,
      address: apt.address,
      city: apt.city,
      state: apt.state || "TX",
      zip: apt.zip,
      price_min: apt.price_min,
      price_max: apt.price_max,
      bedrooms: apt.bedrooms,
      bathrooms: apt.bathrooms,
      contact_name: null,
      contact_phone: null,
      contact_email: null,
      website: apt.url,
      is_favorite: false,
      apartment_id: apt.id,
      source: "apartment_data",
    }));

    // Combine properties
    const combinedProperties = [...(allProperties || []), ...convertedApartments];

    // Get selected properties for this lead
    const { data: selectedProps, error: selectedErr } = await supabase
      .from("lead_property_selections")
      .select("property_id")
      .eq("lead_id", id)
      .eq("account_id", accountId);

    if (selectedErr) throw selectedErr;

    const selectedIds = new Set(selectedProps.map((p) => p.property_id));

    // Enrich properties with selection status
    const enrichedProperties = combinedProperties.map((prop) => ({
      ...prop,
      isSelected: selectedIds.has(prop.id),
    }));

    return NextResponse.json({
      properties: enrichedProperties,
      selectedCount: selectedIds.size,
    });
  } catch (err) {
    console.error("GET /api/leads/[id]/properties error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/leads/[id]/properties
 * Update property selections for a lead
 * Accepts both property IDs (UUIDs) and apartment IDs (formatted as "apt_123")
 *
 * Body:
 *   { "propertyIds": ["id1", "apt_2", "id3", ...] }
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const accountId = await getCurrentAccountId();
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { propertyIds = [] } = body;

    // Verify lead exists and belongs to this account
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id")
      .eq("id", id)
      .eq("account_id", accountId)
      .single();

    if (leadErr || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Separate apartment IDs from property IDs
    const apartmentIds = propertyIds
      .filter((pid) => typeof pid === "string" && pid.startsWith("apt_"))
      .map((pid) => parseInt(pid.replace("apt_", ""), 10));
    
    const regularPropertyIds = propertyIds.filter(
      (pid) => !pid.startsWith("apt_")
    );

    // Validate properties in properties table
    if (regularPropertyIds.length > 0) {
      const { data: props, error: propsErr } = await supabase
        .from("properties")
        .select("id")
        .eq("account_id", accountId)
        .in("id", regularPropertyIds);

      if (propsErr) throw propsErr;

      if (props.length !== regularPropertyIds.length) {
        return NextResponse.json(
          { error: "Some properties not found or unauthorized" },
          { status: 400 }
        );
      }
    }

    // Validate apartments in apartments table (account-scoped)
    if (apartmentIds.length > 0) {
      const { data: apts, error: aptsErr } = await supabase
        .from("apartments")
        .select("id")
        .in("id", apartmentIds)
        .eq("account_id", accountId);

      if (aptsErr) throw aptsErr;

      if (apts.length !== apartmentIds.length) {
        return NextResponse.json(
          { error: "Some apartments not found or unauthorized" },
          { status: 400 }
        );
      }
    }

    // Clear existing selections
    const { error: deleteErr } = await supabase
      .from("lead_property_selections")
      .delete()
      .eq("lead_id", id)
      .eq("account_id", accountId);

    if (deleteErr) throw deleteErr;

    // Add new selections (using the original propertyIds which include "apt_X" format)
    if (propertyIds.length > 0) {
      const selectionsToInsert = propertyIds.map((propertyId) => ({
        lead_id: id,
        property_id: propertyId,
        account_id: accountId,
      }));

      const { error: insertErr } = await supabase
        .from("lead_property_selections")
        .insert(selectionsToInsert);

      if (insertErr) throw insertErr;
    }

    return NextResponse.json({
      success: true,
      selectedCount: propertyIds.length,
    });
  } catch (err) {
    console.error("POST /api/leads/[id]/properties error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
