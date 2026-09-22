import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendTourConfirmationEmail } from "@/lib/mailer";
import { verifyLeadOwnership } from "@/lib/api-auth";

/**
 * POST /api/leads/[id]/schedule-tour
 * 
 * Lorenzo confirms tour dates and times for selected properties (from lead_matches)
 * Each property has its own date and time
 * Sends confirmation email to client
 * 
 * REQUIRES: User to be authenticated and lead to belong to their account
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;

    // Verify lead ownership first
    const authCheck = await verifyLeadOwnership(id);
    if (authCheck.error) return authCheck.response;

    const { tourSchedule } = await request.json();
    const supabase = getSupabaseAdmin();

    if (!tourSchedule || Object.keys(tourSchedule).length === 0) {
      return NextResponse.json(
        { error: "Tour schedule (with dates and times for each property) required" },
        { status: 400 }
      );
    }

    console.log(`[schedule-tour] Received request for lead ${id}`);
    console.log(`[schedule-tour] Tour schedule keys:`, Object.keys(tourSchedule));
    console.log(`[schedule-tour] Full tour schedule:`, tourSchedule);

    // Get the lead
    const { data: lead, error: fetchErr } = await supabase
      .from("leads")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    // Get all lead_matches with cx_response="interested"
    const { data: interestedMatches } = await supabase
      .from("lead_matches")
      .select("id, unit_id, property_id, apartment_id, units(*), apartments(*), properties(*)")
      .eq("lead_id", id)
      .eq("cx_response", "interested");

    // Also get manually added properties from lead_property_selections
    const { data: manualSelections } = await supabase
      .from("lead_property_selections")
      .select("property_id")
      .eq("lead_id", id)
      .eq("account_id", authCheck.account.id);

    // Extract apartment IDs from manually added properties (format: apt_X)
    const manualApartmentIds = (manualSelections || [])
      .filter(ls => ls.property_id?.startsWith("apt_"))
      .map(ls => parseInt(ls.property_id.replace("apt_", "")))
      .filter(id => !isNaN(id));

    console.log(`[schedule-tour] Lead ${id} - Manual apartment IDs from lead_property_selections:`, manualApartmentIds);

    if ((!interestedMatches || interestedMatches.length === 0) && manualApartmentIds.length === 0) {
      return NextResponse.json(
        { error: "No interested properties found" },
        { status: 400 }
      );
    }

    // Extract apartment IDs from both tourSchedule keys AND from lead_matches entries with apartment_id
    const apartmentIdsFromSchedule = Object.keys(tourSchedule)
      .filter(key => key.startsWith("apartment-"))
      .map(key => parseInt(key.replace("apartment-", "")));
    
    const apartmentIdsFromMatches = (interestedMatches || [])
      .filter(match => match.apartment_id)
      .map(match => match.apartment_id);
    
    const allApartmentIds = [...new Set([...apartmentIdsFromSchedule, ...apartmentIdsFromMatches, ...manualApartmentIds])];

    let selectedApartments = [];
    if (allApartmentIds.length > 0) {
      const { data: apts } = await supabase
        .from("apartments")
        .select("*")
        .in("id", allApartmentIds)
        .eq("account_id", authCheck.account.id);
      selectedApartments = apts || [];
      console.log(`Fetched ${selectedApartments.length} apartments for scheduling`);
    }

    // Build properties array for email with per-property dates and times
    const emailProperties = (interestedMatches || []).map((match) => {
      // Determine selection ID and schedule
      let selectionId, schedule;
      
      if (match.unit_id) {
        selectionId = `unit-${match.unit_id}`;
        schedule = tourSchedule[selectionId];
      } else if (match.apartment_id) {
        selectionId = `apartment-${match.apartment_id}`;
        schedule = tourSchedule[selectionId];
      } else if (match.property_id) {
        selectionId = `property-${match.property_id}`;
        schedule = tourSchedule[selectionId];
      }
      
      if (!schedule || !schedule.date || !schedule.time) {
        console.warn(`Missing schedule for ${selectionId}`);
        return null;
      }

      if (match.unit_id) {
        // Unit match
        const u = match.units;
        const a = match.apartments;
        const rentLo = Number(u?.rent_min);
        const rentHi = Number(u?.rent_max);
        
        let rentRange = "Contact for pricing";
        if (rentLo || rentHi) {
          if (!rentLo) {
            rentRange = `$${rentHi.toLocaleString()}/mo`;
          } else if (!rentHi) {
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
          type: "unit",
          name: a?.name || "Unknown",
          bedrooms: u?.bedrooms,
          bathrooms: u?.bathrooms,
          rent_range: rentRange,
          tour_date: schedule.date,
          tour_time: schedule.time,
          scheduled_tour_datetime: `${schedule.date} at ${schedule.time}`,
        };
      } else if (match.property_id) {
        // Property match
        const p = match.properties;
        let priceRange = "Contact for pricing";
        if (p?.price_min || p?.price_max) {
          if (!p.price_max) {
            priceRange = `$${Number(p.price_min || 0).toLocaleString()}/mo`;
          } else if (!p.price_min) {
            priceRange = `$${Number(p.price_max).toLocaleString()}/mo`;
          } else if (p.price_min === p.price_max) {
            priceRange = `$${Number(p.price_min).toLocaleString()}/mo`;
          } else {
            priceRange = `$${Number(p.price_min).toLocaleString()}–$${Number(p.price_max).toLocaleString()}/mo`;
          }
        }

        return {
          type: "property",
          name: p?.property_name || "Property",
          address: p?.address,
          bedrooms: p?.bedrooms,
          bathrooms: p?.bathrooms,
          price_range: priceRange,
          tour_date: schedule.date,
          tour_time: schedule.time,
          scheduled_tour_datetime: `${schedule.date} at ${schedule.time}`,
        };
      } else if (match.apartment_id) {
        // Apartment match - find the apartment from selectedApartments
        const apt = selectedApartments.find(a => a.id === match.apartment_id);
        
        if (!apt) {
          console.warn(`Apartment ${match.apartment_id} not found`);
          return null;
        }

        return {
          type: "apartment",
          name: apt.name || "Apartment",
          address: apt.address,
          bedrooms: apt.bedrooms,
          bathrooms: apt.bathrooms,
          deposit: apt.deposit_min,
          app_fee: apt.app_fee,
          specials: apt.specials,
          tour_date: schedule.date,
          tour_time: schedule.time,
          scheduled_tour_datetime: `${schedule.date} at ${schedule.time}`,
        };
      }
    }).filter(Boolean); // Remove nulls

    // Add selected apartments to email properties
    const apartmentEmailProps = selectedApartments.map(apt => {
      const selectionId = `apartment-${apt.id}`;
      const schedule = tourSchedule[selectionId];
      
      if (!schedule || !schedule.date || !schedule.time) {
        console.warn(`Missing schedule for apt ${apt.id}`);
        return null;
      }

      return {
        type: "apartment",
        name: apt.name || "Apartment",
        address: apt.address,
        bedrooms: apt.bedrooms,
        bathrooms: apt.bathrooms,
        deposit: apt.deposit_min,
        app_fee: apt.app_fee,
        specials: apt.specials,
        tour_date: schedule.date,
        tour_time: schedule.time,
        scheduled_tour_datetime: `${schedule.date} at ${schedule.time}`,
      };
    }).filter(Boolean);

    // Combine all properties for email
    const allEmailProperties = [...emailProperties, ...apartmentEmailProps];

    if (allEmailProperties.length === 0) {
      return NextResponse.json(
        { error: "No valid schedules provided" },
        { status: 400 }
      );
    }

    // Build tour details array with per-property dates and times
    const tourDetailsArray = (interestedMatches || []).map((match) => {
      let selectionId, schedule;
      
      if (match.unit_id) {
        selectionId = `unit-${match.unit_id}`;
      } else if (match.apartment_id) {
        selectionId = `apartment-${match.apartment_id}`;
      } else {
        selectionId = `property-${match.property_id}`;
      }
      schedule = tourSchedule[selectionId];
      
      return {
        unit_id: match.unit_id || null,
        property_id: match.property_id || null,
        apartment_id: match.apartment_id || null,
        property_name: match.unit_id ? match.apartments?.name : match.properties?.property_name,
        property_address: match.properties?.address,
        bedrooms: match.units?.bedrooms || match.properties?.bedrooms,
        bathrooms: match.units?.bathrooms || match.properties?.bathrooms,
        tour_date: schedule?.date,
        tour_time: schedule?.time,
        scheduled_tour_datetime: schedule ? `${schedule.date} at ${schedule.time}` : null,
        type: match.unit_id ? "unit" : "property",
      };
    });

    // Also add manually added apartments to tour details
    // Only process apartments that are NOT in lead_matches
    const manualApartmentIdsSet = new Set(manualApartmentIds);
    const manuallyAddedApartmentTourDetails = selectedApartments
      .filter(apt => {
        const isManual = manualApartmentIdsSet.has(apt.id);
        console.log(`[schedule-tour] Checking apartment ${apt.id} (${apt.name}): isManual=${isManual}`);
        return isManual;
      })
      .map(apt => {
        const selectionId = `apartment-${apt.id}`;
        const schedule = tourSchedule[selectionId];
        
        console.log(`[schedule-tour] Processing manually added apartment ${apt.id}:`, {
          selectionId,
          hasSchedule: !!schedule,
          date: schedule?.date,
          time: schedule?.time,
        });
        
        if (!schedule || !schedule.date || !schedule.time) {
          console.warn(`Missing schedule for manually added apt ${apt.id}`);
          return null;
        }

        return {
          unit_id: null,
          property_id: null,
          apartment_id: apt.id,
          property_name: apt.name,
          property_address: apt.address,
          bedrooms: apt.bedrooms,
          bathrooms: apt.bathrooms,
          tour_date: schedule.date,
          tour_time: schedule.time,
          scheduled_tour_datetime: `${schedule.date} at ${schedule.time}`,
          type: "apartment",
        };
      })
      .filter(Boolean);

    console.log(`[schedule-tour] Manual apartment tour details built:`, {
      count: manuallyAddedApartmentTourDetails.length,
      apartments: manuallyAddedApartmentTourDetails.map(t => `${t.property_name} (${t.apartment_id})`),
    });

    // Combine both sources and deduplicate
    const seenTourIds = new Set();
    const uniqueTourDetailsArray = [...tourDetailsArray, ...manuallyAddedApartmentTourDetails]
      .filter(tour => {
        let tourId;
        if (tour.unit_id) {
          tourId = `unit-${tour.unit_id}`;
        } else if (tour.apartment_id) {
          tourId = `apartment-${tour.apartment_id}`;
        } else if (tour.property_id) {
          tourId = `property-${tour.property_id}`;
        } else {
          return true;
        }

        if (seenTourIds.has(tourId)) {
          console.warn(`[schedule-tour] Filtering out duplicate tour for: ${tourId}`);
          return false;
        }
        seenTourIds.add(tourId);
        return true;
      });
    
    console.log(`[schedule-tour] Full tour details array after deduplication:`, {
      totalCount: uniqueTourDetailsArray.length,
      fromMatches: tourDetailsArray.length,
      fromManual: manuallyAddedApartmentTourDetails.length,
    });

    // Create timeline event with summary of all scheduled tours
    const timesSummary = allEmailProperties
      .map(p => `${p.name} at ${p.tour_time}`)
      .join(", ");
    const newEvent = {
      stage: "tour_scheduled",
      timestamp: new Date().toISOString(),
      notes: `Tours scheduled: ${timesSummary}`,
      data: {
        scheduled_count: allEmailProperties.length,
      },
      visibility: "both",
    };

    const updatedTimeline = [...(lead.timeline || []), newEvent];

    // Update lead
    const { data: updated, error: updateErr } = await supabase
      .from("leads")
      .update({
        tour_details: uniqueTourDetailsArray,
        current_status: "tour_scheduled",
        timeline: updatedTimeline,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Send confirmation email to client
    try {
      const confirmationUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/tour-confirmation/${lead.results_token}`;
      
      await sendTourConfirmationEmail({
        to: lead.email,
        clientName: lead.full_name,
        properties: allEmailProperties,
        confirmationUrl,
        agentName: "Lorenzo Foster",
      });
    } catch (emailErr) {
      console.error("Error sending tour confirmation email:", emailErr);
    }

    return NextResponse.json({
      success: true,
      message: "Tour scheduled and confirmation email sent",
      lead: updated,
    });
  } catch (err) {
    console.error("Error scheduling tour:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
