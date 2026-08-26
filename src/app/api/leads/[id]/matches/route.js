import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyLeadOwnership } from "@/lib/api-auth";

/**
 * GET /api/leads/[id]/matches
 * Fetch all lead_matches with full unit/apartment/property data
 * REQUIRES: User to be authenticated and lead to belong to their account
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // Verify ownership before proceeding
    const authCheck = await verifyLeadOwnership(id);
    if (authCheck.error) return authCheck.response;

    // Proceed with fetching matches
    const supabase = getSupabaseAdmin();

    // Fetch all lead_matches with related data
    const { data: allMatches, error } = await supabase
      .from("lead_matches")
      .select("id, score, unit_id, property_id, apartment_id, cx_response, toured_status, toured_at, units(*), apartments(*), properties(*)")
      .eq("lead_id", id)
      .order("score", { ascending: false });

    if (error) {
      console.error(`Error fetching lead_matches for lead ${id}:`, error);
      throw error;
    }

    console.log(`Fetched ${(allMatches || []).length} matches for lead ${id}`);
    console.log("Raw matches data:", JSON.stringify(allMatches?.slice(0, 2), null, 2));

    // Format matches
    const matches = (allMatches || []).map((m) => {
      console.log(`Processing match: unit_id=${m.unit_id}, property_id=${m.property_id}, apartment_id=${m.apartment_id}, has_property_obj=${!!m.properties}`);
      return {
        id: m.id,
        type: m.unit_id ? "unit" : m.apartment_id ? "apartment" : "property",
        score: m.score,
        cx_response: m.cx_response,
        toured_status: m.toured_status,
        toured_at: m.toured_at,
        unit_id: m.unit_id,
        property_id: m.property_id ? m.property_id.toString() : null, // Normalize to string for comparison
        apartment_id: m.apartment_id,
        unit: m.units,
        apartment: m.apartments,
        property: m.properties,
      };
    });

    // Also add any properties from lead_property_selections that aren't in lead_matches yet
    const { data: selectedProps, error: selectedErr } = await supabase
      .from("lead_property_selections")
      .select("property_id")
      .eq("lead_id", id);

    console.log(`[matches] Selected properties for lead ${id}:`, {
      count: selectedProps?.length || 0,
      ids: selectedProps?.map(p => p.property_id),
      error: selectedErr?.message,
    });

    const existingPropertyIds = new Set(
      matches
        .filter(m => m.property_id && m.type === "property")
        .map(m => m.property_id)
    );

    console.log(`[matches] Existing property IDs in lead_matches:`, Array.from(existingPropertyIds));

    const newSelectionIds = (selectedProps || [])
      .map(s => s.property_id)
      .filter(pid => !existingPropertyIds.has(pid.toString()));

    console.log(`[matches] New selection IDs to fetch (not already in lead_matches):`, newSelectionIds);

    // Separate apartment IDs (format: "apt_X") from property IDs (UUIDs)
    const apartmentIds = newSelectionIds
      .filter(id => typeof id === "string" && id.startsWith("apt_"))
      .map(id => parseInt(id.replace("apt_", ""), 10));
    
    const propertyIds = newSelectionIds.filter(id => !id.startsWith("apt_"));

    console.log(`[matches] Separated IDs:`, {
      apartmentCount: apartmentIds.length,
      apartmentIds,
      propertyCount: propertyIds.length,
      propertyIds,
    });

    // Fetch property details for new selections
    let additionalMatches = [];

    // Fetch regular properties
    if (propertyIds.length > 0) {
      console.log(`[matches] Fetching ${propertyIds.length} property details:`, propertyIds);
      
      const { data: propDetails, error: propErr } = await supabase
        .from("properties")
        .select("*")
        .in("id", propertyIds);

      console.log(`[matches] Property query result:`, {
        requestedCount: propertyIds.length,
        returnedCount: propDetails?.length || 0,
        error: propErr?.message,
        ids: propDetails?.map(p => p.id),
      });

      const propertyMatches = propertyIds.map((propertyId) => {
        const prop = (propDetails || []).find(p => p.id === propertyId);
        if (!prop) {
          console.warn(`[matches] Property ${propertyId} not found in database`);
        } else {
          console.log(`[matches] Found property ${propertyId}: ${prop.property_name}`);
        }
        return {
          id: `sel_${propertyId}`,
          type: "property",
          score: null,
          cx_response: "interested",
          toured_status: null,
          toured_at: null,
          unit_id: null,
          property_id: propertyId,
          unit: null,
          apartment: null,
          property: prop,
        };
      });

      additionalMatches.push(...propertyMatches);
    }

    // Fetch apartments
    if (apartmentIds.length > 0) {
      console.log(`[matches] Fetching ${apartmentIds.length} apartment details:`, apartmentIds);
      
      const { data: aptDetails, error: aptErr } = await supabase
        .from("apartments")
        .select("*")
        .in("id", apartmentIds);

      console.log(`[matches] Apartment query result:`, {
        requestedCount: apartmentIds.length,
        returnedCount: aptDetails?.length || 0,
        error: aptErr?.message,
        ids: aptDetails?.map(a => a.id),
      });

      const apartmentMatches = apartmentIds.map((apartmentId) => {
        const apt = (aptDetails || []).find(a => a.id === apartmentId);
        if (!apt) {
          console.warn(`[matches] Apartment ${apartmentId} not found in database`);
        } else {
          console.log(`[matches] Found apartment apt_${apartmentId}: ${apt.name}`);
        }
        return {
          id: `sel_apt_${apartmentId}`,
          type: "apartment",
          score: null,
          cx_response: "interested",
          toured_status: null,
          toured_at: null,
          unit_id: null,
          property_id: `apt_${apartmentId}`, // Store in standard format
          unit: null,
          apartment: apt,
          property: null,
        };
      });

      additionalMatches.push(...apartmentMatches);
    }

    const allMatches_combined = [...matches, ...additionalMatches];

    // Deduplicate by apartment_id, property_id, and unit_id
    const seenIds = new Set();
    const uniqueMatches = allMatches_combined.filter((m) => {
      let uniqueId;
      if (m.unit_id) {
        uniqueId = `unit-${m.unit_id}`;
      } else if (m.apartment_id) {
        uniqueId = `apartment-${m.apartment_id}`;
      } else if (m.property_id) {
        uniqueId = `property-${m.property_id}`;
      } else {
        return true; // Keep if no ID
      }

      if (seenIds.has(uniqueId)) {
        console.log(`[matches] Filtering out duplicate: ${uniqueId}`);
        return false; // Skip duplicate
      }
      seenIds.add(uniqueId);
      return true;
    });

    console.log(`[matches] Deduplication: ${allMatches_combined.length} total → ${uniqueMatches.length} unique`);

    return NextResponse.json({ matches: uniqueMatches });
  } catch (err) {
    console.error("Error in /api/leads/[id]/matches:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
