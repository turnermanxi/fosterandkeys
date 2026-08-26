function scoreBadge(score) {
  let cls = "low";
  if (score >= 70) cls = "high";
  else if (score >= 40) cls = "medium";
  return <span className={`score-badge ${cls}`}>{score}% match</span>;
}

function formatRent(unit) {
  const lo = Number(unit?.rent_min);
  const hi = Number(unit?.rent_max);
  if (!lo && !hi) return "Contact for pricing";
  
  // If no range, create one with ±$100 buffer
  if (lo && !hi) {
    const min = Math.max(0, lo - 100);
    const max = lo + 100;
    return `$${min.toLocaleString()} – $${max.toLocaleString()}/mo`;
  }
  
  if (lo === hi) {
    const min = Math.max(0, lo - 100);
    const max = lo + 100;
    return `$${min.toLocaleString()} – $${max.toLocaleString()}/mo`;
  }
  
  return `$${lo.toLocaleString()} – $${hi.toLocaleString()}/mo`;
}

function formatMetro(metro) {
  if (metro === "HOUSTON_METRO") return "Houston Metro";
  if (metro === "DFW_METRO") return "Dallas–Fort Worth Metro";
  return metro ?? "—";
}

function AcceptanceBadge({ label, value }) {
  if (value === true) return <span className="accept-badge accept-yes">✓ {label}</span>;
  if (value === false) return <span className="accept-badge accept-no">✗ {label}</span>;
  return <span className="accept-badge accept-unknown">? {label}</span>;
}

export default function UnitCard({ unit, apartment, score }) {
  const u = unit ?? {};
  const apt = apartment ?? {};

  return (
    <div className="property-card">
      <div className="property-card-body" style={{ flex: 1 }}>
        <div className="flex-between">
          <h3>
            {apt.url ? (
              <a href={apt.url} target="_blank" rel="noopener noreferrer" className="property-link">
                {apt.name ?? "Unknown Apartment"} <span className="link-icon">↗</span>
              </a>
            ) : (
              apt.name ?? "Unknown Apartment"
            )}
          </h3>
          {scoreBadge(score)}
        </div>
        <p className="meta">
          {formatMetro(apt.metro_area)}
          {apt.city ? ` · ${apt.city}` : ""}
          {" · "}
          {u.bedrooms != null ? (u.bedrooms === 0 ? "Studio" : `${u.bedrooms} bed`) : "—"}
          {" / "}
          {u.bathrooms ?? "—"} bath
          {u.sqft_min ? ` · ${u.sqft_min.toLocaleString()} sqft` : ""}
          {u.floorplan ? ` · Plan: ${u.floorplan}` : ""}
          {u.unit_number ? ` · Unit ${u.unit_number}` : ""}
        </p>
        <p className="meta" style={{ fontWeight: 600, fontSize: "1.05rem", color: "var(--color-primary)" }}>
          {formatRent(u)}
        </p>

        {/* Apartment details */}
        <div style={{ fontSize: ".88rem", color: "var(--color-text-muted)", marginTop: 8, lineHeight: 1.8 }}>
          {apt.deposit_min != null && (
            <span style={{ marginRight: 16 }}>
              Deposit: ${Number(apt.deposit_min).toLocaleString()}
              {apt.deposit_max ? ` – $${Number(apt.deposit_max).toLocaleString()}` : ""}
            </span>
          )}
          {apt.app_fee != null && (
            <span style={{ marginRight: 16 }}>App fee: ${Number(apt.app_fee)}</span>
          )}
          {apt.admin_fee != null && (
            <span style={{ marginRight: 16 }}>Admin fee: ${Number(apt.admin_fee)}</span>
          )}
          {apt.income_multiplier && (
            <span style={{ marginRight: 16 }}>Income: {apt.income_multiplier}x rent</span>
          )}
          {apt.lease_min_months && (
            <span>
              Lease: {apt.lease_min_months}
              {apt.lease_max_months && apt.lease_max_months !== apt.lease_min_months
                ? `–${apt.lease_max_months}`
                : ""}{" "}
              months
            </span>
          )}
        </div>

        {/* Acceptance badges */}
        {(apt.accepts_broken_lease != null || apt.accepts_bankruptcy != null || apt.accepts_eviction != null) && (
          <div className="acceptance-row">
            <AcceptanceBadge label="Broken Lease" value={apt.accepts_broken_lease} />
            <AcceptanceBadge label="Bankruptcy" value={apt.accepts_bankruptcy} />
            <AcceptanceBadge label="Eviction" value={apt.accepts_eviction} />
          </div>
        )}

        {apt.specials && (
          <p style={{
            marginTop: 8,
            padding: "6px 12px",
            background: "#fef3c7",
            borderRadius: 6,
            fontSize: ".88rem",
            color: "#92400e",
            fontWeight: 500,
          }}>
            ★ {apt.specials}
          </p>
        )}

        {(apt.notes || u.notes) && (
          <p className="description" style={{ marginTop: 8 }}>
            {u.notes ? u.notes : ""}
            {u.notes && apt.notes ? " · " : ""}
            {apt.notes ? apt.notes : ""}
          </p>
        )}
      </div>
    </div>
  );
}
