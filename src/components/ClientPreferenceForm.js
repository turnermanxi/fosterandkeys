"use client";

import { useState } from "react";

export default function ClientPreferenceForm({ leadId, leadToken, matches = [] }) {
  const [selected, setSelected] = useState(new Set());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  function toggleSelection(selectionId) {
    const newSelected = new Set(selected);
    if (newSelected.has(selectionId)) {
      newSelected.delete(selectionId);
    } else {
      newSelected.add(selectionId);
    }
    setSelected(newSelected);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // Convert selected set to preferences array
      // Format: either { unit_id }, { property_id }, or { apartment_id }
      const preferences = Array.from(selected).map((selectionId) => {
        if (selectionId.startsWith("unit-")) {
          return {
            unit_id: parseInt(selectionId.replace("unit-", "")),
          };
        } else if (selectionId.startsWith("property-")) {
          return {
            property_id: selectionId.replace("property-", ""),
          };
        } else if (selectionId.startsWith("apartment-")) {
          return {
            apartment_id: parseInt(selectionId.replace("apartment-", "")),
          };
        }
      }).filter(Boolean);

      console.log("[ClientPreferenceForm] Submitting preferences:", {
        selectedCount: selected.size,
        preferencesCount: preferences.length,
        preferences: JSON.stringify(preferences),
        selectedIds: Array.from(selected),
      });

      const res = await fetch(`/api/leads/${leadId}/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences,
          notes,
          token: leadToken,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSubmitted(true);
        setSelected(new Set());
        setNotes("");
      } else {
        setError(data.error || "Failed to submit preferences");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="card" style={{
        background: "linear-gradient(135deg, var(--success-bg), var(--success-bg))",
        border: "1px solid var(--success-border)",
        textAlign: "center",
        padding: 40,
      }}>
        <h2 style={{ color: "var(--success-text)", marginBottom: 8 }}>✓ Thank You!</h2>
        <p style={{ color: "var(--success-text)", marginBottom: 12 }}>
          We've received your preferences. Lorenzo will reach out soon to schedule tours at your selected properties.
        </p>
        <p style={{ color: "var(--success)", fontSize: ".9rem" }}>
          Check your email for updates on tour availability.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{
      background: "var(--surface-2)",
      border: "2px solid var(--border)",
      marginTop: 32,
    }}>
      <div style={{ paddingBottom: 20, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        <h3 style={{ marginBottom: 8 }}> Which properties interest you?</h3>
        <p className="text-muted" style={{ marginBottom: 0 }}>
          Select the units you'd like to tour, and we'll get them scheduled for you.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Property Selection */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "grid", gap: 12 }}>
            {/* Unified matches (units, properties, and apartments) */}
            {matches.map((m) => {
              const isUnit = m.type === "unit";
              const isApartment = m.type === "apartment";
              const isProperty = m.type === "property";
              
              // Build selection ID based on type
              let selectionId;
              if (isUnit) {
                selectionId = `unit-${m.unit.id}`;
              } else if (isApartment) {
                selectionId = `apartment-${m.apartment.id}`;
              } else {
                selectionId = `property-${m.property.id}`;
              }
              
              const isSelected = selected.has(selectionId);
              
              // Format unit rent
              const formatUnitRent = () => {
                const lo = Number(m.unit?.rent_min);
                const hi = Number(m.unit?.rent_max);
                if (!lo && !hi) return "TBD";
                if (lo && !hi) {
                  const min = Math.max(0, lo - 100);
                  const max = lo + 100;
                  return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
                }
                if (lo === hi) {
                  const min = Math.max(0, lo - 100);
                  const max = lo + 100;
                  return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
                }
                return `$${lo.toLocaleString()}–$${hi.toLocaleString()}`;
              };

              // Format apartment deposit/fee
              const formatApartmentPrice = () => {
                const deposit = m.apartment?.deposit_min;
                const fee = m.apartment?.app_fee;
                if (!deposit && !fee) return "Contact for details";
                let parts = [];
                if (deposit) parts.push(`$${Number(deposit).toLocaleString()} deposit`);
                if (fee) parts.push(`$${Number(fee).toLocaleString()} app fee`);
                return parts.join(" + ");
              };

              // Format property price
              const formatPropertyPrice = () => {
                const min = m.property?.price_min;
                const max = m.property?.price_max;
                if (!min && !max) return "TBD";
                if (!max) return `$${Number(min || 0).toLocaleString()}`;
                if (!min) return `$${Number(max).toLocaleString()}`;
                if (min === max) return `$${Number(min).toLocaleString()}`;
                return `$${Number(min).toLocaleString()}–$${Number(max).toLocaleString()}`;
              };

              // Determine colors based on type
              let bgColor = "var(--surface)";
              let borderColor = "var(--border)";
              let priceColor = "var(--text-muted)";
              
              if (isSelected) {
                if (isUnit) {
                  bgColor = "var(--info-bg)";
                  borderColor = "var(--purple-border)";
                  priceColor = "var(--info)";
                } else if (isApartment) {
                  bgColor = "var(--warning-bg)";
                  borderColor = "var(--warning)";
                  priceColor = "var(--warning)";
                } else {
                  bgColor = "var(--warning-bg)";
                  borderColor = "var(--warning)";
                  priceColor = "var(--warning)";
                }
              }

              return (
                <label
                  key={selectionId}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: 16,
                    background: bgColor,
                    border: `2px solid ${isSelected ? borderColor : "var(--border)"}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(selectionId)}
                    style={{
                      flexShrink: 0,
                      marginTop: 3,
                      width: 20,
                      height: 20,
                      cursor: "pointer",
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: "block", marginBottom: 4 }}>
                      {isUnit ? m.apartment?.name : (isApartment ? m.apartment?.name : m.property?.property_name || "Property")}
                    </strong>
                    <p style={{
                      fontSize: ".85rem",
                      color: "var(--text-muted)",
                      margin: "0 0 8px 0",
                      lineHeight: 1.4,
                    }}>
                      {isUnit ? (
                        <>
                          {m.unit?.bedrooms ?? "?"} bed / {m.unit?.bathrooms ?? "?"} bath
                          {m.unit?.sqft_min ? ` • ${m.unit.sqft_min.toLocaleString()} sqft` : ""}
                          {m.apartment?.city ? ` • ${m.apartment.city}` : ""}
                        </>
                      ) : isApartment ? (
                        <>
                          {m.apartment?.address || "Address not available"}
                          {m.apartment?.city ? ` • ${m.apartment.city}` : ""}
                        </>
                      ) : (
                        <>
                          {m.property?.address}
                          <br />
                          {m.property?.bedrooms ?? "?"} bed / {m.property?.bathrooms ?? "?"} bath
                        </>
                      )}
                    </p>
                    <p style={{
                      fontSize: ".9rem",
                      fontWeight: 600,
                      color: isSelected ? priceColor : "var(--text-muted)",
                      margin: 0,
                    }}>
                      {isUnit ? `$${formatUnitRent()}/mo` : isApartment ? formatApartmentPrice() : `$${formatPropertyPrice()}/mo`}
                    </p>
                  </div>
                  <div style={{
                    padding: "4px 12px",
                    background: isSelected ? (isUnit ? "var(--purple)" : "var(--warning)") : "var(--border-strong)",
                    color: "var(--on-solid)",
                    borderRadius: 4,
                    fontSize: ".8rem",
                    fontWeight: 600,
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}>
                    {isSelected ? "✓ Selected" : "Select"}
                  </div>
                </label>
              );
            })}
          </div>
        </div>



        {/* Additional Notes */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", marginBottom: 8 }}>
            <strong>Anything else we should know?</strong>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="E.g., preferred floor, specific unit requirements, move-in flexibility, etc."
            style={{
              width: "100%",
              minHeight: 100,
              padding: 12,
              border: "1px solid var(--border-strong)",
              borderRadius: 6,
              fontSize: ".9rem",
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            background: "var(--danger-bg)",
            color: "var(--danger-text)",
            padding: 12,
            borderRadius: 6,
            fontSize: ".9rem",
            marginBottom: 16,
          }}>
            Error: {error}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={submitting || selected.size === 0}
          style={{
            width: "100%",
            padding: "14px 24px",
            background: selected.size === 0 ? "var(--border-strong)" : "var(--info)",
            color: "var(--on-solid)",
            border: "none",
            borderRadius: 8,
            fontSize: ".95rem",
            fontWeight: 600,
            cursor: selected.size === 0 ? "not-allowed" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Submitting…" : `Schedule Tours (${selected.size} selected)`}
        </button>

        <p style={{
          fontSize: ".8rem",
          color: "var(--text-muted)",
          textAlign: "center",
          marginTop: 12,
          margin: "12px 0 0 0",
        }}>
          Lorenzo will contact you within 24 hours to confirm tour times.
        </p>
      </form>
    </div>
  );
}
