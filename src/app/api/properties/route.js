import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCurrentAccountId } from "@/lib/accounts";
import {
  checkForDuplicates,
  recordDuplicateFlags,
} from "@/lib/duplicateDetection";

/**
 * GET /api/properties
 * Returns all properties for the current account with filters
 *
 * Query params:
 *   - category (rent|buy|sell|investment)
 *   - source (apartment_data|manual|csv_import)
 *   - favorite (true|false)
 *   - archived (true|false)
 *   - bedrooms (1|2|3|4 for 4+)
 *   - search (search address, name, contact)
 *   - page (default 1)
 *   - limit (default 50)
 */
export async function GET(request) {
  try {
    const accountId = await getCurrentAccountId();
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);

    // Get pagination and filter params
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const offset = (page - 1) * limit;
    const search = url.searchParams.get("search");
    const source = url.searchParams.get("source");
    const favorite = url.searchParams.get("favorite");
    const archived = url.searchParams.get("archived");
    const bedrooms = url.searchParams.get("bedrooms");

    // Fetch properties from properties table
    let propertiesQuery = supabase
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
        bedrooms_min,
        bedrooms_max,
        bathrooms,
        sqft,
        sqft_min,
        sqft_max,
        studio_price_min,
        studio_price_max,
        bedroom_1_price_min,
        bedroom_1_price_max,
        bedroom_2_price_min,
        bedroom_2_price_max,
        bedroom_3_price_min,
        bedroom_3_price_max,
        property_type,
        source,
        apartment_id,
        is_favorite,
        is_archived,
        is_active,
        created_at,
        updated_at,
        contact_name,
        contact_phone,
        contact_email,
        website,
        source_url,
        property_tags(tag)
      `,
        { count: "exact" }
      )
      .eq("account_id", accountId);

    // Apply filters to properties
    if (favorite === "true") {
      propertiesQuery = propertiesQuery.eq("is_favorite", true);
    }

    if (archived === "true") {
      propertiesQuery = propertiesQuery.eq("is_archived", true);
    } else if (archived === "false") {
      propertiesQuery = propertiesQuery.eq("is_archived", false);
    }

    if (bedrooms) {
      const bedroomNum = parseInt(bedrooms, 10);
      if (bedroomNum === 4) {
        // For "4+" option, filter for 4 or more bedrooms (use bedrooms_min or bedrooms)
        propertiesQuery = propertiesQuery.or(`bedrooms_min.gte.4,bedrooms.gte.4`);
      } else if (!isNaN(bedroomNum)) {
        // For specific bedroom count, check if it's within the range
        propertiesQuery = propertiesQuery.or(
          `bedrooms.eq.${bedroomNum},and(bedrooms_min.lte.${bedroomNum},bedrooms_max.gte.${bedroomNum})`
        );
      }
    }

    if (source && source !== "all") {
      propertiesQuery = propertiesQuery.eq("source", source);
    }

    if (search) {
      const searchTerm = `%${search}%`;
      propertiesQuery = propertiesQuery.or(
        `address.ilike.${searchTerm},property_name.ilike.${searchTerm},contact_name.ilike.${searchTerm}`
      );
    }

    propertiesQuery = propertiesQuery.order("created_at", { ascending: false });

    const { data: properties, error: propsError, count: propsCount } = await propertiesQuery;

    if (propsError) throw propsError;

    // Fetch apartments from apartments table (legacy data)
    // Don't filter apartments - they're shown alongside properties
    let apartmentsQuery = supabase
      .from("apartments")
      .select(
        `
        id,
        name,
        city,
        address,
        state,
        zip,
        contact_name,
        contact_phone,
        contact_email,
        website,
        source_url,
        url,
        accepts_broken_lease,
        accepts_bankruptcy,
        accepts_eviction,
        pet_friendly,
        accepts_low_credit,
        accepts_itin,
        accepts_second_chance,
        created_at,
        metro_area,
        notes,
        specials,
        app_fee,
        admin_fee,
        deposit_info,
        property_type,
        sync_mode,
        units(id, bedrooms, bathrooms, rent_min, rent_max, sqft_min, sqft_max)
      `,
        { count: "exact" }
      );

    if (search) {
      const searchTerm = `%${search}%`;
      apartmentsQuery = apartmentsQuery.or(
        `name.ilike.${searchTerm},city.ilike.${searchTerm}`
      );
    }

    // Only include apartments if source is "all" or "apartment_data" or not specified
    var apartments = [];
    console.log("Properties API - source:", source, "Should fetch apartments:", !source || source === "all" || source === "apartment_data");
    
    if (!source || source === "all" || source === "apartment_data") {
      apartmentsQuery = apartmentsQuery.order("name", { ascending: true });
      const { data: aptsData, error: aptsError, count: aptsCount } = await apartmentsQuery;

      if (aptsError) {
        console.error("Apartments query error:", aptsError);
        throw aptsError;
      }
      
      apartments = aptsData || [];
      console.log("Apartments fetched:", apartments.length);
    } else {
      console.log("Skipping apartments - source filter is restrictive");
    }

    // Convert apartments to properties format
    const convertedApartments = (apartments || []).map((apt) => {
      // Calculate price and bedroom ranges from units
      const units = apt.units || [];
      let priceMin = null;
      let priceMax = null;
      let bedroomsMin = null;
      let bedroomsMax = null;
      let sqftMin = null;
      let sqftMax = null;
      
      if (units.length > 0) {
        const rentValues = units.map(u => u.rent_min).filter(v => v !== null && v !== undefined);
        const rentMaxValues = units.map(u => u.rent_max).filter(v => v !== null && v !== undefined);
        const bedroomValues = units.map(u => u.bedrooms).filter(v => v !== null && v !== undefined);
        const sqftMinValues = units.map(u => u.sqft_min).filter(v => v !== null && v !== undefined);
        const sqftMaxValues = units.map(u => u.sqft_max).filter(v => v !== null && v !== undefined);
        
        if (rentValues.length > 0) priceMin = Math.min(...rentValues);
        if (rentMaxValues.length > 0) priceMax = Math.max(...rentMaxValues);
        if (bedroomValues.length > 0) {
          bedroomsMin = Math.min(...bedroomValues);
          bedroomsMax = Math.max(...bedroomValues);
        }
        
        // Calculate sqft range from min/max values
        if (sqftMinValues.length > 0) sqftMin = Math.min(...sqftMinValues);
        if (sqftMaxValues.length > 0) sqftMax = Math.max(...sqftMaxValues);
      }

      return {
        id: `apt_${apt.id}`,
        property_name: apt.name,
        address: apt.address || null,
        city: apt.city || null,
        state: apt.state || "TX",
        zip: apt.zip || null,
        price_min: priceMin,
        price_max: priceMax,
        bedrooms: bedroomsMin === bedroomsMax ? bedroomsMin : (bedroomsMin !== null && bedroomsMax !== null ? `${bedroomsMin}-${bedroomsMax}` : null),
        bedrooms_min: bedroomsMin,
        bedrooms_max: bedroomsMax,
        bathrooms: null,  // calculated from units if needed
        sqft: null,
        sqft_min: sqftMin,
        sqft_max: sqftMax,
        studio_price_min: null,
        studio_price_max: null,
        bedroom_1_price_min: null,
        bedroom_1_price_max: null,
        bedroom_2_price_min: null,
        bedroom_2_price_max: null,
        bedroom_3_price_min: null,
        bedroom_3_price_max: null,
        property_type: apt.property_type || "apartment",
        source: "apartment_data",
        apartment_id: apt.id,
        is_favorite: false,
        is_archived: false,
        is_active: true,
        created_at: apt.created_at,
        updated_at: apt.created_at,
        contact_name: apt.contact_name || null,
        contact_phone: apt.contact_phone || null,
        contact_email: apt.contact_email || null,
        website: apt.website || apt.url,
        source_url: apt.source_url || apt.url,
        property_tags: [],
        pet_friendly: apt.pet_friendly,
        accepts_evictions: apt.accepts_eviction,
        accepts_broken_leases: apt.accepts_broken_lease,
        accepts_low_credit: apt.accepts_low_credit,
        accepts_itin: apt.accepts_itin,
        accepts_second_chance: apt.accepts_second_chance,
        accepts_bankruptcy: apt.accepts_bankruptcy,
        metro_area: apt.metro_area,
        notes: apt.notes,
        specials: apt.specials,
        admin_fee: apt.admin_fee,
        app_fee: apt.app_fee,
        deposit_info: apt.deposit_info,
      };
    });

    // Combine and sort
    const allProperties = [
      ...(properties || []),
      ...convertedApartments,
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Apply pagination to combined results
    const paginatedResults = allProperties.slice(offset, offset + limit);
    const totalCount = allProperties.length;

    console.log("Properties API summary - Properties:", properties?.length || 0, "Apartments:", convertedApartments.length, "Total:", totalCount);

    return NextResponse.json({
      data: paginatedResults,
      apartments: apartments || [], // Return raw apartments for LeadDetail
      units: apartments.flatMap(apt => apt.units || []) || [], // Extract and return units
      total: totalCount,
      page,
      limit,
    });
  } catch (err) {
    console.error("GET /api/properties error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/properties
 * Create a new property with duplicate detection
 *
 * Body:
 *   - property_name (optional)
 *   - source (apartment_data|manual|csv_import)
 *   - apartment_id (only for apartment_data source)
 *   - address, city, state, zip (required)
 *   - lat, lng (optional)
 *   - price_min, price_max
 *   - bedrooms, bathrooms, sqft
 *   - amenities (JSONB)
 *   - [acceptance flags] pet_friendly, accepts_evictions, etc.
 *   - admin_fee, app_fee, deposit_info
 *   - contact_name, contact_phone, contact_email
 *   - website, notes
 *   - force_save (boolean, optional - bypasses duplicate check)
 */
export async function POST(request) {
  try {
    const accountId = await getCurrentAccountId();
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    // Validate required fields
    if (!body.address || !body.city) {
      return NextResponse.json(
        { error: "address and city are required" },
        { status: 400 }
      );
    }

    // Check for duplicates (unless force_save is true)
    let duplicates = [];
    if (!body.force_save) {
      duplicates = await checkForDuplicates(body, accountId);

      // If duplicates found, return warning (don't block)
      if (duplicates.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Similar properties found. Please review before saving.",
            duplicates_found: duplicates,
            property_draft: body,
          },
          { status: 409 }
        );
      }
    }

    // Create the property
    const { data: property, error: createErr } = await supabase
      .from("properties")
      .insert({
        account_id: accountId,
        created_by: accountId,
        source: body.source || "manual",
        apartment_id: body.apartment_id,
        property_name: body.property_name,
        address: body.address,
        city: body.city,
        state: body.state || "TX",
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
      })
      .select()
      .single();

    if (createErr) throw createErr;

    // Record duplicate flags for future reference (if any were found)
    if (duplicates.length > 0) {
      await recordDuplicateFlags(property.id, accountId, duplicates);
    }

    return NextResponse.json({
      success: true,
      property,
      duplicates_found: duplicates,
    });
  } catch (err) {
    console.error("POST /api/properties error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
