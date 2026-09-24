import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

function formatRentRange(unit) {
  const rentLo = Number(unit?.rent_min) || 0;
  const rentHi = Number(unit?.rent_max) || 0;

  if (!rentLo && !rentHi) return "Contact for pricing";
  if (rentLo && !rentHi) {
    const min = Math.max(0, rentLo - 100);
    const max = rentLo + 100;
    return `$${min.toLocaleString()}–$${max.toLocaleString()}/mo`;
  }
  if (rentLo === rentHi) {
    const min = Math.max(0, rentLo - 100);
    const max = rentLo + 100;
    return `$${min.toLocaleString()}–$${max.toLocaleString()}/mo`;
  }
  return `$${rentLo.toLocaleString()}–$${rentHi.toLocaleString()}/mo`;
}

function formatPropertyRange(property) {
  const min = Number(property?.price_min) || 0;
  const max = Number(property?.price_max) || 0;

  if (!min && !max) return "Contact for pricing";
  if (min && !max) return `$${min.toLocaleString()}/mo`;
  if (!min && max) return `$${max.toLocaleString()}/mo`;
  if (min === max) return `$${min.toLocaleString()}/mo`;
  return `$${min.toLocaleString()}–$${max.toLocaleString()}/mo`;
}

function buildTourMap(lead) {
  const map = {};
  if (!Array.isArray(lead.tour_details)) return map;

  for (const tour of lead.tour_details) {
    if (tour.unit_id) map[`unit-${tour.unit_id}`] = tour;
    if (tour.apartment_id) map[`apartment-${tour.apartment_id}`] = tour;
    if (tour.property_id) map[`property-${tour.property_id}`] = tour;
  }
  return map;
}

function normalizeMatch(match, firstUnitByApartment, tourMap) {
  if (match.unit_id) {
    const unit = match.units;
    const apt = match.apartments;
    const tour = tourMap[`unit-${match.unit_id}`];
    return {
      unit_id: match.unit_id,
      real_unit_id: match.unit_id,
      apartment_id: match.apartment_id,
      property_id: null,
      name: apt?.name || "Unknown",
      bedrooms: unit?.bedrooms ?? 0,
      bathrooms: unit?.bathrooms ?? 0,
      rent_range: formatRentRange(unit),
      sqft_min: unit?.sqft_min ?? null,
      sqft_max: unit?.sqft_max ?? unit?.sqft ?? null,
      scheduled_tour_datetime: tour?.scheduled_tour_datetime || null,
      cx_response: match.cx_response,
      toured_status: match.toured_status,
      source: "unit",
    };
  }

  if (match.apartment_id) {
    const apt = match.apartments;
    const firstUnit = firstUnitByApartment[match.apartment_id];
    const tour = tourMap[`apartment-${match.apartment_id}`];
    return {
      unit_id: `apt_${match.apartment_id}`,
      real_unit_id: firstUnit?.id ?? null,
      apartment_id: match.apartment_id,
      property_id: null,
      name: apt?.name || "Unknown",
      bedrooms: firstUnit?.bedrooms ?? 0,
      bathrooms: firstUnit?.bathrooms ?? 0,
      rent_range: formatRentRange(firstUnit),
      sqft_min: firstUnit?.sqft_min ?? null,
      sqft_max: firstUnit?.sqft_max ?? firstUnit?.sqft ?? null,
      scheduled_tour_datetime: tour?.scheduled_tour_datetime || null,
      cx_response: match.cx_response,
      toured_status: match.toured_status,
      source: "apartment",
    };
  }

  if (match.property_id) {
    const property = match.properties;
    const tour = tourMap[`property-${match.property_id}`];
    return {
      unit_id: `property_${match.property_id}`,
      real_unit_id: null,
      apartment_id: null,
      property_id: match.property_id,
      name: property?.property_name || "Property",
      bedrooms: property?.bedrooms ?? 0,
      bathrooms: property?.bathrooms ?? 0,
      rent_range: formatPropertyRange(property),
      sqft_min: property?.sqft_min ?? property?.sqft ?? null,
      sqft_max: property?.sqft_max ?? property?.sqft ?? null,
      scheduled_tour_datetime: tour?.scheduled_tour_datetime || null,
      cx_response: match.cx_response,
      toured_status: match.toured_status,
      source: "property",
    };
  }

  return null;
}

/**
 * GET /api/application-decision?token=xxx
 * Get lead and selected properties for the client application-decision page.
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: lead, error } = await supabase
      .from("leads")
      .select("*")
      .eq("results_token", token)
      .single();

    if (error || !lead) {
      console.error("Lead not found:", error);
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const { data: matches, error: matchesErr } = await supabase
      .from("lead_matches")
      .select("id, score, unit_id, property_id, apartment_id, cx_response, toured_status, units(*), apartments(*), properties(*)")
      .eq("lead_id", lead.id)
      .order("score", { ascending: false });

    if (matchesErr) throw matchesErr;

    const apartmentIds = [
      ...new Set(
        (matches || [])
          .map((m) => m.apartment_id)
          .filter(Boolean)
      ),
    ];

    let firstUnitByApartment = {};
    if (apartmentIds.length > 0) {
      const { data: apartmentUnits } = await supabase
        .from("units")
        .select("id, bedrooms, bathrooms, rent_min, rent_max, sqft_min, sqft_max, sqft, apartment_id")
        .in("apartment_id", apartmentIds)
        .order("bedrooms", { ascending: true });

      for (const unit of apartmentUnits || []) {
        if (!firstUnitByApartment[unit.apartment_id]) {
          firstUnitByApartment[unit.apartment_id] = unit;
        }
      }
    }

    const tourMap = buildTourMap(lead);
    const validProperties = (matches || [])
      .map((m) => normalizeMatch(m, firstUnitByApartment, tourMap))
      .filter((p) => p && p.name !== "Unknown");

    const touredProperties = validProperties.filter(
      (p) => p.toured_status === "toured" || p.scheduled_tour_datetime
    );
    const interestedProperties = validProperties.filter(
      (p) => p.cx_response === "interested"
    );

    // Prefer toured properties for an application decision. If older records do
    // not have toured_status yet, fall back to interested selections.
    const selectedProperties =
      touredProperties.length > 0 ? touredProperties : interestedProperties;
    const selectedKeys = new Set(selectedProperties.map((p) => p.unit_id));
    const otherProperties = validProperties.filter(
      (p) => !selectedKeys.has(p.unit_id)
    );

    console.log("Application decision properties:", {
      lead: lead.id,
      matches: matches?.length || 0,
      selected: selectedProperties.length,
      other: otherProperties.length,
    });

    return NextResponse.json({
      lead,
      selectedProperties,
      otherProperties,
    });
  } catch (err) {
    console.error("Error fetching application decision:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
