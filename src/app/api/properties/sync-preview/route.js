import { createClient } from "@supabase/supabase-js";
import { 
  extractPropertyDataFromHTML,
  extractPropertyDataFromScreenshot 
} from "@/lib/propertyExtractor";
import { comparePropertyData } from "@/lib/propertyComparator";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/properties/sync-preview
 * Get a preview of what would change for a property
 * Body: { propertyId, mode: 'simple' | 'advanced' }
 * Returns: { comparison, property, extractedData, sourceUrl, error?, mode, extractionMethod }
 */
export async function POST(req) {
  try {
    const { propertyId, mode = 'simple' } = await req.json();

    if (!propertyId) {
      return Response.json({ error: "propertyId required" }, { status: 400 });
    }

    if (!['simple', 'advanced'].includes(mode)) {
      return Response.json({ error: "mode must be 'simple' or 'advanced'" }, { status: 400 });
    }

    // Check if this is an apartment (prefixed with apt_)
    const isApartment = propertyId.startsWith("apt_");
    const actualId = isApartment ? propertyId.replace("apt_", "") : propertyId;

    // Fetch property/apartment from database
    let property, dbError;

    if (isApartment) {
      const { data, error } = await supabase
        .from("apartments")
        .select("id, name, city, url, property_type, units(bedrooms, bathrooms, rent_min, rent_max)")
        .eq("id", actualId)
        .single();
      
      property = data;
      dbError = error;

      // Convert apartment to property format
      if (property) {
        const units = property.units || [];
        const rentValues = units.map(u => u.rent_min).filter(v => v);
        const rentMaxValues = units.map(u => u.rent_max).filter(v => v);
        
        property = {
          id: `apt_${property.id}`,
          property_name: property.name,
          city: property.city,
          price_min: rentValues.length > 0 ? Math.min(...rentValues) : null,
          price_max: rentMaxValues.length > 0 ? Math.max(...rentMaxValues) : null,
          bedrooms: units[0]?.bedrooms || null,
          bathrooms: units[0]?.bathrooms || null,
          source_url: property.url,
          property_type: property.property_type || "apartment",
        };
      }
    } else {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", propertyId)
        .single();
      
      property = data;
      dbError = error;
    }

    if (dbError || !property) {
      return Response.json(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    // Check if property has source_url
    if (!property.source_url) {
      return Response.json(
        { 
          error: "No source URL configured for this property",
          property
        },
        { status: 400 }
      );
    }

    // Extract property data based on mode
    let extractedData;
    let extractionMethod;
    
    if (mode === 'advanced') {
      // Use screenshot + vision for advanced mode
      try {
        const result = await extractPropertyDataFromScreenshot(property.source_url, property);
        if (!result.success) {
          // Fallback to simple mode if screenshot fails
          console.warn('Advanced extraction failed, falling back to simple mode:', result.error);
          extractionMethod = 'html_fallback';
          
          // Fetch HTML from source URL
          let html;
          try {
            const response = await fetch(property.source_url, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              },
              timeout: 10000,
            });

            if (!response.ok) {
              return Response.json(
                { 
                  error: `Failed to fetch from source URL: ${response.status} ${response.statusText}`,
                  property
                },
                { status: 400 }
              );
            }

            html = await response.text();
          } catch (fetchError) {
            return Response.json(
              { 
                error: `Failed to fetch source URL: ${fetchError.message}`,
                property
              },
              { status: 400 }
            );
          }

          extractedData = await extractPropertyDataFromHTML(html, property.source_url);
        } else {
          extractionMethod = 'screenshot';
          extractedData = result;
        }
      } catch (extractError) {
        return Response.json(
          { 
            error: `Failed to extract property data (advanced mode): ${extractError.message}`,
            property
          },
          { status: 400 }
        );
      }
    } else {
      // Use simple HTML extraction
      extractionMethod = 'html';
      try {
        const response = await fetch(property.source_url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          timeout: 10000,
        });

        if (!response.ok) {
          return Response.json(
            { 
              error: `Failed to fetch from source URL: ${response.status} ${response.statusText}`,
              property
            },
            { status: 400 }
          );
        }

        const html = await response.text();
        extractedData = await extractPropertyDataFromHTML(html, property.source_url);
      } catch (fetchError) {
        return Response.json(
          { 
            error: `Failed to fetch source URL: ${fetchError.message}`,
            property
          },
          { status: 400 }
        );
      }
    }

    // Handle extraction result object
    if (!extractedData.success) {
      console.error('Extraction failed:', extractedData.error, 'Mode:', mode);
      return Response.json(
        { 
          error: `Failed to extract property data: ${extractedData.error || 'Unknown error'}`,
          property
        },
        { status: 400 }
      );
    }

    const extractedDataObj = extractedData.data || extractedData;

    // Compare extracted data with current property
    const comparison = comparePropertyData(extractedDataObj, property, {
      priceChangeThreshold: 0.2,
    });

    return Response.json({
      comparison,
      property,
      extractedData: extractedDataObj,
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
    const { propertyId, changeset, mode = 'simple', extractionMethod = 'html' } = await req.json();

    if (!propertyId || !changeset) {
      return Response.json(
        { error: "propertyId and changeset required" },
        { status: 400 }
      );
    }

    // Check if this is an apartment
    const isApartment = propertyId.startsWith("apt_");
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
