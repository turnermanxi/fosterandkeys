"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { generateSqftRange } from "@/lib/propertyFormatters";

export default function ApplicationDecisionPage() {
  const pathname = usePathname();
  const token = pathname.split("/").pop();

  const [lead, setLead] = useState(null);
  const [selectedProperties, setSelectedProperties] = useState([]);
  const [otherProperties, setOtherProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState("property_decisions"); // property_decisions | reapplication | submitted
  // Track decision per property: {unit_id: "approved" | "denied"}
  const [propertyDecisions, setPropertyDecisions] = useState({});
  // Track denial reasons per property: {unit_id: "reason text"}
  const [denialReasons, setDenialReasons] = useState({});
  const [newSelections, setNewSelections] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      if (!token) {
        setError("No token provided");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/application-decision?token=${token}`);
        const data = await res.json();
        console.log("Application decision data loaded:", data);
        if (data.lead) {
          setLead(data.lead);
          setSelectedProperties(data.selectedProperties || []);
          setOtherProperties(data.otherProperties || []);
        } else {
          setError(data.error || "Lead not found");
        }
      } catch (err) {
        console.error("Error loading application decision:", err);
        setError("Failed to load application decision form");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [token]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      // Check if at least one property has a decision
      const hasDecisions = selectedProperties.some(p => propertyDecisions[p.unit_id]);
      if (!hasDecisions) {
        setError("Please make a decision for at least one property");
        setSubmitting(false);
        return;
      }

      // Separate approved and denied properties
      const approvedUnits = selectedProperties
        .filter(p => propertyDecisions[p.unit_id] === "approved")
        .map(p => ({
          unit_id: p.unit_id,
          apartment_name: p.name,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          rent_range: p.rent_range,
        }));

      const deniedUnits = selectedProperties
        .filter(p => propertyDecisions[p.unit_id] === "denied")
        .map(p => ({
          unit_id: p.unit_id,
          apartment_name: p.name,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          rent_range: p.rent_range,
          denial_reason: denialReasons[p.unit_id] || "Not specified",
        }));

      const payload = {
        decision: approvedUnits.length > 0 && deniedUnits.length === 0 ? "approved" : deniedUnits.length > 0 ? "denied" : "mixed",
        approvedUnits: approvedUnits.length > 0 ? approvedUnits : undefined,
        deniedUnits: deniedUnits.length > 0 ? deniedUnits : undefined,
        token,
      };

      // Add reapplication selections if denied some
      if (deniedUnits.length > 0 && newSelections.size > 0) {
        payload.newSelections = Array.from(newSelections);
      }

      const res = await fetch(`/api/leads/${lead.id}/update-application-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  function togglePropertySelection(unitId) {
    const newSet = new Set(newSelections);
    if (newSet.has(unitId)) {
      newSet.delete(unitId);
    } else {
      newSet.add(unitId);
    }
    setNewSelections(newSet);
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
            We've received your application status!
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
        <p>Unable to load application information</p>
      </div>
    );
  }

  return (
    <div className="page-wrapper" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div className="card" style={{ maxWidth: 700, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 8, color: "var(--primary)", fontSize: "1.8rem" }}>
          Application Decision
        </h1>
        <p style={{ color: "var(--text-muted)", marginBottom: 24, fontSize: "1rem" }}>
          Hi {lead.full_name?.split(" ")[0]}, let us know how your application went!
        </p>

        {error && (
          <div style={{
            background: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger-text)",
            padding: 12,
            borderRadius: 6,
            marginBottom: 24,
            fontSize: "0.95rem",
          }}>
            {error}
          </div>
        )}

        {/* Property Decisions */}
        {step === "property_decisions" && (
          <div>
            <h2 style={{ marginBottom: 20, color: "var(--text-strong)", fontSize: "1.2rem" }}>
              Let us know your application status for each property:
            </h2>

            {selectedProperties.length === 0 ? (
              <div style={{
                padding: 20,
                background: "var(--warning-bg)",
                border: "1px solid var(--warning-border)",
                borderRadius: 8,
                marginBottom: 24,
                textAlign: "center",
              }}>
                <p style={{ margin: 0, color: "var(--warning-text)", fontSize: "0.95rem" }}>
                  No properties found to review. Please contact Lorenzo for assistance.
                </p>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
                  {selectedProperties.map((prop, index) => (
                    <div key={prop.unit_id || `property-${index}`} style={{
                      padding: 16,
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      background: "var(--surface-2)",
                    }}>
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ margin: "0 0 6px", fontWeight: 600, color: "var(--text-strong)", fontSize: "1rem" }}>
                          {prop.name}
                        </p>
                        <p style={{ margin: "0 0 4px", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                          {prop.bedrooms} bed / {prop.bathrooms} bath • {prop.rent_range} | {generateSqftRange({
                            sqft_min: prop.sqft_min,
                            sqft_max: prop.sqft_max || prop.sqft,
                          })}
                        </p>
                        {prop.scheduled_tour_datetime && (
                          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--success)" }}>
                            📅 Tour Scheduled: {new Date(prop.scheduled_tour_datetime).toLocaleString()}
                          </p>
                        )}
                      </div>

                      {/* Decision Dropdown */}
                      <div style={{ marginBottom: propertyDecisions[prop.unit_id] === "denied" ? 12 : 0 }}>
                        <label style={{
                          display: "block",
                          fontSize: "0.9rem",
                          fontWeight: 500,
                          color: "var(--text)",
                          marginBottom: 6,
                        }}>
                          My Application Status:
                        </label>
                        <select
                          value={propertyDecisions[prop.unit_id] || ""}
                          onChange={(e) => {
                            const newDecisions = { ...propertyDecisions };
                            newDecisions[prop.unit_id] = e.target.value;
                            setPropertyDecisions(newDecisions);
                          }}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            border: "1px solid var(--border-strong)",
                            borderRadius: 6,
                            fontSize: "0.95rem",
                            fontFamily: "inherit",
                            background: "var(--surface)",
                            cursor: "pointer",
                          }}
                        >
                          <option value="">-- Select --</option>
                          <option value="approved">✓ Approved</option>
                          <option value="denied">✗ Denied</option>
                        </select>
                      </div>

                      {/* Denial Reason (shown only if denied) */}
                      {propertyDecisions[prop.unit_id] === "denied" && (
                        <div>
                          <label style={{
                            display: "block",
                            fontSize: "0.9rem",
                            fontWeight: 500,
                            color: "var(--text)",
                            marginBottom: 6,
                          }}>
                            Why were you denied? (optional)
                          </label>
                          <textarea
                            value={denialReasons[prop.unit_id] || ""}
                            onChange={(e) => {
                              const newReasons = { ...denialReasons };
                              newReasons[prop.unit_id] = e.target.value;
                              setDenialReasons(newReasons);
                            }}
                            placeholder="e.g., Failed credit check, income verification, application fees..."
                            style={{
                              width: "100%",
                              padding: "10px 12px",
                              border: "1px solid var(--border-strong)",
                              borderRadius: 6,
                              fontFamily: "inherit",
                              fontSize: "0.85rem",
                              resize: "vertical",
                              minHeight: 60,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Check if any denied to show reapplication section */}
                {Object.values(propertyDecisions).includes("denied") && otherProperties.length > 0 && (
                  <div style={{
                    padding: 16,
                    background: "var(--warning-bg)",
                    border: "1px solid var(--warning-border)",
                    borderRadius: 8,
                    marginBottom: 24,
                  }}>
                    <h3 style={{ marginTop: 0, marginBottom: 12, color: "var(--warning-text)", fontSize: "1rem" }}>
                      📋 Want to Try Other Properties?
                    </h3>
                    <p style={{ margin: "0 0 12px", color: "var(--warning-text)", fontSize: "0.9rem" }}>
                      Select other properties you'd like to apply to:
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {otherProperties.map((prop, index) => (
                        <label key={prop.unit_id || `other-property-${index}`} style={{
                          display: "flex",
                          alignItems: "center",
                          padding: 12,
                          background: "var(--warning-bg)",
                          border: "1px solid var(--warning-border)",
                          borderRadius: 6,
                          cursor: "pointer",
                          transition: "background 0.2s",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--warning-bg)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "var(--warning-bg)"}>
                          <input
                            type="checkbox"
                            checked={newSelections.has(prop.unit_id)}
                            onChange={() => togglePropertySelection(prop.unit_id)}
                            style={{ marginRight: 12, cursor: "pointer", width: 18, height: 18 }}
                          />
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontWeight: 600, color: "var(--text-strong)" }}>
                              {prop.name}
                            </p>
                            <p style={{ margin: "4px 0 0", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                              {prop.bedrooms} bed / {prop.bathrooms} bath • {prop.rent_range} | {generateSqftRange({
                                sqft_min: prop.sqft_min,
                                sqft_max: prop.sqft_max || prop.sqft,
                              })}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                    {newSelections.size > 0 && (
                      <p style={{ marginTop: 12, marginBottom: 0, fontSize: "0.85rem", color: "var(--warning-text)", fontWeight: 500 }}>
                        ✓ {newSelections.size} propert{newSelections.size === 1 ? "y" : "ies"} selected for reapplication
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    width: "100%",
                    padding: "14px 20px",
                    background: "var(--text-strong)",
                    color: "var(--on-solid)",
                    border: "none",
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: "1rem",
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.6 : 1,
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => !submitting && (e.target.style.background = "var(--primary-light)")}
                  onMouseLeave={(e) => !submitting && (e.target.style.background = "var(--text-strong)")}
                >
                  {submitting ? "Submitting..." : "Submit Application Status"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
