"use client";

import { useState, useEffect } from "react";

export default function SendToLeadModal({ property, onClose, onSuccess }) {
  const [leads, setLeads] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    setLoading(true);
    try {
      const leadsRes = await fetch("/api/leads");
      const leadsData = await leadsRes.json();
      setLeads(Array.isArray(leadsData) ? leadsData : []);
    } catch (err) {
      console.error("Failed to load leads:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddProperty() {
    if (!selectedLeadId) {
      alert("Please select a lead");
      return;
    }

    setAdding(true);
    try {
      // Determine if this is an apartment or regular property
      const isApartment = property.source === "apartment_data";
      
      const res = await fetch(`/api/leads/${selectedLeadId}/add-property`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: isApartment ? null : property.id,
          apartment_id: isApartment ? property.apartment_id : null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert("Property added to lead's match list!");
        onSuccess();
      } else {
        const errorData = await res.json();
        const errorMessage = errorData.error || "Failed to add property";
        alert(errorMessage);
      }
    } catch (err) {
      console.error("Failed to add property:", err);
      alert("Failed to add property: " + err.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--overlay)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 8,
          padding: 32,
          maxWidth: 500,
          boxShadow: "0 20px 25px rgba(15,23,42,.16)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: "1.3rem" }}>Add to Lead</h2>
        <p style={{ margin: "0 0 24px", color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Select a lead to add this property to their match list
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddProperty();
          }}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: 4 }}>
              Lead *
            </label>
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              disabled={loading}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-strong)",
                borderRadius: 4,
              }}
            >
              <option value="">Select a lead...</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.full_name} ({lead.email})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "10px 16px",
                background: "var(--border)",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedLeadId || loading || adding}
              style={{
                flex: 1,
                padding: "10px 16px",
                background: selectedLeadId && !loading && !adding ? "var(--success)" : "var(--border-strong)",
                color: "var(--on-solid)",
                border: "none",
                borderRadius: 4,
                cursor: selectedLeadId && !loading && !adding ? "pointer" : "default",
                fontSize: "0.9rem",
              }}
            >
              {adding ? "Adding..." : "Add to Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
