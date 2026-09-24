"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { generateSqftRange } from "@/lib/propertyFormatters";

export default function TourConfirmationPage() {
  const pathname = usePathname();
  const token = pathname.split("/").pop(); // Extract token from /tour-confirmation/[token]
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState("select_properties"); // select_properties | submit_feedback
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [touredProperties, setTouredProperties] = useState(new Set());
  const [propertyFeedback, setPropertyFeedback] = useState({});

  useEffect(() => {
    async function loadLead() {
      if (!token) {
        setError("No token provided");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/tour-confirmation?token=${token}`);
        const data = await res.json();
        if (data.lead) {
          setLead(data.lead);
        } else {
          setError(data.error || "Lead not found");
        }
      } catch (err) {
        setError("Failed to load tour information");
      } finally {
        setLoading(false);
      }
    }
    loadLead();
  }, [token]);

  function toggleProperty(propId) {
    const newToured = new Set(touredProperties);
    if (newToured.has(propId)) {
      newToured.delete(propId);
    } else {
      newToured.add(propId);
    }
    setTouredProperties(newToured);
  }

  async function handleConfirmTours() {
    setSubmitting(true);
    setError(null);

    try {
      // Convert toured properties set to array
      const touredList = Array.from(touredProperties);

      const res = await fetch(`/api/leads/${lead.id}/confirm-tour`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toured_properties: touredList,
          property_feedback: propertyFeedback, // Per-property interest/notes
          token,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || "Failed to submit");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="page-wrapper" style={{ textAlign: "center", paddingTop: 80 }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (error && !lead) {
    return (
      <div className="page-wrapper" style={{ textAlign: "center", paddingTop: 80 }}>
        <h1 style={{ color: "var(--danger)", marginBottom: 8 }}>Error</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="page-wrapper" style={{ textAlign: "center", paddingTop: 80 }}>
        <div className="card" style={{
          background: "linear-gradient(135deg, var(--success-bg), var(--success-bg))",
          border: "1px solid var(--success-border)",
          padding: 40,
        }}>
          <h1 style={{ color: "var(--success-text)", marginBottom: 12 }}>✓ Thank You!</h1>
          <p style={{ color: "var(--success-text)", marginBottom: 16, fontSize: "1.05rem" }}>
            We've received your tour update.
          </p>
          <p style={{ color: "var(--success)" }}>
            Lorenzo will be in touch shortly with next steps!
          </p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="page-wrapper" style={{ textAlign: "center", paddingTop: 80 }}>
        <p>Lead information not available</p>
      </div>
    );
  }

  // Extract all properties from tour details
  const propertiesToConfirm = lead.tour_details && Array.isArray(lead.tour_details) 
    ? lead.tour_details 
    : (lead.tour_details ? [lead.tour_details] : []);

  return (
    <div className="page-wrapper">
      <div className="results-hero">
        <h1>Hi {lead.full_name.split(" ")[0]}, which properties did you tour?</h1>
        <p>Check the boxes to let Lorenzo know which ones you visited.</p>
      </div>

      {propertiesToConfirm.length > 0 && (
        <div className="card">
          {propertiesToConfirm.map((prop, index) => {
            // Create a stable unique key that doesn't rely on potentially null fields
            // Use property_id if available, otherwise unit_id, otherwise fall back to index with apartment info
            let propId;
            if (prop.property_id) {
              propId = `property-${prop.property_id}`;
            } else if (prop.unit_id) {
              propId = `unit-${prop.unit_id}`;
            } else {
              // For manually added apartments without unit_id, use apartment name + index as fallback
              propId = `apt-${prop.apartment_address || prop.property_address || `unknown-${index}`}-${index}`;
            }

            const isChecked = touredProperties.has(propId);
            const feedback = propertyFeedback[propId] || "not_visited";
            
            // Use property_name from tour_details, fall back to address
            const name = prop.property_name || prop.property_address || `${prop.apartment_address || ""} ${prop.unit_number || ""}`.trim();
            const address = prop.property_address || prop.apartment_address;
            const beds = prop.bedrooms || prop.beds || 0;
            const baths = prop.bathrooms || prop.baths || 0;
            
            // Use scheduled_tour_datetime from tour_details
            const timeStr = prop.scheduled_tour_datetime || (prop.time || "TBD");

            return (
              <div
                key={propId}
                style={{
                  padding: "16px",
                  marginBottom: "12px",
                  border: isChecked ? "2px solid var(--link)" : "1px solid var(--border)",
                  borderRadius: 8,
                  background: isChecked ? "var(--info-bg)" : "var(--surface-2)",
                  transition: "all 0.2s",
                }}
              >
                {/* Property Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    cursor: "pointer",
                    marginBottom: "12px",
                  }}
                  onClick={() => toggleProperty(propId)}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleProperty(propId)}
                    style={{ marginTop: 4 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        color: "var(--text-strong)",
                        marginBottom: 4,
                        fontSize: "1.05rem",
                      }}
                    >
                      {name}
                    </div>
                    {address && (
                      <div
                        style={{
                          fontSize: "0.9rem",
                          color: "var(--text-muted)",
                          marginBottom: 4,
                        }}
                      >
                        📍 {address}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: "0.9rem",
                        color: "var(--text-muted)",
                        marginBottom: 4,
                      }}
                    >
                      {beds}BD / {baths}BA | {generateSqftRange({
                        sqft_min: prop.property_sqft_min,
                        sqft_max: prop.property_sqft_max,
                      })}
                    </div>
                    <div
                      style={{
                        fontSize: "0.95rem",
                        color: "var(--info)",
                        fontWeight: 500,
                      }}
                    >
                      📅 Tour: {timeStr}
                    </div>
                  </div>
                </div>

                {/* Per-Property Interest Dropdown */}
                {isChecked && (
                  <div
                    style={{
                      background: "var(--surface-2)",
                      padding: "12px",
                      borderRadius: 6,
                      marginLeft: "28px",
                    }}
                  >
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        color: "var(--text)",
                        marginBottom: 8,
                      }}
                    >
                      Interest Level
                    </label>
                    <select
                      value={feedback}
                      onChange={(e) =>
                        setPropertyFeedback({
                          ...propertyFeedback,
                          [propId]: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid var(--border-strong)",
                        borderRadius: 6,
                        fontSize: ".9rem",
                        fontFamily: "inherit",
                      }}
                    >
                      <option value="not_visited">Did Not Visit</option>
                      <option value="not_interested">Not Interested</option>
                      <option value="interested">Interested</option>
                      <option value="very_interested">Very Interested - Want to Apply</option>
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {touredProperties.size > 0 && (
        <div className="card">
          <button
            className="btn btn-accent"
            onClick={handleConfirmTours}
            disabled={submitting}
            style={{ width: "100%" }}
          >
            {submitting ? "Submitting…" : `Confirm ${touredProperties.size} Property/ies`}
          </button>

          {error && (
            <div
              style={{
                background: "var(--danger-bg)",
                color: "var(--danger-text)",
                padding: 12,
                borderRadius: 6,
                marginTop: 16,
                fontSize: ".9rem",
              }}
            >
              Error: {error}
            </div>
          )}
        </div>
      )}

      {touredProperties.size === 0 && (
        <div className="card" style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border-strong)",
          textAlign: "center",
          padding: 24,
          color: "var(--text-muted)",
        }}>
          <p>Select at least one property to confirm</p>
        </div>
      )}
    </div>
  );
}

// For static generation
export const dynamic = "force-dynamic";
