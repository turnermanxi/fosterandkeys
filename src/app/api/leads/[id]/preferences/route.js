import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyLeadOwnership } from "@/lib/api-auth";

/**
 * POST /api/leads/[id]/preferences
 * 
 * Receives client's property preferences (which properties they're interested in)
 * Updates lead_matches with cx_response
 * Marks the lead as "cx_responded"
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;

    // Verify lead ownership first
    const authCheck = await verifyLeadOwnership(id);
    if (authCheck.error) return authCheck.response;

    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { preferences = [], notes = "" } = body;

    console.log(`[preferences] Received preferences for lead ${id}:`, {
      preferencesCount: preferences.length,
      preferences: JSON.stringify(preferences),
    });

    // 1. Get the lead
    const { data: lead, error: fetchErr } = await supabase
      .from("leads")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr) {
      console.error("Fetch error for lead:", fetchErr);
      return NextResponse.json(
        { error: `Failed to fetch lead: ${fetchErr.message}` },
        { status: 500 }
      );
    }

    if (!lead) {
      console.error("Lead not found with id:", id);
      return NextResponse.json(
        { error: `Lead not found with id: ${id}` },
        { status: 404 }
      );
    }

    // 2. Get all lead_matches for this lead
    const { data: allMatches, error: matchesErr } = await supabase
      .from("lead_matches")
      .select("id, unit_id, property_id, apartment_id, cx_response")
      .eq("lead_id", id);

    if (matchesErr) {
      console.error("[preferences] Error fetching lead_matches:", matchesErr);
      throw matchesErr;
    }

    // 2b. Get all lead_property_selections (apartments and regular properties)
    const { data: selectedProps, error: selectErr } = await supabase
      .from("lead_property_selections")
      .select("property_id, id")
      .eq("lead_id", id);

    if (selectErr) throw selectErr;

    // 3. Process preferences and update lead_matches
    // Separate preferences by type
    const unitPreferences = preferences.filter(p => p.unit_id);
    const propertyPreferences = preferences.filter(p => p.property_id && !p.apartment_id && typeof p.property_id === "string" && !p.property_id.startsWith("apt_"));
    const apartmentPreferences = preferences.filter(p => p.apartment_id);
    
    console.log(`[preferences] Separated preferences:`, {
      units: unitPreferences.length,
      properties: propertyPreferences.length,
      apartments: apartmentPreferences.length,
      unitIds: unitPreferences.map(u => u.unit_id),
      propertyIds: propertyPreferences.map(p => p.property_id),
      apartmentIds: apartmentPreferences.map(a => a.apartment_id),
    });

    // 3a. Update existing lead_matches entries for units and properties
    if (allMatches && allMatches.length > 0) {
      console.log(`[preferences] Existing lead_matches in DB:`, {
        count: allMatches.length,
        units: allMatches.filter(m => m.unit_id).length,
        properties: allMatches.filter(m => m.property_id).length,
        apartments: allMatches.filter(m => m.apartment_id).length,
        unitIds: allMatches.filter(m => m.unit_id).map(m => m.unit_id),
        propertyIds: allMatches.filter(m => m.property_id).map(m => m.property_id),
        apartmentIds: allMatches.filter(m => m.apartment_id).map(m => m.apartment_id),
      });
      
      let updateCount = 0;
      for (const match of allMatches) {
        // Skip ONLY pure apartment entries (no unit_id and no property_id)
        // DO process units that happen to have apartment_id set (they're part of an apartment building)
        if ((!match.unit_id && !match.property_id) || (typeof match.property_id === "string" && match.property_id.startsWith("apt_"))) {
          console.log(`[preferences] Skipping pure apartment or old format`, { match });
          continue;
        }
        
        // Check if this match is selected
        const isSelected = 
          (match.unit_id && unitPreferences.some(p => p.unit_id === match.unit_id)) ||
          (match.property_id && propertyPreferences.some(p => p.property_id === match.property_id));
        
        console.log(`[preferences] Evaluating lead_match ${match.id}:`, { 
          isSelected, 
          unit_id: match.unit_id, 
          property_id: match.property_id,
          matched: isSelected,
          unitMatch: match.unit_id && unitPreferences.some(p => p.unit_id === match.unit_id),
          propertyMatch: match.property_id && propertyPreferences.some(p => p.property_id === match.property_id),
        });

        const { error: updateErr } = await supabase
          .from("lead_matches")
          .update({
            cx_response: isSelected ? "interested" : "not_interested",
            sent_at: new Date().toISOString(),
          })
          .eq("id", match.id);

        if (updateErr) {
          console.error(`[preferences] Error updating lead_match ${match.id}:`, updateErr);
          throw updateErr;
        }
        updateCount++;
        console.log(`[preferences] Updated lead_match ${match.id} to cx_response="${isSelected ? "interested" : "not_interested"}"`);
      }
      console.log(`[preferences] Updated ${updateCount} lead_matches`);
    }

    // 3a-extra. Create lead_matches entries for units that were selected but don't exist in lead_matches
    // (This handles cases where automated matches were deleted)
    if (unitPreferences.length > 0) {
      console.log(`[preferences] Checking for missing unit matches`);
      const existingUnitIds = new Set((allMatches || []).filter(m => m.unit_id).map(m => m.unit_id));
      
      for (const unitPref of unitPreferences) {
        if (!existingUnitIds.has(unitPref.unit_id)) {
          console.log(`[preferences] Creating new lead_match for missing unit ${unitPref.unit_id}`);
          const { error: createErr } = await supabase
            .from("lead_matches")
            .insert({
              lead_id: id,
              unit_id: unitPref.unit_id,
              cx_response: "interested",
              sent_at: new Date().toISOString(),
            });
          
          if (createErr) {
            console.error(`Error creating lead_match for unit ${unitPref.unit_id}:`, createErr);
            // Don't throw - continue with other preferences
          }
        }
      }
    }

    // 3b. Create lead_matches entries for apartments from apartment preferences
    if (apartmentPreferences.length > 0) {
      console.log(`[preferences] Processing ${apartmentPreferences.length} apartment preferences`);
      
      for (const apt of apartmentPreferences) {
        const apartmentId = apt.apartment_id;
        console.log(`[preferences] Creating lead_match for apartment ${apartmentId}`);
        
        const { data: existingMatch } = await supabase
          .from("lead_matches")
          .select("id")
          .eq("lead_id", id)
          .eq("apartment_id", apartmentId)
          .single();
        
        if (!existingMatch) {
          const { error: createErr } = await supabase
            .from("lead_matches")
            .insert({
              lead_id: id,
              apartment_id: apartmentId,
              cx_response: "interested",
              sent_at: new Date().toISOString(),
            });
          
          if (createErr) {
            console.error(`Error creating lead_matches for apartment ${apartmentId}:`, createErr);
            throw createErr;
          }
        } else {
          const { error: updateErr } = await supabase
            .from("lead_matches")
            .update({ cx_response: "interested" })
            .eq("id", existingMatch.id);
          
          if (updateErr) throw updateErr;
        }
      }
    }

    // 3c. Create lead_matches entries for properties from property preferences
    if (propertyPreferences.length > 0) {
      console.log(`[preferences] Processing ${propertyPreferences.length} property preferences`);
      
      for (const prop of propertyPreferences) {
        const propertyId = prop.property_id;
        
        // Double-check this is a valid UUID (should be 36 chars with dashes)
        if (typeof propertyId !== "string" || propertyId.length !== 36 || propertyId.startsWith("apt_")) {
          console.warn(`[preferences] Skipping invalid property_id:`, { propertyId });
          continue;
        }
        
        console.log(`[preferences] Creating lead_match for property ${propertyId}`);
        
        const { data: existingMatch } = await supabase
          .from("lead_matches")
          .select("id")
          .eq("lead_id", id)
          .eq("property_id", propertyId)
          .single();
        
        if (!existingMatch) {
          const { error: createErr } = await supabase
            .from("lead_matches")
            .insert({
              lead_id: id,
              property_id: propertyId,
              cx_response: "interested",
              sent_at: new Date().toISOString(),
            });
          
          if (createErr) {
            console.error(`Error creating lead_matches for property ${propertyId}:`, createErr);
            throw createErr;
          }
        } else {
          const { error: updateErr } = await supabase
            .from("lead_matches")
            .update({ cx_response: "interested" })
            .eq("id", existingMatch.id);
          
          if (updateErr) throw updateErr;
        }
      }
    }

    // 4. Create timeline event
    const newEvent = {
      stage: "cx_responded",
      timestamp: new Date().toISOString(),
      notes: `Client selected ${preferences.length} properties for tours${notes ? ": " + notes : ""}`,
      data: {
        selected_count: preferences.length,
        total_properties: allMatches?.length || 0,
      },
      visibility: "both",
    };

    const updatedTimeline = [...(lead.timeline || []), newEvent];

    // 6. Verify the updates by fetching the updated matches
    const { data: updatedMatches } = await supabase
      .from("lead_matches")
      .select("id, unit_id, property_id, apartment_id, cx_response")
      .eq("lead_id", id);

    console.log(`[preferences] After updates, lead_matches status:`, {
      count: updatedMatches?.length || 0,
      interested: updatedMatches?.filter(m => m.cx_response === "interested").length || 0,
      notInterested: updatedMatches?.filter(m => m.cx_response === "not_interested").length || 0,
      null: updatedMatches?.filter(m => m.cx_response === null).length || 0,
      interestedIds: updatedMatches?.filter(m => m.cx_response === "interested").map(m => `unit/prop/apt: ${m.unit_id}/${m.property_id}/${m.apartment_id}`),
    });

    // 7. Update lead
    const { data: updated, error: updateErr } = await supabase
      .from("leads")
      .update({
        cx_feedback: notes,
        current_status: "cx_responded",
        timeline: updatedTimeline,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      console.error("Update error:", updateErr);
      throw updateErr;
    }

    return NextResponse.json({
      success: true,
      message: "Preferences submitted successfully",
      lead: updated,
    });
  } catch (err) {
    console.error("Error saving preferences:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save preferences" },
      { status: 500 }
    );
  }
}
