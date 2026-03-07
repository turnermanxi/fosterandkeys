import { getSupabaseAdmin } from "@/lib/supabase";
import UnitCard from "@/components/UnitCard";

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

  // 2. Get matches with unit + apartment data
  const { data: matches } = await supabase
    .from("lead_matches")
    .select("score, unit_id, apartment_id, units(*), apartments(*)")
    .eq("lead_id", lead.id)
    .order("score", { ascending: false });

  return (
    <div className="page-wrapper">
      <div className="results-hero">
        <h1>Hi {lead.full_name.split(" ")[0]}, here are your matches!</h1>
        <p>
          We found <strong>{matches?.length ?? 0}</strong> units that match
          your criteria.
        </p>
      </div>

      {lead.ai_summary && (
        <div style={{
          marginBottom: 24,
          padding: "20px 24px",
          background: "linear-gradient(135deg, #eef2ff, #f0fdf4)",
          borderRadius: 10,
          border: "1px solid #c7d2fe",
          fontSize: ".95rem",
          lineHeight: 1.8,
        }}>
          <strong style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: "1.1rem" }}>✨</span> Your Personalized Summary
          </strong>
          <p style={{ margin: 0 }}>{lead.ai_summary}</p>
        </div>
      )}

      {matches && matches.length > 0 ? (
        matches.map((m) => (
          <UnitCard
            key={m.unit_id}
            unit={m.units}
            apartment={m.apartments}
            score={m.score}
          />
        ))
      ) : (
        <div className="card" style={{ textAlign: "center" }}>
          <p className="text-muted">
            No matching units at this time. Your agent will update you soon!
          </p>
        </div>
      )}
    </div>
  );
}
