import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendResultsEmail } from "@/lib/mailer";
import { getCurrentAccountId } from "@/lib/accounts";
import { verifyLeadOwnership } from "@/lib/api-auth";

/**
 * POST /api/leads/[id]/send
 *
 * Sends the results email to the client, marks the lead as "recommended_sent",
 * and returns the client results URL.
 *
 * Optional JSON body:
 *   { "ai_summary": "edited summary text" }
 * 
 * REQUIRES: User to be authenticated and lead to belong to their account
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;

    // Verify lead ownership first
    const authCheck = await verifyLeadOwnership(id);
    if (authCheck.error) return authCheck.response;

    const supabase = getSupabaseAdmin();
    const lead = authCheck.lead;

    // Parse optional body (edited AI summary)
    let body = {};
    try {
      body = await request.json();
    } catch {
      // no body is fine
    }

    // Fetch full lead data
    const { data: fullLead, error: fetchErr } = await supabase
      .from("leads")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !fullLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!fullLead.email) {
      return NextResponse.json(
        { error: "Lead has no email address" },
        { status: 400 }
      );
    }

    // Get the account ID
    const accountId = await getCurrentAccountId();

    const resultsUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/results/${fullLead.results_token}`;

    // Use the edited summary if provided, otherwise fall back to stored
    const aiSummary = body.ai_summary ?? fullLead.ai_summary ?? "";

    // If the summary was edited, persist the update
    if (body.ai_summary && body.ai_summary !== fullLead.ai_summary) {
      await supabase
        .from("leads")
        .update({ ai_summary: body.ai_summary })
        .eq("id", id);
    }

    // Get selected properties for this lead
    const { data: selectedPropertyIds } = await supabase
      .from("lead_property_selections")
      .select("property_id")
      .eq("lead_id", id);

    console.log(`Found ${selectedPropertyIds?.length || 0} selected properties for lead ${id}`);
    if (selectedPropertyIds?.length > 0) {
      console.log("Selected property IDs:", selectedPropertyIds.map(p => p.property_id));
    }

    // Separate apartment IDs (format: "apt_X") from property IDs (UUIDs)
    let apartmentIds = [];
    let propertyIds = [];
    
    if (selectedPropertyIds && selectedPropertyIds.length > 0) {
      const propIds = selectedPropertyIds.map((p) => p.property_id);
      apartmentIds = propIds
        .filter(id => typeof id === "string" && id.startsWith("apt_"))
        .map(id => parseInt(id.replace("apt_", ""), 10));
      propertyIds = propIds.filter(id => !id.startsWith("apt_"));
    }

    console.log(`Separated selected items:`, { apartmentIds, propertyIds });

    // Get the full property data for selected properties
    let selectedPropertiesData = [];
    
    // Fetch selected regular properties
    if (propertyIds.length > 0) {
      const { data: props } = await supabase
        .from("properties")
        .select("*")
        .in("id", propertyIds);
      selectedPropertiesData.push(...(props || []));
    }

    // Fetch selected apartments
    if (apartmentIds.length > 0) {
      const { data: apts } = await supabase
        .from("apartments")
        .select("*")
        .in("id", apartmentIds);
      
      // Convert apartments to properties format for email
      const convertedApts = (apts || []).map((apt) => ({
        id: `apt_${apt.id}`,
        property_name: apt.name,
        address: apt.address || "",
        city: apt.city || "",
        state: apt.state || "TX",
        zip: apt.zip || "",
        price_min: apt.price_min,
        price_max: apt.price_max,
        bedrooms: apt.bedrooms,
        bathrooms: apt.bathrooms,
        contact_name: apt.contact_name,
        contact_phone: apt.contact_phone,
        contact_email: apt.contact_email,
        website: apt.website || apt.url,
        notes: apt.notes,
        apartment_id: apt.id,
        source: "apartment_data",
      }));
      selectedPropertiesData.push(...convertedApts);
    }

    // Record property sends
    if (accountId && selectedPropertyIds?.length > 0) {
      const propertyEntries = selectedPropertyIds.map((p) => ({
        account_id: accountId,
        property_id: p.property_id,
        lead_id: id,
        sent_to_email: fullLead.email,
      }));
      await supabase.from("property_sends").insert(propertyEntries);
    }

    // Get recommended matches (units from apartments)
    const { data: matches } = await supabase
      .from("lead_matches")
      .select("unit_id, apartment_id, score, units(*), apartments(*)")
      .eq("lead_id", id)
      .order("score", { ascending: false })
      .limit(7);

    // Format match properties for email
    const matchPropertiesData = (matches || [])
      .filter((m) => m.units && m.apartments)
      .map((m) => ({
        property_name: m.apartments.name,
        address: m.apartments.address || "",
        city: m.apartments.city || "",
        state: m.apartments.state || "TX",
        zip: m.apartments.zip || "",
        price_min: m.units.rent_min,
        price_max: m.units.rent_max,
        bedrooms: m.units.bedrooms,
        bathrooms: m.units.bathrooms,
        sqft: m.units.sqft,
        amenities: m.apartments.amenities || {},
        pet_friendly: m.apartments.pet_friendly,
        contact_name: m.apartments.contact_name,
        contact_phone: m.apartments.contact_phone,
        contact_email: m.apartments.contact_email,
        website: m.apartments.website,
        notes: m.units.notes,
      }));

    // Create lead_matches records for manually-selected properties (not apartments)
    // Apartments are tracked only in lead_property_selections and fetched directly by matches endpoint
    if (propertyIds && propertyIds.length > 0) {
      // Delete any existing property matches for this lead (those with unit_id IS NULL)
      await supabase
        .from("lead_matches")
        .delete()
        .eq("lead_id", id)
        .is("unit_id", null);

      // Insert new property matches (only regular properties, not apartments)
      const propertyMatches = propertyIds.map((propertyId) => ({
        lead_id: id,
        property_id: propertyId,
        unit_id: null, // Properties don't have units
        apartment_id: null,
        score: 0, // Manual properties don't have AI scores, use 0
      }));

      const { error: propMatchErr } = await supabase
        .from("lead_matches")
        .insert(propertyMatches);
      
      if (propMatchErr) {
        console.error("Error inserting property matches:", propMatchErr);
        throw propMatchErr;
      }
      console.log(`Created ${propertyMatches.length} property matches for lead ${id}`);
    }

    // Combine all properties for email
    const allPropertiesForEmail = [...selectedPropertiesData, ...matchPropertiesData];

    // Send the email
    await sendResultsEmail({
      to: fullLead.email,
      clientName: fullLead.full_name,
      resultsUrl,
      aiSummary,
      properties: allPropertiesForEmail,
      agentName: "Lorenzo Foster",
    });

    // Create timeline event
    const newEvent = {
      stage: "recommended_sent",
      timestamp: new Date().toISOString(),
      notes: "Recommendations sent to client",
      visibility: "both",
    };

    const updatedTimeline = [...(fullLead.timeline || []), newEvent];

    // Use the matches already fetched above to populate recommended_units
    const recommendedUnits = (matches || []).map((m) => ({
      unit_id: m.unit_id,
      apartment_id: m.apartment_id,
      score: m.score,
      sent_at: new Date().toISOString(),
      cx_response: null,
    }));

    // Update status to recommended_sent with timeline and recommended_units
    const { error: updateErr } = await supabase
      .from("leads")
      .update({
        current_status: "recommended_sent",
        status: "sent", // keep for backward compatibility
        timeline: updatedTimeline,
        recommended_units: recommendedUnits,
      })
      .eq("id", id);

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      results_url: resultsUrl,
    });
  } catch (err) {
    console.error("Send error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
