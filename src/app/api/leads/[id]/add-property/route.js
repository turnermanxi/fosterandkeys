import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCurrentAccountId } from "@/lib/accounts";
import { verifyLeadOwnership } from "@/lib/api-auth";

/**
 * POST /api/leads/[id]/add-property
 * Add a manual property or apartment to a lead's match list
 * Stores in lead_property_selections table for unified property handling
 *
 * Body:
 *   - property_id (UUID of regular property, optional)
 *   - apartment_id (BIGINT id of apartment, optional)
 */
export async function POST(request, { params }) {
  try {
    const { id: leadId } = await params;

    // Verify lead ownership first
    const authCheck = await verifyLeadOwnership(leadId);
    if (authCheck.error) return authCheck.response;

    const { property_id, apartment_id } = await request.json();

    console.log(`[add-property] Received request for lead ${leadId}:`, {
      property_id,
      apartment_id,
    });

    if (!property_id && !apartment_id) {
      return NextResponse.json(
        { error: "Either property_id or apartment_id is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const accountId = await getCurrentAccountId();

    if (!accountId) {
      return NextResponse.json(
        { error: "Unable to determine account" },
        { status: 401 }
      );
    }

    console.log(`[add-property] Account ID: ${accountId}`);

    // For properties, insert into lead_property_selections table
    if (property_id) {
      const { data: property, error: propErr } = await supabase
        .from("properties")
        .select("id")
        .eq("id", property_id)
        .eq("account_id", accountId)
        .single();

      console.log(`[add-property] Property lookup for ${property_id}:`, {
        found: !!property,
        error: propErr?.message,
      });

      if (propErr || !property) {
        console.error(`[add-property] Property ${property_id} not found`, propErr);
        return NextResponse.json(
          { error: "Property not found" },
          { status: 404 }
        );
      }

      // Check if already added
      const { data: existing, error: existErr } = await supabase
        .from("lead_property_selections")
        .select("id")
        .eq("lead_id", leadId)
        .eq("property_id", property_id.toString())
        .eq("account_id", accountId);

      console.log(`[add-property] Duplicate check for ${property_id}:`, {
        alreadyExists: !!existing,
        existCount: existing?.length,
        error: existErr?.message,
      });

      if (existing && existing.length > 0) {
        console.log(`[add-property] Property already selected, skipping insert`);
        return NextResponse.json({
          success: true,
          message: "Property already in lead's match list",
        });
      }

      // Insert into lead_property_selections
      const propertyIdStr = property_id.toString();
      const { data: insertData, error: insertErr } = await supabase
        .from("lead_property_selections")
        .insert({
          lead_id: leadId,
          property_id: propertyIdStr,
          account_id: accountId,
        });

      console.log(`[add-property] Insert result for ${property_id}:`, {
        success: !insertErr,
        error: insertErr?.message,
        insertData,
      });

      if (insertErr) {
        console.error("Error inserting property selection:", insertErr);
        throw insertErr;
      }

      console.log(`Added property ${property_id} to lead ${leadId}`);

      return NextResponse.json({
        success: true,
        message: "Property added to lead's match list",
      });
    } else if (apartment_id) {
      // For apartments, insert into lead_property_selections with "apt_X" format
      const { data: apartment, error: aptErr } = await supabase
        .from("apartments")
        .select("id")
        .eq("id", apartment_id)
        .eq("account_id", accountId)
        .single();

      console.log(`[add-property] Apartment lookup for apt_${apartment_id}:`, {
        found: !!apartment,
        error: aptErr?.message,
      });

      if (aptErr || !apartment) {
        console.error(`[add-property] Apartment ${apartment_id} not found`, aptErr);
        return NextResponse.json(
          { error: "Apartment not found" },
          { status: 404 }
        );
      }

      // Format apartment ID as "apt_X" for lead_property_selections
      const apartmentSelectionId = `apt_${apartment_id}`;

      // Check if already added
      const { data: existing, error: existErr } = await supabase
        .from("lead_property_selections")
        .select("id")
        .eq("lead_id", leadId)
        .eq("property_id", apartmentSelectionId)
        .eq("account_id", accountId);

      console.log(`[add-property] Duplicate check for ${apartmentSelectionId}:`, {
        alreadyExists: !!existing,
        existCount: existing?.length,
        error: existErr?.message,
      });

      if (existing && existing.length > 0) {
        console.log(`[add-property] Apartment already selected, skipping insert`);
        return NextResponse.json({
          success: true,
          message: "Apartment already in lead's match list",
        });
      }

      // Insert into lead_property_selections with "apt_X" format
      const { data: insertData, error: insertErr } = await supabase
        .from("lead_property_selections")
        .insert({
          lead_id: leadId,
          property_id: apartmentSelectionId, // Store as "apt_X" format
          account_id: accountId,
        });

      console.log(`[add-property] Insert result for ${apartmentSelectionId}:`, {
        success: !insertErr,
        error: insertErr?.message,
        insertData,
      });

      if (insertErr) {
        console.error("Error inserting apartment selection:", insertErr);
        throw insertErr;
      }

      console.log(`Added apartment ${apartment_id} to lead ${leadId}`);

      return NextResponse.json({
        success: true,
        message: "Apartment added to lead's match list",
      });
    }
  } catch (err) {
    console.error("POST /api/leads/[id]/add-property error:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
