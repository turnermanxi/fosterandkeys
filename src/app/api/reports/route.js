import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCurrentAccountId } from "@/lib/accounts";
import { renderEmailTemplate } from "@/lib/emailRenderer";
import { sendPropertyEmail } from "@/lib/mailer";

/**
 * POST /api/reports
 * Create a report (compose email preview without sending)
 *
 * Body:
 *   - property_ids (array of property UUIDs, optional)
 *   - apartment_ids (array of apartment IDs, optional)
 *   - lead_id (UUID of lead to send to)
 *   - template_id (UUID of email template, optional)
 *   - custom_subject (optional override)
 *   - custom_body (optional override HTML)
 */
export async function POST(request) {
  try {
    const accountId = await getCurrentAccountId();
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { property_ids = [], apartment_ids = [], lead_id, template_id, custom_subject, custom_body } =
      body;

    if ((property_ids.length === 0 && apartment_ids.length === 0)) {
      return NextResponse.json(
        { error: "Either property_ids or apartment_ids is required" },
        { status: 400 }
      );
    }

    if (!lead_id) {
      return NextResponse.json(
        { error: "lead_id is required" },
        { status: 400 }
      );
    }

    let properties = [];

    // Fetch properties from properties table
    if (property_ids.length > 0) {
      const { data: propsData, error: propErr } = await supabase
        .from("properties")
        .select("*")
        .in("id", property_ids);

      if (propErr) {
        console.error("Error fetching properties:", propErr);
        return NextResponse.json(
          { error: "Failed to load properties: " + propErr.message },
          { status: 500 }
        );
      }

      if (!propsData || propsData.length === 0) {
        console.error("Properties not found. Searched for IDs:", property_ids);
        return NextResponse.json(
          { error: "No properties found for the specified IDs" },
          { status: 404 }
        );
      }

      // Verify ownership: check that all properties belong to this account
      const unauthorizedIds = propsData
        .filter((p) => p.account_id !== accountId)
        .map((p) => p.id);
      if (unauthorizedIds.length > 0) {
        console.error("Unauthorized access to properties:", unauthorizedIds);
        return NextResponse.json(
          { error: "You don't have permission to access one or more of these properties" },
          { status: 403 }
        );
      }

      properties = propsData;
    }

    // Fetch apartments from apartments table
    if (apartment_ids.length > 0) {
      const { data: aptsData, error: aptErr } = await supabase
        .from("apartments")
        .select("*")
        .in("id", apartment_ids)
        .eq("account_id", accountId);

      if (aptErr) {
        console.error("Error fetching apartments:", aptErr);
        return NextResponse.json(
          { error: "Failed to load apartments: " + aptErr.message },
          { status: 500 }
        );
      }

      if (!aptsData || aptsData.length === 0) {
        console.error("Apartments not found. Searched for IDs:", apartment_ids);
        return NextResponse.json(
          { error: "No apartments found for the specified IDs" },
          { status: 404 }
        );
      }

      // Convert apartments to properties format
      const convertedApts = aptsData.map((apt) => ({
        id: `apt_${apt.id}`,
        property_name: apt.name,
        address: null,
        city: apt.city,
        state: "TX",
        zip: null,
        price_min: null,
        price_max: null,
        bedrooms: null,
        bathrooms: null,
        sqft: null,
        property_type: "apartment",
        source: "apartment_data",
        apartment_id: apt.id,
        is_favorite: false,
        is_archived: false,
        is_active: true,
        created_at: apt.created_at,
        contact_name: null,
        contact_phone: null,
        contact_email: null,
        website: apt.url,
        notes: apt.notes,
        admin_fee: apt.admin_fee,
        app_fee: apt.app_fee,
        accepts_broken_lease: apt.accepts_broken_lease,
        accepts_bankruptcy: apt.accepts_bankruptcy,
        accepts_eviction: apt.accepts_eviction,
        metro_area: apt.metro_area,
      }));

      properties = [...properties, ...convertedApts];
    }

    if (properties.length === 0) {
      return NextResponse.json(
        { error: "No properties or apartments found" },
        { status: 404 }
      );
    }

    // Fetch lead
    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    // Fetch account (agent info)
    const { data: account, error: accountErr } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", accountId)
      .single();

    if (accountErr) {
      console.error("Error fetching account:", accountErr);
      return NextResponse.json(
        { error: "Failed to load account information: " + accountErr.message },
        { status: 500 }
      );
    }

    // Fetch template (or use default)
    let template = null;
    if (template_id) {
      const { data: t, error: templateErr } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", template_id)
        .eq("account_id", accountId)
        .single();
      if (templateErr && templateErr.code !== "PGRST116") {
        console.error("Error fetching template:", templateErr);
        return NextResponse.json(
          { error: "Failed to load email template: " + templateErr.message },
          { status: 500 }
        );
      }
      template = t;
    } else {
      const { data: t, error: templateErr } = await supabase
        .from("email_templates")
        .select("*")
        .eq("account_id", accountId)
        .eq("is_default", true)
        .single();
      if (templateErr && templateErr.code !== "PGRST116") {
        console.error("Error fetching default template:", templateErr);
        return NextResponse.json(
          { error: "Failed to load email template: " + templateErr.message },
          { status: 500 }
        );
      }
      template = t;
    }

    // If no template found, use a default template
    if (!template) {
      template = {
        id: null,
        subject: "Properties Matching Your Criteria",
        body: `
        <html>
          <body style="font-family: Arial, sans-serif; color: #333;">
            <h1>Hi {{lead.full_name}},</h1>
            <p>We found some great properties matching your criteria in {{lead.desired_location}}.</p>
            {{properties_list}}
            <p>Let me know if you're interested in any of these!</p>
            <p>Best regards,<br>{{agent.name}}</p>
          </body>
        </html>
      `,
      };
    }

    // Render email
    const subject = custom_subject || template.subject;
    const bodyTemplate = custom_body || template.body;
    const emailHtml = renderEmailTemplate(bodyTemplate, properties, lead, account);

    return NextResponse.json({
      success: true,
      report: {
        template_id: template.id,
        subject,
        email_preview_html: emailHtml,
        properties,
        lead,
        property_ids,
      },
    });
  } catch (err) {
    console.error("POST /api/reports error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/reports
 * Get recent reports (property sends to leads)
 */
export async function GET(request) {
  try {
    const accountId = await getCurrentAccountId();
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);

    const { data: sends } = await supabase
      .from("property_sends")
      .select(
        `
        id,
        sent_at,
        sent_to_email,
        lead:leads(id, full_name, email),
        property:properties(id, property_name, address, city)
      `
      )
      .eq("account_id", accountId)
      .order("sent_at", { ascending: false })
      .limit(limit);

    // Group by send date/group
    const grouped = {};
    (sends || []).forEach((send) => {
      const key = new Date(send.sent_at).toLocaleDateString();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(send);
    });

    return NextResponse.json({
      reports: grouped,
    });
  } catch (err) {
    console.error("GET /api/reports error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
