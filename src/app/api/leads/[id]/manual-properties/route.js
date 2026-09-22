import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyLeadOwnership } from "@/lib/api-auth";

/**
 * GET /api/leads/[id]/manual-properties
 * Get all manually-added properties and apartments for a lead with full details
 */
export async function GET(request, { params }) {
  try {
    const { id: leadId } = await params;

    // Verify lead ownership first
    const authCheck = await verifyLeadOwnership(leadId);
    if (authCheck.error) return authCheck.response;

    const supabase = getSupabaseAdmin();

    // Fetch lead with manual properties
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("manual_properties")
      .eq("id", leadId)
      .single();

    if (leadErr || !lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    const manualPropsIds = lead.manual_properties || [];
    if (manualPropsIds.length === 0) {
      return NextResponse.json({
        manual_properties: [],
      });
    }

    // Fetch property details for all manual properties
    const propertyIds = manualPropsIds.filter(p => p.property_id).map(p => p.property_id);
    const apartmentIds = manualPropsIds.filter(p => p.apartment_id).map(p => p.apartment_id);

    let properties = [];
    let apartments = [];

    if (propertyIds.length > 0) {
      const { data: propsData } = await supabase
        .from("properties")
        .select("*")
        .in("id", propertyIds);
      properties = propsData || [];
    }

    if (apartmentIds.length > 0) {
      const { data: aptsData } = await supabase
        .from("apartments")
        .select("*")
        .in("id", apartmentIds)
        .eq("account_id", authCheck.account.id);
      apartments = aptsData || [];
    }

    // Build result matching original format
    const items = manualPropsIds.map((item) => {
      if (item.property_id) {
        const prop = properties.find(p => p.id === item.property_id);
        if (prop) {
          return {
            id: item.property_id,
            property_id: item.property_id,
            type: "property",
            property: prop,
            created_at: item.added_at,
          };
        }
      } else if (item.apartment_id) {
        const apt = apartments.find(a => a.id === item.apartment_id);
        if (apt) {
          return {
            id: item.apartment_id,
            apartment_id: item.apartment_id,
            type: "apartment",
            property: {
              id: `apt_${apt.id}`,
              property_name: apt.name,
              address: null,
              city: apt.city || null,
              state: "TX",
              zip: null,
              price_min: null,
              price_max: null,
              bedrooms: null,
              bathrooms: null,
              sqft: null,
              property_type: "apartment",
              source: "apartment_data",
              apartment_id: apt.id,
              is_favorite: false,
              is_archived: false,
              is_active: true,
              created_at: apt.created_at,
              contact_name: null,
              contact_phone: null,
              contact_email: null,
              website: apt.url,
              notes: apt.notes,
              admin_fee: apt.admin_fee,
              app_fee: apt.app_fee,
              accepts_broken_lease: apt.accepts_broken_lease,
              accepts_bankruptcy: apt.accepts_bankruptcy,
              accepts_eviction: apt.accepts_eviction,
              metro_area: apt.metro_area,
            },
            created_at: item.added_at,
          };
        }
      }
      return null;
    }).filter(Boolean);

    return NextResponse.json({
      manual_properties: items,
    });
  } catch (err) {
    console.error("GET /api/leads/[id]/manual-properties error:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
