import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/application-decision?token=xxx
 * Get lead and available properties for application decision page
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
      console.error("Lead not found:", error);
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    console.log("Lead found:", lead.id, "Recommended units:", lead.recommended_units?.length);

    // Get recommended_units from the lead
    const recommendedUnitIds = (lead.recommended_units || []).map((r) => r.unit_id);
    
    // ALSO get manually added properties from lead_property_selections
    const { data: leadSelections } = await supabase
      .from("lead_property_selections")
      .select("property_id, created_at")
      .eq("lead_id", lead.id);

    console.log("Lead property selections:", leadSelections?.length);

    // Extract apartment IDs from lead_property_selections (format: "apt_X")
    const manualApartmentIds = (leadSelections || [])
      .filter(ls => ls.property_id?.startsWith("apt_"))
      .map(ls => parseInt(ls.property_id.replace("apt_", "")))
      .filter(id => !isNaN(id));

    console.log("Manual apartment IDs:", manualApartmentIds);

    // Combine all unit/apartment IDs to look up
    const allIdsToFetch = [...recommendedUnitIds, ...manualApartmentIds];
    
    if (allIdsToFetch.length === 0 && recommendedUnitIds.length === 0) {
      console.warn("No recommended units or manually added properties for lead:", lead.id);
      return NextResponse.json({
        lead,
        selectedProperties: [],
        otherProperties: [],
      });
    }

    // Fetch units for both recommended units AND manually added apartments
    let units = [];
    if (recommendedUnitIds.length > 0) {
      const { data: unitData } = await supabase
        .from("units")
        .select("id, bedrooms, bathrooms, rent_min, rent_max, apartment_id")
        .in("id", recommendedUnitIds);
      units = unitData || [];
    }

    console.log("Units found:", units?.length);

    // Fetch units for manually added apartments to get bed/bath info
    let apartmentUnits = [];
    if (manualApartmentIds.length > 0) {
      const { data: unitsData } = await supabase
        .from("units")
        .select("id, bedrooms, bathrooms, rent_min, rent_max, apartment_id")
        .in("apartment_id", manualApartmentIds)
        .order("bedrooms", { ascending: true }); // Get smallest units first
      apartmentUnits = unitsData || [];
      console.log("Apartment units found:", apartmentUnits?.length);
    }

    // Create a map of apartment_id -> first unit for that apartment
    const apartmentFirstUnitMap = {};
    (apartmentUnits || []).forEach(unit => {
      if (!apartmentFirstUnitMap[unit.apartment_id]) {
        apartmentFirstUnitMap[unit.apartment_id] = unit;
      }
    });

    // Fetch apartments both for units AND for manually added apartments
    const aptIdsFromUnits = (units || []).map((u) => u.apartment_id);
    const allAptIds = [...new Set([...aptIdsFromUnits, ...manualApartmentIds])];
    
    const { data: apartments } = await supabase
      .from("apartments")
      .select("id, name")
      .in("id", allAptIds);

    console.log("Apartments found:", apartments?.length);

    const aptMap = {};
    (apartments || []).forEach((a) => (aptMap[a.id] = a));

    // Build a map of unit_id -> tour details for quick lookup
    const tourDetailsMap = {};
    if (lead.tour_details && Array.isArray(lead.tour_details)) {
      lead.tour_details.forEach((tour) => {
        if (tour.unit_id) {
          tourDetailsMap[tour.unit_id] = tour;
        }
        if (tour.apartment_id) {
          tourDetailsMap[`apt_${tour.apartment_id}`] = tour;
        }
      });
    }

    // Build properties from recommended_units
    const recommendedProperties = (lead.recommended_units || []).map((rec) => {
      const unit = (units || []).find((u) => u.id === rec.unit_id);
      const apt = unit ? aptMap[unit.apartment_id] : null;
      const tourInfo = tourDetailsMap[rec.unit_id]; // Get tour details for this unit

      const rentLo = unit ? Number(unit.rent_min) : 0;
      const rentHi = unit ? Number(unit.rent_max) : 0;

      let rentRange;
      if (!rentLo && !rentHi) {
        rentRange = "Contact for pricing";
      } else if (rentLo && !rentHi) {
        const min = Math.max(0, rentLo - 100);
        const max = rentLo + 100;
        rentRange = `$${min.toLocaleString()}–$${max.toLocaleString()}/mo`;
      } else if (rentLo === rentHi) {
        const min = Math.max(0, rentLo - 100);
        const max = rentLo + 100;
        rentRange = `$${min.toLocaleString()}–$${max.toLocaleString()}/mo`;
      } else {
        rentRange = `$${rentLo.toLocaleString()}–$${rentHi.toLocaleString()}/mo`;
      }

      return {
        unit_id: rec.unit_id,
        name: apt?.name || "Unknown",
        bedrooms: unit?.bedrooms || 0,
        bathrooms: unit?.bathrooms || 0,
        rent_range: rentRange,
        scheduled_tour_datetime: tourInfo?.scheduled_tour_datetime || null,
        cx_response: rec.cx_response,
        source: "recommended",
      };
    });

    // Build properties from manually added apartments
    const manualProperties = manualApartmentIds
      .map((aptId) => {
        const apt = aptMap[aptId];
        const firstUnit = apartmentFirstUnitMap[aptId]; // Get first unit for this apartment
        const tourInfo = tourDetailsMap[`apt_${aptId}`]; // Get tour details for this apartment
        
        // Use first unit's details if available, otherwise show apartment only
        const bedrooms = firstUnit?.bedrooms || 0;
        const bathrooms = firstUnit?.bathrooms || 0;

        let rentRange = "Contact for pricing";
        if (firstUnit) {
          const rentLo = Number(firstUnit.rent_min) || 0;
          const rentHi = Number(firstUnit.rent_max) || 0;

          if (!rentLo && !rentHi) {
            rentRange = "Contact for pricing";
          } else if (rentLo && !rentHi) {
            const min = Math.max(0, rentLo - 100);
            const max = rentLo + 100;
            rentRange = `$${min.toLocaleString()}–$${max.toLocaleString()}/mo`;
          } else if (rentLo === rentHi) {
            const min = Math.max(0, rentLo - 100);
            const max = rentLo + 100;
            rentRange = `$${min.toLocaleString()}–$${max.toLocaleString()}/mo`;
          } else {
            rentRange = `$${rentLo.toLocaleString()}–$${rentHi.toLocaleString()}/mo`;
          }
        }

        return {
          unit_id: `apt_${aptId}`, // Use apt_X format as unit_id
          apartment_id: aptId,
          name: apt?.name || "Unknown",
          bedrooms,
          bathrooms,
          rent_range: rentRange,
          scheduled_tour_datetime: tourInfo?.scheduled_tour_datetime || null,
          cx_response: "interested",
          source: "manual",
        };
      })
      .filter(p => p.name !== "Unknown"); // Only include if we found the apartment

    console.log("Recommended properties built:", recommendedProperties.length);
    console.log("Manual properties built:", manualProperties.length);

    // Combine all properties
    const properties = [...recommendedProperties, ...manualProperties];

    // Filter out any with null unit_id (safety check)
    const validProperties = properties.filter(p => p.unit_id && p.unit_id !== null && p.unit_id !== "null");

    console.log("Valid properties after filtering:", validProperties.length, "filtered out:", properties.length - validProperties.length);

    // Separate selected (toured) from other properties
    // Only show properties that have scheduled tours (scheduled_tour_datetime exists)
    const selectedProperties = validProperties.filter((p) => p.scheduled_tour_datetime);
    const otherProperties = validProperties.filter((p) => !p.scheduled_tour_datetime);

    console.log("Selected properties:", selectedProperties.length, "Other properties:", otherProperties.length);

    return NextResponse.json({
      lead,
      selectedProperties: selectedProperties.length > 0 ? selectedProperties : validProperties,
      otherProperties,
    });
  } catch (err) {
    console.error("Error fetching application decision:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
