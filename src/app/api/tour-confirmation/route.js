import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/tour-confirmation?token=xxx
 * Get lead info for tour confirmation page
 * Builds complete property list from lead_matches (all interested properties)
 * Merges with tour_details (scheduled times)
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: lead, error } = await supabase
      .from("leads")
      .select("*")
      .eq("results_token", token)
      .single();

    if (error || !lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    // Get all interested properties from lead_matches
    const { data: interestedMatches } = await supabase
      .from("lead_matches")
      .select("id, unit_id, property_id, apartment_id, units(*), apartments(*), properties(*)")
      .eq("lead_id", lead.id)
      .eq("cx_response", "interested");

    // Also get manually added apartments from lead_property_selections
    const { data: manualSelections } = await supabase
      .from("lead_property_selections")
      .select("property_id")
      .eq("lead_id", lead.id)
      .eq("account_id", lead.account_id);

    // Extract apartment IDs from manually added properties
    const manualApartmentIds = (manualSelections || [])
      .filter(ls => ls.property_id?.startsWith("apt_"))
      .map(ls => parseInt(ls.property_id.replace("apt_", "")))
      .filter(id => !isNaN(id));

    // Fetch apartment details for manually added apartments
    let manualApartments = [];
    if (manualApartmentIds.length > 0) {
      const { data: apts } = await supabase
        .from("apartments")
        .select("*")
        .in("id", manualApartmentIds)
        .eq("account_id", lead.account_id);
      manualApartments = apts || [];
    }

    // Create a map of tour details for quick lookup
    const tourDetailsMap = {};
    if (lead.tour_details && Array.isArray(lead.tour_details)) {
      lead.tour_details.forEach((tour) => {
        if (tour.unit_id) {
          tourDetailsMap[`unit-${tour.unit_id}`] = tour;
        }
        if (tour.property_id) {
          tourDetailsMap[`property-${tour.property_id}`] = tour;
        }
        if (tour.apartment_id) {
          tourDetailsMap[`apartment-${tour.apartment_id}`] = tour;
        }
      });
    }

    // Build properties from lead_matches
    const matchedProperties = (interestedMatches || []).map((match) => {
      let tourKey, property;

      if (match.unit_id) {
        tourKey = `unit-${match.unit_id}`;
        const unit = match.units;
        const apt = match.apartments;
        const tour = tourDetailsMap[tourKey];

        property = {
          unit_id: match.unit_id,
          property_id: match.property_id,
          apartment_id: match.apartment_id,
          property_name: apt?.name || "Unknown",
          apartment_address: apt?.address,
          bedrooms: unit?.bedrooms || 0,
          bathrooms: unit?.bathrooms || 0,
          scheduled_tour_datetime: tour?.scheduled_tour_datetime || null,
        };
      } else if (match.property_id) {
        tourKey = `property-${match.property_id}`;
        const prop = match.properties;
        const tour = tourDetailsMap[tourKey];

        property = {
          unit_id: null,
          property_id: match.property_id,
          apartment_id: match.apartment_id,
          property_name: prop?.property_name || "Unknown",
          property_address: prop?.address,
          bedrooms: prop?.bedrooms || 0,
          bathrooms: prop?.bathrooms || 0,
          scheduled_tour_datetime: tour?.scheduled_tour_datetime || null,
        };
      } else if (match.apartment_id) {
        tourKey = `apartment-${match.apartment_id}`;
        const apt = match.apartments;
        const tour = tourDetailsMap[tourKey];

        property = {
          unit_id: null,
          property_id: null,
          apartment_id: match.apartment_id,
          property_name: apt?.name || "Unknown",
          apartment_address: apt?.address,
          bedrooms: apt?.bedrooms || 0,
          bathrooms: apt?.bathrooms || 0,
          scheduled_tour_datetime: tour?.scheduled_tour_datetime || null,
        };
      }

      return property;
    }).filter(Boolean);

    // Build properties from manually added apartments
    const manualProperties = manualApartments.map((apt) => {
      const tourKey = `apartment-${apt.id}`;
      const tour = tourDetailsMap[tourKey];

      return {
        unit_id: null,
        property_id: null,
        apartment_id: apt.id,
        property_name: apt.name || "Unknown",
        apartment_address: apt.address,
        bedrooms: apt.bedrooms || 0,
        bathrooms: apt.bathrooms || 0,
        scheduled_tour_datetime: tour?.scheduled_tour_datetime || null,
      };
    });

    // Combine all properties, avoiding duplicates
    const allProperties = [...matchedProperties, ...manualProperties];
    const uniqueProperties = [];
    const seenIds = new Set();

    allProperties.forEach((prop) => {
      const id = prop.unit_id || `apt_${prop.apartment_id}` || `prop_${prop.property_id}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        uniqueProperties.push(prop);
      }
    });

    // Override tour_details with complete properties list
    lead.tour_details = uniqueProperties;

    return NextResponse.json({ lead });
  } catch (err) {
    console.error("Error fetching tour confirmation:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
