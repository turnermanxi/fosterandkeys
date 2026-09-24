"use client";

import { useState, useEffect } from "react";
import Timeline from "./Timeline";
import PropertiesSelector from "./PropertiesSelector";
import { generateSqftRange } from "@/lib/propertyFormatters";

function scoreBadge(score) {
  let cls = "low";
  if (score >= 70) cls = "high";
  else if (score >= 40) cls = "medium";
  return <span className={`score-badge ${cls}`}>{score}</span>;
}

function formatRent(unit) {
  const lo = Number(unit?.rent_min);
  const hi = Number(unit?.rent_max);
  if (!lo && !hi) return "—";
  
  // Add ±$100 buffer for single prices
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

function formatPrice(min, max) {
  if (!min && !max) return "—";
  if (!max) return `$${Number(min || 0).toLocaleString()}`;
  if (!min) return `$${Number(max || 0).toLocaleString()}`;
  return `$${Number(min).toLocaleString()} – $${Number(max).toLocaleString()}`;
}

export default function LeadDetail({ lead, onClose, onSend }) {
  const [matches, setMatches] = useState([]);
  const [apartments, setApartments] = useState({});
  const [units, setUnits] = useState({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showRawEmail, setShowRawEmail] = useState(false);
  const [editedSummary, setEditedSummary] = useState(lead.ai_summary ?? "");
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [activeTab, setActiveTab] = useState("matches"); // matches | cx_response | timeline | properties
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);
  const [tourDates, setTourDates] = useState({}); // Map of selectionId -> date (YYYY-MM-DD)
  const [tourTimes, setTourTimes] = useState({}); // Map of selectionId -> time (HH:MM)
  const [schedulingTour, setSchedulingTour] = useState(false);
  const [selectedPropertiesCount, setSelectedPropertiesCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rescheduleNotes, setRescheduleNotes] = useState("");
  const [showSendAgentModal, setShowSendAgentModal] = useState(false);
  const [selectedAgentEmail, setSelectedAgentEmail] = useState("");
  const [selectedAgentName, setSelectedAgentName] = useState("");
  const [agentEmails, setAgentEmails] = useState([]);
  const [processingReschedule, setProcessingReschedule] = useState(false);
  const [processingAgentForward, setProcessingAgentForward] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Fetch all lead_matches with full data
        const res = await fetch(`/api/leads/${lead.id}/matches`);
        if (res.ok) {
          const data = await res.json();
          const fetchedMatches = data.matches || [];
          
          // If no matches found from lead_matches table, fallback to lead.recommended_units (old format)
          if (fetchedMatches.length === 0 && lead.recommended_units && lead.recommended_units.length > 0) {
            console.log("No lead_matches found, using legacy recommended_units");
            // Convert old format to new format for backward compatibility
            const legacyMatches = lead.recommended_units.map((m) => ({
              id: `unit-${m.unit_id}`,
              type: "unit",
              score: m.score,
              cx_response: m.cx_response,
              toured_status: m.toured_status,
              toured_at: m.toured_at,
              unit_id: m.unit_id,
              property_id: null,
              unit: { bedrooms: m.bedrooms, bathrooms: m.bathrooms, rent_min: m.rent_min, rent_max: m.rent_max },
              apartment: { name: m.apartment_name, id: m.apartment_id },
              property: null,
            }));
            setMatches(legacyMatches);
          } else {
            setMatches(fetchedMatches);
          }
        } else {
          console.error("Failed to fetch matches:", res.status);
          // Fallback to lead.recommended_units if any errors occur
          if (lead.recommended_units && lead.recommended_units.length > 0) {
            setMatches(lead.recommended_units.map((m) => ({
              id: `unit-${m.unit_id}`,
              type: "unit",
              score: m.score,
              cx_response: m.cx_response,
              toured_status: m.toured_status,
              toured_at: m.toured_at,
              unit_id: m.unit_id,
              property_id: null,
            })));
          }
        }
      } catch (err) {
        console.error("Error loading matches:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [lead]);

  async function handleSend() {
    setSending(true);
    try {
      await onSend(lead.id, editedSummary);
      // Refetch matches after send completes to show newly created lead_matches records
      const res = await fetch(`/api/leads/${lead.id}/matches`);
      if (res.ok) {
        const data = await res.json();
        const fetchedMatches = data.matches || [];
        setMatches(fetchedMatches);
      }
    } finally {
      setSending(false);
    }
  }

  async function refreshMatches() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/matches`);
      if (res.ok) {
        const data = await res.json();
        const fetchedMatches = data.matches || [];
        setMatches(fetchedMatches);
        console.log(`Refreshed matches: found ${fetchedMatches.length} total, ${fetchedMatches.filter(m => m.cx_response === "interested").length} interested`);
      } else {
        alert("Failed to refresh matches");
      }
    } catch (err) {
      console.error("Error refreshing matches:", err);
    } finally {
      setRefreshing(false);
    }
  }

  async function updateLeadStatus(newStatus, notes = "") {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/update-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, notes }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh lead data
        window.location.reload();
      } else {
        alert("Error: " + (data.error ?? "Unknown"));
      }
    } catch (err) {
      alert("Failed to update status: " + err.message);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function sendApplicationReminder() {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/send-application-reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        // Refresh lead data
        window.location.reload();
      } else {
        alert("Error: " + (data.error ?? "Unknown"));
      }
    } catch (err) {
      alert("Failed to send reminder: " + err.message);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleScheduleTour(e) {
    e.preventDefault();
    
    // Get selected properties from unified matches (including apartments)
    const allSelected = matches
      .filter((m) => m.cx_response === "interested")
      .map((m) => {
        if (m.type === "unit") {
          return `unit-${m.unit_id}`;
        } else if (m.type === "apartment") {
          return `apartment-${m.apartment.id}`;
        } else {
          return `property-${m.property_id}`;
        }
      });
    
    // Check that all selected properties have dates AND times set
    const missingDates = allSelected.filter(id => !tourDates[id]);
    const missingTimes = allSelected.filter(id => !tourTimes[id]);
    
    if (missingDates.length > 0) {
      alert("Please provide tour dates for all properties");
      return;
    }

    if (missingTimes.length > 0) {
      alert("Please provide tour times for all properties");
      return;
    }

    setSchedulingTour(true);
    try {
      // Build tourSchedule with both date and time for each property
      const tourSchedule = {};
      allSelected.forEach(selectionId => {
        tourSchedule[selectionId] = {
          date: tourDates[selectionId],
          time: tourTimes[selectionId],
        };
      });

      const res = await fetch(`/api/leads/${lead.id}/schedule-tour`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tourSchedule: tourSchedule, // Now with per-property dates and times
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowTourModal(false);
        setTourDates({});
        setTourTimes({});
        window.location.reload();
      } else {
        alert("Error: " + (data.error ?? "Unknown"));
      }
    } catch (err) {
      alert("Failed to schedule tour: " + err.message);
    } finally {
      setSchedulingTour(false);
    }
  }

  async function handleSetFollowUp() {
    const days = prompt("Follow up in how many days? (e.g., 3)", "3");
    if (!days || isNaN(days)) return;

    try {
      const reminderDate = new Date();
      reminderDate.setDate(reminderDate.getDate() + parseInt(days));

      const res = await fetch(`/api/leads/${lead.id}/set-followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminder_at: reminderDate.toISOString(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Follow-up set for ${days} days from now`);
        window.location.reload();
      } else {
        alert("Error: " + (data.error ?? "Unknown"));
      }
    } catch (err) {
      alert("Failed to set follow-up: " + err.message);
    }
  }

  async function handleRequestReschedule() {
    if (!rescheduleReason.trim()) {
      alert("Please provide a reason for rescheduling");
      return;
    }

    setProcessingReschedule(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/request-reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: rescheduleReason,
          notes: rescheduleNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Lead moved to new round. Ready for new recommendations.");
        setShowRescheduleModal(false);
        setRescheduleReason("");
        setRescheduleNotes("");
        window.location.reload();
      } else {
        alert("Error: " + (data.error ?? "Unknown"));
      }
    } catch (err) {
      alert("Failed to request reschedule: " + err.message);
    } finally {
      setProcessingReschedule(false);
    }
  }

  async function handleSendToAgent() {
    if (!selectedAgentEmail.trim()) {
      alert("Please select an agent");
      return;
    }

    setProcessingAgentForward(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/send-to-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_email: selectedAgentEmail,
          agent_name: selectedAgentName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Lead forwarded to ${selectedAgentName}. Email sent.`);
        setShowSendAgentModal(false);
        setSelectedAgentEmail("");
        setSelectedAgentName("");
        window.location.reload();
      } else {
        alert("Error: " + (data.error ?? "Unknown"));
      }
    } catch (err) {
      alert("Failed to send to agent: " + err.message);
    } finally {
      setProcessingAgentForward(false);
    }
  }

  return (
    <div className="detail-panel" onClick={onClose}>
      <div className="detail-panel-inner" onClick={(e) => e.stopPropagation()}>
        <button className="detail-panel-close" onClick={onClose}>
          &times;
        </button>

        {/* Brokerage Information */}
        <div style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "12px",
          marginBottom: "16px",
          fontSize: "0.85rem",
          lineHeight: "1.4",
          color: "var(--text-muted)"
        }}>
          <p style={{ margin: "0 0 6px 0", fontWeight: 600, color: "var(--text-strong)" }}>
            Brokerage Information
          </p>
          <p style={{ margin: "0 0 4px 0" }}>
            Powered by DHS Realty
          </p>
          <p style={{ margin: "0 0 4px 0" }}>
            License Number: 839748
          </p>
          <p style={{ margin: "0 0 4px 0" }}>
            8005 FALLMEADOW CIR. PLANO, TX 75024
          </p>
          <p style={{ margin: "0", fontSize: "0.8rem" }}>
            <a href="#" style={{ color: "var(--link)", textDecoration: "none" }}>
              Texas Real Estate Commission Consumer Protection Notice
            </a>
            {" • "}
            <a href="#" style={{ color: "var(--link)", textDecoration: "none" }}>
              File a Complaint
            </a>
          </p>
        </div>

        <h2 style={{ marginBottom: 4 }}>{lead.full_name}</h2>
        <p className="text-muted" style={{ marginBottom: 16 }}>
          {lead.email} &middot; {lead.phone}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div>
            <strong>Rent Budget:</strong>{" "}
            {lead.budget_min != null || lead.budget_max != null
              ? `$${(lead.budget_min ?? 0).toLocaleString()} – $${(lead.budget_max ?? "∞").toLocaleString()}/mo`
              : "—"}
          </div>
          <div>
            <strong>Location:</strong> {lead.desired_location || "—"}
          </div>
          <div>
            <strong>Beds / Baths:</strong> {lead.bedrooms ?? "—"} / {lead.bathrooms ?? "—"}
          </div>
          <div>
            <strong>Timeline:</strong> {lead.move_in_timeline || "—"}
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <strong>Status:</strong>{" "}
            <span className={`status-badge ${lead.status}`}>{lead.status}</span>
          </div>
        </div>

        {lead.notes && (
          <div style={{ marginBottom: 16 }}>
            <strong>Notes:</strong>
            <p style={{ marginTop: 4, fontSize: ".92rem" }}>{lead.notes}</p>
          </div>
        )}

        {(lead.ai_summary || editedSummary) && (
          <div style={{
            marginBottom: 20,
            padding: "16px 20px",
            background: "linear-gradient(135deg, var(--info-bg), var(--success-bg))",
            borderRadius: 8,
            border: "1px solid var(--info-border)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <strong style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "1.1rem" }}>✨</span> AI Summary
              </strong>
              <button
                className="btn btn-sm"
                style={{ background: isEditingSummary ? "var(--success)" : "var(--border)", color: isEditingSummary ? "var(--surface)" : "var(--text)", fontSize: ".8rem", padding: "4px 12px" }}
                onClick={() => setIsEditingSummary(!isEditingSummary)}
              >
                {isEditingSummary ? "Done Editing" : "✏️ Edit"}
              </button>
            </div>
            {isEditingSummary ? (
              <textarea
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: 120,
                  fontSize: ".92rem",
                  lineHeight: 1.7,
                  padding: 12,
                  border: "1px solid var(--info-border)",
                  borderRadius: 6,
                  resize: "vertical",
                  fontFamily: "inherit",
                  background: "var(--surface)",
                }}
              />
            ) : (
              <p style={{ fontSize: ".92rem", lineHeight: 1.7, margin: 0 }}>
                {editedSummary || lead.ai_summary}
              </p>
            )}
          </div>
        )}

        {lead.raw_email && (
          <div style={{ marginBottom: 16 }}>
            <button
              className="btn btn-sm"
              style={{ background: "var(--border)", color: "var(--text)", marginBottom: 8 }}
              onClick={() => setShowRawEmail(!showRawEmail)}
            >
              {showRawEmail ? "Hide" : "Show"} Original Email
            </button>
            {showRawEmail && (
              <pre style={{
                background: "var(--surface-2)",
                border: "1px solid var(--color-border)",
                borderRadius: 6,
                padding: 16,
                fontSize: ".82rem",
                maxHeight: 200,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>
                {lead.raw_email}
              </pre>
            )}
          </div>
        )}

        {/* Tabs for matches and timeline */}
        <div style={{ display: "flex", gap: 16, borderBottom: "2px solid var(--border)", marginBottom: 20, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 16 }}>
            <button
              onClick={() => setActiveTab("matches")}
              style={{
                padding: "12px 16px",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontSize: ".95rem",
                fontWeight: activeTab === "matches" ? 600 : 400,
                color: activeTab === "matches" ? "var(--text-strong)" : "var(--text-muted)",
                borderBottom: activeTab === "matches" ? "3px solid var(--info)" : "none",
                marginBottom: "-2px",
              }}
            >
              All Matches ({matches.length})
            </button>
            {matches.filter(m => m.cx_response === "interested").length > 0 && (
              <button
                onClick={() => setActiveTab("cx_response")}
                style={{
                  padding: "12px 16px",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: ".95rem",
                  fontWeight: activeTab === "cx_response" ? 600 : 400,
                  color: activeTab === "cx_response" ? "var(--text-strong)" : "var(--text-muted)",
                  borderBottom: activeTab === "cx_response" ? "3px solid var(--info)" : "none",
                  marginBottom: "-2px",
                }}
              >
                📋 CX Selected ({matches.filter(m => m.cx_response === "interested").length})
              </button>
            )}
            <button
              onClick={() => setActiveTab("timeline")}
              style={{
                padding: "12px 16px",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontSize: ".95rem",
                fontWeight: activeTab === "timeline" ? 600 : 400,
                color: activeTab === "timeline" ? "var(--text-strong)" : "var(--text-muted)",
                borderBottom: activeTab === "timeline" ? "3px solid var(--info)" : "none",
                marginBottom: "-2px",
              }}
            >
              Timeline
            </button>
            <button
              onClick={() => setActiveTab("properties")}
              style={{
                padding: "12px 16px",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontSize: ".95rem",
                fontWeight: activeTab === "properties" ? 600 : 400,
                color: activeTab === "properties" ? "var(--text-strong)" : "var(--text-muted)",
                borderBottom: activeTab === "properties" ? "3px solid var(--info)" : "none",
                marginBottom: "-2px",
              }}
            >
              🏠 Properties {selectedPropertiesCount > 0 && `(${selectedPropertiesCount})`}
            </button>
          </div>
          <button
            onClick={refreshMatches}
            disabled={refreshing}
            style={{
              padding: "6px 10px",
              background: refreshing ? "var(--border-strong)" : "var(--border)",
              color: "var(--text)",
              border: "1px solid var(--border-strong)",
              borderRadius: 4,
              cursor: refreshing ? "wait" : "pointer",
              fontSize: ".85rem",
              whiteSpace: "nowrap",
              opacity: refreshing ? 0.6 : 1,
            }}
            title="Refresh to see customer responses"
          >
            {refreshing ? "⟳ Refreshing..." : "⟳ Refresh"}
          </button>
        </div>

        {/* Matches Tab */}
        {activeTab === "matches" && (
          <div>
            {loading ? (
              <div>
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="skeleton"
                    style={{ height: 18, marginBottom: 12, width: `${90 - i * 12}%` }}
                  />
                ))}
              </div>
            ) : matches.length === 0 ? (
              <p className="text-muted">No matches yet.</p>
            ) : (
              <table className="data-table" style={{ fontSize: ".9rem" }}>
                <thead>
                  <tr>
                    <th>Apartment / Property</th>
                    <th>Unit / Floorplan</th>
                    <th>Beds/Baths</th>
                    <th>Sqft</th>
                    <th>Rent</th>
                    <th>Area</th>
                    <th>Accepts</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => {
                    // Handle unit matches (from apartments via AI matching)
                    if (m.type === "unit") {
                      const unit = m.unit;
                      const apt = m.apartment;
                      const acceptParts = [];
                      if (apt?.accepts_broken_lease) acceptParts.push("BL");
                      if (apt?.accepts_bankruptcy) acceptParts.push("BK");
                      if (apt?.accepts_eviction) acceptParts.push("EV");
                      
                      // Create a link URL - prefer website, fallback to Google search
                      const aptLink = apt?.website || (apt?.name ? `https://www.google.com/search?q=${encodeURIComponent(apt.name)}` : null);
                      
                      return (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 600 }}>
                            {aptLink ? (
                              <a href={aptLink} target="_blank" rel="noopener noreferrer" style={{ color: "var(--link)", textDecoration: "none", fontWeight: 600 }}>
                                {apt?.name ?? "Unknown"} ↗
                              </a>
                            ) : (
                              apt?.name ?? "Unknown"
                            )}
                          </td>
                          <td>{unit?.floorplan ?? unit?.unit_number ?? "—"}</td>
                          <td>{unit?.bedrooms ?? "—"} / {unit?.bathrooms ?? "—"}</td>
                          <td>{generateSqftRange(unit)}</td>
                          <td>{formatRent(unit)}</td>
                          <td>{apt?.metro_area === "HOUSTON_METRO" ? "Houston" : apt?.metro_area === "DFW_METRO" ? "DFW" : "—"}</td>
                          <td>{acceptParts.length > 0 ? acceptParts.join(", ") : "—"}</td>
                          <td>{scoreBadge(m.score)}</td>
                        </tr>
                      );
                    }

                    // Handle apartment matches (manually added from lead_property_selections)
                    if (m.type === "apartment" && m.apartment) {
                      const apt = m.apartment;
                      const acceptParts = [];
                      if (apt?.accepts_broken_lease) acceptParts.push("BL");
                      if (apt?.accepts_bankruptcy) acceptParts.push("BK");
                      if (apt?.accepts_eviction) acceptParts.push("EV");
                      
                      // Create a link URL - prefer website, fallback to Google search
                      const aptLink = apt?.website || (apt?.name ? `https://www.google.com/search?q=${encodeURIComponent(apt.name)}` : null);
                      
                      return (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 600 }}>
                            {aptLink ? (
                              <a href={aptLink} target="_blank" rel="noopener noreferrer" style={{ color: "var(--link)", textDecoration: "none", fontWeight: 600 }}>
                                {apt?.name ?? "Unknown"} ↗
                              </a>
                            ) : (
                              apt?.name ?? "Unknown"
                            )}
                          </td>
                          <td>—</td>
                          <td>{apt?.bedrooms ?? "—"}</td>
                          <td>{generateSqftRange(apt)}</td>
                          <td>${apt?.price_min ?? apt?.rent_min ?? "—"}</td>
                          <td>{apt?.metro_area === "HOUSTON_METRO" ? "Houston" : apt?.metro_area === "DFW_METRO" ? "DFW" : "—"}</td>
                          <td>{acceptParts.length > 0 ? acceptParts.join(", ") : "—"}</td>
                          <td>—</td>
                        </tr>
                      );
                    }

                    // Handle manual property matches
                    if (m.type === "property" && m.property) {
                      const prop = m.property;
                      
                      // Create a link URL - prefer website, fallback to Google search
                      const propLink = prop?.website || (prop?.property_name ? `https://www.google.com/search?q=${encodeURIComponent(prop.property_name)}` : null);
                      
                      return (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 600 }}>
                            {propLink ? (
                              <a href={propLink} target="_blank" rel="noopener noreferrer" style={{ color: "var(--link)", textDecoration: "none", fontWeight: 600 }}>
                                {prop?.property_name ?? "Property"} ↗
                              </a>
                            ) : (
                              prop?.property_name ?? "Property"
                            )}
                          </td>
                          <td>{prop?.address ?? "—"}</td>
                          <td>{prop?.bedrooms ?? "—"} / {prop?.bathrooms ?? "—"}</td>
                          <td>{generateSqftRange(prop)}</td>
                          <td>{formatPrice(prop?.price_min, prop?.price_max)}</td>
                          <td>{prop?.city ?? "—"}</td>
                          <td>{prop?.pet_friendly ? "Pet" : "—"}</td>
                          <td>—</td>
                        </tr>
                      );
                    }

                    return null;
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* CX Response Tab */}
        {activeTab === "cx_response" && matches.length > 0 && (
          <div>
            {lead.cx_feedback && (
              <div style={{
                background: "var(--surface-2)",
                padding: 12,
                borderRadius: 6,
                marginBottom: 16,
                fontSize: ".9rem",
              }}>
                <strong>Client Notes:</strong>
                <p style={{ margin: "6px 0 0 0" }}>{lead.cx_feedback}</p>
              </div>
            )}

            <div style={{ display: "grid", gap: 12 }}>
              {/* Unified Matches */}
              {matches.map((m) => {
                const isInterested = m.cx_response === "interested";
                if (!isInterested) return null;

                const touredDate = m.toured_at ? new Date(m.toured_at).toLocaleDateString() : null;
                const isUnit = m.type === "unit";
                const borderColor = m.toured_status === "toured" ? "var(--success)" : (isUnit ? "var(--info)" : "var(--warning)");
                const bgColor = m.toured_status === "toured" ? "var(--success-bg)" : (isUnit ? "var(--info-bg)" : "var(--warning-bg)");
                const priceColor = isUnit ? "var(--info)" : "var(--warning)";
                const badgeText = isUnit ? "✓ Selected" : "⭐ Manual";
                const badgeBg = isUnit ? "var(--success)" : "var(--warning)";

                return (
                  <div
                    key={`${m.type}-${m.id}`}
                    style={{
                      padding: 16,
                      border: `2px solid ${borderColor}`,
                      background: bgColor,
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <strong style={{ display: "block", marginBottom: 4 }}>
                          {isUnit ? m.apartment?.name : m.property?.property_name}
                        </strong>
                        <p style={{ margin: 0, fontSize: ".85rem", color: "var(--text-muted)" }}>
                          {isUnit ? (
                            <>
                              {m.unit?.bedrooms ?? "?"} bed / {m.unit?.bathrooms ?? "?"} bath
                              {m.apartment?.city ? ` • ${m.apartment.city}` : ""}
                            </>
                          ) : (
                            <>
                              {m.property?.address}
                              {m.property?.bedrooms && ` • ${m.property.bedrooms} bed / ${m.property.bathrooms ?? 0} bath`}
                            </>
                          )}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <span style={{
                          padding: "4px 12px",
                          background: badgeBg,
                          color: "var(--on-solid)",
                          borderRadius: 4,
                          fontSize: ".8rem",
                          fontWeight: 600,
                        }}>
                          {badgeText}
                        </span>
                        {m.toured_status === "toured" && (
                          <span style={{
                            padding: "4px 12px",
                            background: "var(--success)",
                            color: "var(--on-solid)",
                            borderRadius: 4,
                            fontSize: ".8rem",
                            fontWeight: 600,
                          }}>
                            ✓ Toured {touredDate && `(${touredDate})`}
                          </span>
                        )}
                      </div>
                    </div>
                    <p style={{ margin: "8px 0 0 0", fontSize: ".9rem", fontWeight: 600, color: priceColor }}>
                      {isUnit ? formatRent(m.unit) : formatPrice(m.property?.price_min, m.property?.price_max)}/mo
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === "timeline" && (
          <div>
            <Timeline events={lead.timeline || []} viewMode="agent" />
          </div>
        )}

        {/* Properties Tab */}
        {activeTab === "properties" && (
          <div>
            <div
              style={{
                backgroundColor: "var(--info-bg)",
                border: "1px solid var(--info-border)",
                borderRadius: "6px",
                padding: "12px",
                marginBottom: "16px",
                fontSize: "0.9rem",
                color: "var(--info-text)",
              }}
            >
              <strong>Select properties to share with this customer.</strong> These will be included in the email sent to the lead.
            </div>
            <PropertiesSelector 
              leadId={lead.id} 
              onSelectionChange={(count) => setSelectedPropertiesCount(count)}
            />
          </div>
        )}

        {/* Pipeline Actions */}
        <div
          style={{
            marginTop: 24,
            padding: "16px 20px",
            background: "var(--surface-2)",
            borderRadius: 8,
            borderLeft: "4px solid var(--info)",
          }}
        >
          <strong style={{ fontSize: ".95rem", display: "block", marginBottom: 12 }}>
            Pipeline Status: {lead.current_status || lead.status}
          </strong>

          {/* Follow-up reminder if needed */}
          {lead.follow_up_needed && (
            <div style={{
              background: "var(--warning-bg)",
              border: "1px solid var(--warning)",
              padding: 10,
              borderRadius: 6,
              marginBottom: 12,
              fontSize: ".85rem",
              color: "var(--warning-text)",
            }}>
              ⏰ Follow-up needed! Client hasn't responded in 3+ days.
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {/* Send Recommendations */}
            {(!lead.current_status || lead.current_status === "created" || lead.current_status === "reschedule_requested") && (
              <button
                className="btn btn-sm"
                onClick={() => updateLeadStatus("recommended_sent", `Recommendations sent to client (Round ${lead.current_round || 1})`)}
                disabled={updatingStatus}
              >
                📧 Send Recommendations
              </button>
            )}

            {/* Waiting for CX Response */}
            {lead.current_status === "recommended_sent" && (
              <>
                <div style={{ fontSize: ".85rem", color: "var(--text-muted)", padding: "6px 0", width: "100%" }}>
                  Waiting for client to select properties...
                </div>
                <button
                  className="btn btn-sm"
                  style={{ background: "var(--warning)", color: "var(--on-solid)" }}
                  onClick={handleSetFollowUp}
                  disabled={updatingStatus}
                >
                  ⏰ Set Follow-up (if delayed)
                </button>
              </>
            )}

            {/* Schedule Tour - when CX has responded */}
            {lead.current_status === "cx_responded" && (
              <>
                <button
                  className="btn btn-sm"
                  style={{ background: "var(--success)", color: "var(--on-solid)" }}
                  onClick={() => setShowTourModal(true)}
                  disabled={updatingStatus}
                >
                  📅 Confirm Tour Times
                </button>
                <button
                  className="btn btn-sm"
                  style={{ background: "var(--warning)", color: "var(--on-solid)" }}
                  onClick={handleSetFollowUp}
                  disabled={updatingStatus}
                >
                  ⏰ Follow-up Reminder
                </button>
              </>
            )}

            {/* Tour Scheduled State */}
            {lead.current_status === "tour_scheduled" && (
              <div style={{ fontSize: ".85rem", color: "var(--text-muted)", padding: "6px 0", width: "100%" }}>
                ✓ Tour confirmed with client. Awaiting feedback...
              </div>
            )}

            {/* Tour Completed */}
            {lead.current_status === "tour_completed" && (
              <>
                <button
                  className="btn btn-sm"
                  style={{ background: "var(--purple)", color: "var(--on-solid)" }}
                  onClick={() => sendApplicationReminder()}
                  disabled={updatingStatus}
                >
                  📨 Send Application Reminder
                </button>
                <button
                  className="btn btn-sm"
                  style={{ background: "var(--warning)", color: "var(--on-solid)" }}
                  onClick={() => setShowRescheduleModal(true)}
                  disabled={processingReschedule}
                >
                  🔄 Request New Recommendations
                </button>
                <button
                  className="btn btn-sm"
                  style={{ background: "var(--purple)", color: "var(--on-solid)" }}
                  onClick={() => setShowSendAgentModal(true)}
                  disabled={processingAgentForward}
                >
                  📤 Forward to Another Agent
                </button>
              </>
            )}

            {/* Reschedule Requested */}
            {lead.current_status === "reschedule_requested" && (
              <div style={{
                fontSize: ".85rem",
                color: "var(--text-muted)",
                padding: "8px 12px",
                width: "100%",
                background: "var(--info-bg)",
                border: "1px solid var(--info)",
                borderRadius: "6px",
              }}>
                🔄 Lead moved to Round {lead.current_round || 2}. Ready to send new recommendations.
              </div>
            )}

            {/* Forwarded to Agent */}
            {lead.current_status === "forwarded_to_agent" && (
              <div style={{
                fontSize: ".85rem",
                color: "var(--text-muted)",
                padding: "8px 12px",
                width: "100%",
                background: "var(--purple-bg)",
                border: "1px solid var(--purple-border)",
                borderRadius: "6px",
              }}>
                📤 Forwarded to: {lead.assigned_agent_email || "Agent"}
              </div>
            )}
            {lead.current_status === "application_pending" && (
              <div style={{
                fontSize: ".85rem",
                color: "var(--text-muted)",
                padding: "8px 12px",
                width: "100%",
                background: "var(--warning-bg)",
                border: "1px solid var(--warning-border)",
                borderRadius: "6px",
              }}>
                ⏳ Waiting for application decision from client...
                {lead.application_status?.decision_at && (
                  <p style={{ margin: "4px 0 0", fontSize: ".8rem" }}>
                    Last update: {new Date(lead.application_status.decision_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}

            {/* Approved Status - Show when current_status is approved OR when there are approved units */}
            {(lead.current_status === "approved" || (lead.application_status?.approved_units && lead.application_status.approved_units.length > 0)) && (
              <div style={{
                padding: "12px",
                background: "var(--success-bg)",
                border: "1px solid var(--success-border)",
                borderRadius: "6px",
                marginBottom: "12px",
              }}>
                <p style={{ margin: "0 0 8px", fontWeight: 600, color: "var(--success-text)", fontSize: ".95rem" }}>
                  ✓ Application Approved!
                </p>
                <p style={{ margin: 0, fontSize: ".85rem", color: "var(--success-text)" }}>
                  Client has been approved for the application. Ready to confirm commission.
                </p>
                {lead.application_status?.approved_units && lead.application_status.approved_units.length > 0 && (
                  <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid var(--success-border)" }}>
                    <p style={{ margin: "0 0 6px", fontSize: ".8rem", fontWeight: 500, color: "var(--success-text)" }}>
                      Approved Properties:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: "20px", fontSize: ".8rem", color: "var(--success-text)" }}>
                      {lead.application_status.approved_units.map((unit, idx) => (
                        <li key={idx}>
                          {unit.apartment_name} ({unit.bedrooms}bd/{unit.bathrooms}ba) - {unit.rent_range}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Denied Status - Show when current_status is denied OR when there are denied units */}
            {(lead.current_status === "denied" || (lead.application_status?.denied_units && lead.application_status.denied_units.length > 0)) && (
              <div style={{
                padding: "12px",
                background: "var(--danger-bg)",
                border: "1px solid var(--danger-border)",
                borderRadius: "6px",
                marginBottom: "12px",
              }}>
                <p style={{ margin: "0 0 8px", fontWeight: 600, color: "var(--danger-text)", fontSize: ".95rem" }}>
                  ✗ Application Denied
                </p>
                {lead.application_status?.denial_reason && (
                  <p style={{ margin: "0 0 8px", fontSize: ".85rem", color: "var(--danger-text)" }}>
                    Reason: {lead.application_status.denial_reason}
                  </p>
                )}
                {lead.application_status?.denied_units && lead.application_status.denied_units.length > 0 && (
                  <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid var(--danger-border)" }}>
                    <p style={{ margin: "0 0 6px", fontSize: ".8rem", fontWeight: 500, color: "var(--danger-text)" }}>
                      Denied Properties:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: "20px", fontSize: ".8rem", color: "var(--danger-text)" }}>
                      {lead.application_status.denied_units.map((unit, idx) => (
                        <li key={idx}>
                          <div>{unit.apartment_name} ({unit.bedrooms}bd/{unit.bathrooms}ba) - {unit.rent_range}</div>
                          {unit.denial_reason && (
                            <div style={{ fontSize: ".75rem", color: "var(--danger-text)", marginTop: "2px", fontStyle: "italic" }}>
                              Reason: {unit.denial_reason}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {matches.some((m) => m.cx_response === "interested" && m.unit_id !== lead.application_status?.applied_unit_id) && (
                  <p style={{ margin: "8px 0 0", fontSize: ".85rem", color: "var(--danger-text)" }}>
                    Client selected other properties to reapply to.
                  </p>
                )}
              </div>
            )}

            {/* Denied with new properties - send application reminder instead of scheduling tours */}
            {(lead.current_status === "denied" || (lead.application_status?.denied_units && lead.application_status.denied_units.length > 0)) && matches.some((m) => m.cx_response === "interested") && (
              <button
                className="btn btn-sm"
                style={{ background: "var(--purple)", color: "var(--on-solid)" }}
                onClick={() => sendApplicationReminder()}
                disabled={updatingStatus}
              >
                📨 Send Application Reminder
              </button>
            )}


            {/* Application Decision Submitted */}
            {lead.current_status === "cx_responded" && matches.some((m) => m.cx_response === "denied") && (
              <div style={{
                fontSize: ".85rem",
                color: "var(--success)",
                padding: "6px 0",
                width: "100%",
                fontWeight: 500,
              }}>
                ✓ Client resubmitted after denial. New properties ready for touring.
              </div>
            )}

            {/* Final stages - Show Confirm Commission when there are approved units */}
            {(lead.current_status === "approved" || (lead.application_status?.approved_units && lead.application_status.approved_units.length > 0)) && lead.current_status !== "commission_confirmed" && (
              <button
                className="btn btn-sm"
                style={{ background: "var(--purple)", color: "var(--on-solid)" }}
                onClick={() => updateLeadStatus("commission_confirmed", "Commission confirmed with complex")}
                disabled={updatingStatus}
              >
                ✓ Confirm Commission
              </button>
            )}

            {lead.current_status === "commission_confirmed" && (
              <div style={{ fontSize: ".85rem", color: "var(--success)", padding: "6px 0", width: "100%", fontWeight: 600 }}>
                ✓ Commission confirmed - Lead complete!
              </div>
            )}
          </div>
        </div>

        {/* Tour Scheduling Modal - Per Property Dates & Times */}
        {showTourModal && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "var(--overlay)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}>
            <div style={{
              background: "var(--surface)",
              borderRadius: 12,
              padding: 24,
              maxWidth: 600,
              width: "90%",
              maxHeight: "85vh",
              overflowY: "auto",
            }}>
              <h3 style={{ marginBottom: 16 }}>Schedule Tour Dates & Times</h3>
              <div style={{
                background: "var(--warning-bg)",
                border: "1px solid var(--warning-border)",
                borderRadius: 6,
                padding: 10,
                marginBottom: 16,
                fontSize: ".85rem",
                color: "var(--warning-text)",
              }}>
                <strong>📋 Reminder:</strong> Remember to send guest cards to these apartments so you get credited for the tour!
              </div>
              <p style={{ margin: "0 0 20px 0", fontSize: ".9rem", color: "var(--text-muted)" }}>
                Set a date and time for each property the client wants to tour.
              </p>
              <form onSubmit={handleScheduleTour}>
                {/* Date & Time input for each selected property */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Selected Properties - Unified List with Date & Time */}
                    {(() => {
                      // Filter interested matches and deduplicate
                      const interested = matches.filter((m) => m.cx_response === "interested");
                      const seenIds = new Set();
                      const uniqueMatches = interested.filter((m) => {
                        let id;
                        if (m.type === "unit") {
                          id = `unit-${m.unit_id}`;
                        } else if (m.type === "apartment") {
                          id = `apartment-${m.apartment?.id}`;
                        } else {
                          id = `property-${m.property_id}`;
                        }
                        
                        if (seenIds.has(id)) {
                          console.warn(`[LeadDetail] Filtering duplicate in schedule tour form: ${id}`);
                          return false;
                        }
                        seenIds.add(id);
                        return true;
                      });

                      return uniqueMatches.map((m) => {
                        const isUnit = m.type === "unit";
                        const isApartment = m.type === "apartment";
                        const isProperty = m.type === "property";
                        
                        // Build selection ID based on type
                        let selectionId;
                        if (isUnit) {
                          selectionId = `unit-${m.unit_id}`;
                        } else if (isApartment) {
                          selectionId = `apartment-${m.apartment.id}`;
                        } else {
                          selectionId = `property-${m.property_id}`;
                        }
                        
                        // Get name
                        const name = isUnit ? m.apartment?.name : (isApartment ? m.apartment?.name : (m.property?.property_name || m.property?.address || "Property"));
                        
                        // Color coding
                        let borderColor = "var(--warning)";
                        let bgColor = "var(--warning-bg)";
                        let textColor = "var(--warning-text)";
                        
                        if (isUnit) {
                          borderColor = "var(--info)";
                          bgColor = "var(--info-bg)";
                          textColor = "var(--info-text)";
                        }

                        return (
                          <div key={selectionId} style={{
                            padding: 16,
                            border: `2px solid ${borderColor}`,
                            borderRadius: 8,
                            background: bgColor,
                          }}>
                            <p style={{ margin: "0 0 12px 0", fontWeight: 600, fontSize: ".95rem", color: textColor }}>
                              {name}
                            </p>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                              <div>
                                <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: ".85rem", color: "var(--text)" }}>
                                  Date
                                </label>
                                <input
                                  type="date"
                                  value={tourDates[selectionId] || ""}
                                  onChange={(e) => setTourDates({
                                    ...tourDates,
                                    [selectionId]: e.target.value
                                  })}
                                  required
                                  style={{
                                    width: "100%",
                                    padding: 10,
                                    border: "1px solid var(--border-strong)",
                                    borderRadius: 6,
                                    fontSize: ".9rem",
                                    boxSizing: "border-box",
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: ".85rem", color: "var(--text)" }}>
                                  Time
                                </label>
                                <input
                                  type="time"
                                  value={tourTimes[selectionId] || ""}
                                  onChange={(e) => setTourTimes({
                                    ...tourTimes,
                                    [selectionId]: e.target.value
                                  })}
                                  required
                                  style={{
                                    width: "100%",
                                    padding: 10,
                                    border: "1px solid var(--border-strong)",
                                    borderRadius: 6,
                                    fontSize: ".9rem",
                                    boxSizing: "border-box",
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTourModal(false);
                      setTourDates({});
                      setTourTimes({});
                    }}
                    className="btn btn-sm"
                    style={{ background: "var(--border)", color: "var(--text)", flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm"
                    style={{ background: "var(--success)", color: "var(--on-solid)", flex: 1 }}
                    disabled={schedulingTour}
                  >
                    {schedulingTour ? "Scheduling…" : "Confirm Tour/Send Guest Cards"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reschedule Modal */}
        {showRescheduleModal && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "var(--overlay)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}>
            <div style={{
              background: "var(--surface)",
              borderRadius: 12,
              padding: 24,
              maxWidth: 500,
              width: "90%",
            }}>
              <h3 style={{ marginBottom: 4 }}>Request New Recommendations</h3>
              <p style={{ margin: "0 0 20px", fontSize: ".9rem", color: "var(--text-muted)" }}>
                Move the lead to Round {(lead.current_round || 1) + 1} and prepare for new recommendations.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: ".9rem", color: "var(--text)" }}>
                  Reason for Reschedule
                </label>
                <select
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    border: "1px solid var(--border-strong)",
                    borderRadius: 6,
                    fontSize: ".9rem",
                    fontFamily: "inherit",
                  }}
                >
                  <option value="">Select a reason...</option>
                  <option value="not_interested">Client not interested in any properties</option>
                  <option value="schedule_conflict">Client had schedule conflict</option>
                  <option value="different_preferences">Preferences changed</option>
                  <option value="other">Other reason</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: ".9rem", color: "var(--text)" }}>
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={rescheduleNotes}
                  onChange={(e) => setRescheduleNotes(e.target.value)}
                  placeholder="E.g., Client mentioned they prefer more modern units..."
                  style={{
                    width: "100%",
                    minHeight: 80,
                    padding: 10,
                    border: "1px solid var(--border-strong)",
                    borderRadius: 6,
                    fontSize: ".9rem",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowRescheduleModal(false);
                    setRescheduleReason("");
                    setRescheduleNotes("");
                  }}
                  className="btn btn-sm"
                  style={{ background: "var(--border)", color: "var(--text)", flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRequestReschedule}
                  className="btn btn-sm"
                  style={{ background: "var(--warning)", color: "var(--on-solid)", flex: 1 }}
                  disabled={processingReschedule}
                >
                  {processingReschedule ? "Processing…" : "Request Reschedule"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Send to Agent Modal */}
        {showSendAgentModal && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "var(--overlay)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}>
            <div style={{
              background: "var(--surface)",
              borderRadius: 12,
              padding: 24,
              maxWidth: 500,
              width: "90%",
            }}>
              <h3 style={{ marginBottom: 4 }}>Forward Lead to Another Agent</h3>
              <p style={{ margin: "0 0 20px", fontSize: ".9rem", color: "var(--text-muted)" }}>
                Send this lead to another agent via email. Enter their email address.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: ".9rem", color: "var(--text)" }}>
                  Agent Email
                </label>
                <input
                  type="email"
                  value={selectedAgentEmail}
                  onChange={(e) => setSelectedAgentEmail(e.target.value)}
                  placeholder="agent@email.com"
                  style={{
                    width: "100%",
                    padding: 10,
                    border: "1px solid var(--border-strong)",
                    borderRadius: 6,
                    fontSize: ".9rem",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: ".9rem", color: "var(--text)" }}>
                  Agent Name
                </label>
                <input
                  type="text"
                  value={selectedAgentName}
                  onChange={(e) => setSelectedAgentName(e.target.value)}
                  placeholder="Agent's name"
                  style={{
                    width: "100%",
                    padding: 10,
                    border: "1px solid var(--border-strong)",
                    borderRadius: 6,
                    fontSize: ".9rem",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowSendAgentModal(false);
                    setSelectedAgentEmail("");
                    setSelectedAgentName("");
                  }}
                  className="btn btn-sm"
                  style={{ background: "var(--border)", color: "var(--text)", flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendToAgent}
                  className="btn btn-sm"
                  style={{ background: "var(--purple)", color: "var(--on-solid)", flex: 1 }}
                  disabled={processingAgentForward}
                >
                  {processingAgentForward ? "Sending…" : "Forward Lead"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Send Results Button */}
        <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
          <button
            className="btn btn-accent"
            onClick={handleSend}
            disabled={sending || lead.status === "sent"}
          >
            {lead.status === "sent"
              ? "✓ Already Sent"
              : sending
              ? "Sending…"
              : "Send Results to Client"}
          </button>

          {lead.results_token && (
            <a
              className="btn btn-primary btn-sm"
              href={`/results/${lead.results_token}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Preview Client Page ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
