import { getSupabaseAdmin } from "@/lib/supabase";
import { generateSqftRange, generateBedroomRangeDisplay } from "@/lib/propertyFormatters";
import UnitCard from "@/components/UnitCard";
import ClientPreferenceForm from "@/components/ClientPreferenceForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  return {
    title: "Your Apartment Matches — Foster & Keys",
  };
}

export default async function ResultsPage({ params }) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  // 1. Find the lead by token
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("*")
    .eq("results_token", token)
    .single();

  if (leadErr || !lead) {
    return (
      <div className="page-wrapper" style={{ textAlign: "center", paddingTop: 80 }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Link Not Found</h1>
        <p className="text-muted">
          This results link is invalid or has expired. Please contact your agent.
        </p>
      </div>
    );
  }

  // 2. Get all matches (both units and manual properties) from lead_matches
  const { data: allMatches } = await supabase
    .from("lead_matches")
    .select("id, score, unit_id, property_id, apartment_id, units(*), apartments(*), properties(*)")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: false });

  // 3. Get manually added apartments and properties from lead_property_selections
  const { data: selectedProps } = await supabase
    .from("lead_property_selections")
    .select("property_id")
    .eq("lead_id", lead.id);

  // Separate apartments from regular properties from selection IDs
  const selectedApartmentIds = (selectedProps || [])
    .map(p => p.property_id)
    .filter(id => typeof id === "string" && id.startsWith("apt_"))
    .map(id => parseInt(id.replace("apt_", ""), 10));

  const selectedPropertyIds = (selectedProps || [])
    .map(p => p.property_id)
    .filter(id => typeof id === "string" && !id.startsWith("apt_"));

  // Fetch apartment details
  let apartmentMatches = [];
  if (selectedApartmentIds.length > 0) {
    const { data: apts } = await supabase
      .from("apartments")
      .select("*")
      .in("id", selectedApartmentIds);

    apartmentMatches = (apts || []).map((apt) => ({
      match_id: `apt_${apt.id}`,
      type: "apartment",
      score: null,
      unit: null,
      apartment: apt,
      property: null,
    }));
  }

  // Fetch regular property details
  let propertyMatches = [];
  if (selectedPropertyIds.length > 0) {
    const { data: props } = await supabase
      .from("properties")
      .select("*")
      .in("id", selectedPropertyIds);

    propertyMatches = (props || []).map((prop) => ({
      match_id: `prop_${prop.id}`,
      type: "property",
      score: null,
      unit: null,
      apartment: null,
      property: prop,
    }));
  }

  // Combine unit, property, and apartment matches
  const baseMatches = (allMatches ?? []).map((m) => ({
    match_id: m.id,
    type: m.unit_id ? "unit" : m.apartment_id ? "apartment" : "property",
    score: m.score || 0,
    unit_id: m.unit_id,
    property_id: m.property_id,
    apartment_id: m.apartment_id,
    unit: m.units || null,
    apartment: m.apartments || null,
    property: m.properties || null,
  }));

  // Deduplicate: track which properties/apartments are already in baseMatches
  const existingPropertyIds = new Set(
    baseMatches
      .filter(m => m.type === "property" && m.property_id)
      .map(m => m.property_id)
  );

  const existingApartmentIds = new Set(
    baseMatches
      .filter(m => m.type === "apartment" && m.apartment_id)
      .map(m => m.apartment_id)
  );

  // Only include properties/apartments that aren't already in baseMatches
  const deduplicatedPropertyMatches = propertyMatches.filter(
    pm => !existingPropertyIds.has(pm.property.id)
  );

  const deduplicatedApartmentMatches = apartmentMatches.filter(
    am => !existingApartmentIds.has(am.apartment.id)
  );

  const combinedMatches = [...baseMatches, ...deduplicatedPropertyMatches, ...deduplicatedApartmentMatches];

  return (
    <div className="page-wrapper">
      <div className="results-hero">
        <h1>Hi {lead.full_name.split(" ")[0]}, here are your matches!</h1>
        <p>
          We found <strong>{combinedMatches?.length ?? 0}</strong> properties for you. Select the ones you'd like to explore!
        </p>
      </div>

      {lead.ai_summary && (
        <div style={{
          marginBottom: 24,
          padding: "20px 24px",
          background: "linear-gradient(135deg, var(--info-bg), var(--success-bg))",
          borderRadius: 10,
          border: "1px solid var(--info-border)",
          fontSize: ".95rem",
          lineHeight: 1.8,
        }}>
          <strong style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: "1.1rem" }}>✨</span> Your Personalized Summary
          </strong>
          <p style={{ margin: 0 }}>{lead.ai_summary}</p>
        </div>
      )}

      {combinedMatches && combinedMatches.length > 0 ? (
        <>
          <div style={{ marginBottom: 32 }}>
            {combinedMatches.map((m) => {
              if (m.type === "unit") {
                return (
                  <UnitCard
                    key={`unit-${m.unit.id}`}
                    unit={m.unit}
                    apartment={m.apartment}
                    score={m.score}
                  />
                );
              }

              if (m.type === "apartment") {
                const apt = m.apartment;
                return (
                  <div key={`apartment-${apt.id}`} style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: 16,
                    marginBottom: 12,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                      <div>
                        <h3 style={{ margin: "0 0 4px 0", color: "var(--text-strong)", fontSize: "1rem" }}>
                          {apt.name || "Apartment"}
                        </h3>
                        <p style={{ margin: "0 0 8px 0", color: "var(--text-muted)", fontSize: ".9rem" }}>
                          {apt.address || "Address not available"}
                        </p>
                      </div>
                      {(apt.website || apt.url) && (
                        <a href={apt.website || apt.url} target="_blank" rel="noopener noreferrer" 
                           style={{ color: "var(--link)", textDecoration: "none", whiteSpace: "nowrap", marginLeft: 8 }}>
                          Visit →
                        </a>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: ".9rem" }}>
                        <span style={{ color: "var(--text-muted)" }}>Deposit:</span> ${apt.deposit_min || "—"}
                      </div>
                      <div style={{ fontSize: ".9rem" }}>
                        <span style={{ color: "var(--text-muted)" }}>App Fee:</span> ${apt.app_fee || "—"}
                      </div>
                    </div>
                    {apt.specials && (
                      <div style={{ fontSize: ".9rem", padding: 8, background: "var(--warning-bg)", borderRadius: 6, color: "var(--warning-text)" }}>
                        <strong>Special Offer:</strong> {apt.specials}
                      </div>
                    )}
                  </div>
                );
              }

              if (m.type === "property") {
                return (
                  <div key={`property-${m.property.id}`} style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: 16,
                    marginBottom: 12,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                      <div>
                        <h3 style={{ margin: "0 0 4px 0", color: "var(--text-strong)", fontSize: "1rem" }}>
                          {m.property.property_name || "Property"}
                        </h3>
                        <p style={{ margin: "0 0 8px 0", color: "var(--text-muted)", fontSize: ".9rem" }}>
                          {m.property.address}
                        </p>
                      </div>
                      {m.property.website && (
                        <a href={m.property.website} target="_blank" rel="noopener noreferrer" 
                           style={{ color: "var(--link)", textDecoration: "none", whiteSpace: "nowrap", marginLeft: 8 }}>
                          View →
                        </a>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: ".9rem" }}>
                        <span style={{ color: "var(--text-muted)" }}>Bedrooms:</span> {generateBedroomRangeDisplay(m.property)}
                      </div>
                      <div style={{ fontSize: ".9rem" }}>
                        <span style={{ color: "var(--text-muted)" }}>Bathrooms:</span> {m.property.bathrooms || "—"}
                      </div>
                      <div style={{ fontSize: ".9rem" }}>
                        <span style={{ color: "var(--text-muted)" }}>Price:</span> ${m.property.price_min || "—"} {m.property.price_max && `– $${m.property.price_max}`}/mo
                      </div>
                      <div style={{ fontSize: ".9rem" }}>
                        <span style={{ color: "var(--text-muted)" }}>Sqft:</span> {generateSqftRange(m.property)}
                      </div>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
          {/* Client Preference Form */}
          <ClientPreferenceForm 
            leadId={lead.id}
            leadToken={lead.results_token}
            matches={combinedMatches}
          />
        </>
      ) : (
        <div className="card" style={{ textAlign: "center" }}>
          <p className="text-muted">
            No matching properties at this time. Your agent will update you soon!
          </p>
          
          <ClientPreferenceForm 
            leadId={lead.id}
            leadToken={lead.results_token}
            matches={[]}
          />
        </div>
      )}
    </div>
  );
}
