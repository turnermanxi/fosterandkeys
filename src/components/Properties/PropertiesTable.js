"use client";

import { generateSqftRange, generateBedroomRangeDisplay } from "@/lib/propertyFormatters";

export default function PropertiesTable({ properties, onSelect }) {
  function formatPrice(min, max) {
    if (!min && !max) return "–";
    if (!max) return `$${Number(min || 0).toLocaleString()}`;
    if (!min) return `$${Number(max || 0).toLocaleString()}`;
    return `$${Number(min).toLocaleString()} – $${Number(max).toLocaleString()}`;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.9rem",
        }}
      >
        <thead>
          <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
            <th style={{ padding: "12px 16px", textAlign: "left" }}>★</th>
            <th style={{ padding: "12px 16px", textAlign: "left" }}>Address</th>
            <th style={{ padding: "12px 16px", textAlign: "left" }}>City</th>
            <th style={{ padding: "12px 16px", textAlign: "left" }}>Price</th>
            <th style={{ padding: "12px 16px", textAlign: "left" }}>Beds</th>
            <th style={{ padding: "12px 16px", textAlign: "left" }}>Sqft</th>
            <th style={{ padding: "12px 16px", textAlign: "left" }}>Tags</th>
            <th style={{ padding: "12px 16px", textAlign: "left" }} />
          </tr>
        </thead>
        <tbody>
          {properties.map((prop) => (
            <tr
              key={prop.id}
              style={{
                borderBottom: "1px solid var(--border)",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              onClick={() => onSelect(prop)}
            >
              <td style={{ padding: "12px 16px", textAlign: "center" }}>
                {prop.is_favorite ? "★" : "☆"}
              </td>
              <td style={{ padding: "12px 16px" }}>
                <div style={{ fontWeight: 500 }}>
                  {prop.website ? (
                    <a
                      href={prop.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--info)", textDecoration: "none" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {prop.property_name || prop.address}
                    </a>
                  ) : (
                    prop.property_name || prop.address
                  )}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {prop.address}
                </div>
              </td>
              <td style={{ padding: "12px 16px" }}>{prop.city}</td>
              <td style={{ padding: "12px 16px" }}>
                {formatPrice(prop.price_min, prop.price_max)}
              </td>
              <td style={{ padding: "12px 16px" }}>
                {generateBedroomRangeDisplay(prop)}
              </td>
              <td style={{ padding: "12px 16px" }}>
                {generateSqftRange(prop)}
              </td>
              <td style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {prop.property_tags?.slice(0, 2).map((t) => (
                    <span
                      key={t.tag}
                      style={{
                        background: "var(--info-bg)",
                        color: "var(--info-text)",
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: "0.75rem",
                      }}
                    >
                      {t.tag}
                    </span>
                  ))}
                  {prop.property_tags?.length > 2 && (
                    <span
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "0.75rem",
                        padding: "2px 4px",
                      }}
                    >
                      +{prop.property_tags.length - 2}
                    </span>
                  )}
                </div>
              </td>
              <td style={{ padding: "12px 16px", textAlign: "right" }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(prop);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--info)",
                    cursor: "pointer",
                    fontSize: "1rem",
                  }}
                >
                  →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
