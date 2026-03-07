"use client";

import { useState, useEffect } from "react";

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
  if (lo === hi || !hi) return `$${lo.toLocaleString()}/mo`;
  return `$${lo.toLocaleString()} – $${hi.toLocaleString()}/mo`;
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

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/properties");
        const data = await res.json();

        // Build lookup maps
        const aptMap = {};
        (data.apartments ?? []).forEach((a) => (aptMap[a.id] = a));
        setApartments(aptMap);

        const unitMap = {};
        (data.units ?? []).forEach((u) => (unitMap[u.id] = u));
        setUnits(unitMap);

        // lead.lead_matches already has score + unit_id + apartment_id
        const sorted = [...(lead.lead_matches ?? [])].sort(
          (a, b) => b.score - a.score
        );
        setMatches(sorted);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [lead]);

  async function handleSend() {
    setSending(true);
    await onSend(lead.id, editedSummary);
    setSending(false);
  }

  return (
    <div className="detail-panel" onClick={onClose}>
      <div className="detail-panel-inner" onClick={(e) => e.stopPropagation()}>
        <button className="detail-panel-close" onClick={onClose}>
          &times;
        </button>

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
            background: "linear-gradient(135deg, #eef2ff, #f0fdf4)",
            borderRadius: 8,
            border: "1px solid #c7d2fe",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <strong style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "1.1rem" }}>✨</span> AI Summary
              </strong>
              <button
                className="btn btn-sm"
                style={{ background: isEditingSummary ? "#059669" : "#e5e7eb", color: isEditingSummary ? "#fff" : "#374151", fontSize: ".8rem", padding: "4px 12px" }}
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
                  border: "1px solid #c7d2fe",
                  borderRadius: 6,
                  resize: "vertical",
                  fontFamily: "inherit",
                  background: "#fff",
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
              style={{ background: "#e5e7eb", color: "#374151", marginBottom: 8 }}
              onClick={() => setShowRawEmail(!showRawEmail)}
            >
              {showRawEmail ? "Hide" : "Show"} Original Email
            </button>
            {showRawEmail && (
              <pre style={{
                background: "#f9fafb",
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

        <h3 style={{ marginBottom: 8 }}>Matched Units</h3>

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
                <th>Apartment</th>
                <th>Unit / Floorplan</th>
                <th>Beds/Baths</th>
                <th>Rent</th>
                <th>Area</th>
                <th>Accepts</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => {
                const unit = units[m.unit_id];
                const apt = apartments[m.apartment_id];
                const acceptParts = [];
                if (apt?.accepts_broken_lease) acceptParts.push("BL");
                if (apt?.accepts_bankruptcy) acceptParts.push("BK");
                if (apt?.accepts_eviction) acceptParts.push("EV");
                return (
                  <tr key={m.unit_id}>
                    <td style={{ fontWeight: 600 }}>
                      {apt?.url ? (
                        <a href={apt.url} target="_blank" rel="noopener noreferrer">
                          {apt?.name ?? "Unknown"} ↗
                        </a>
                      ) : (
                        apt?.name ?? "Unknown"
                      )}
                    </td>
                    <td>{unit?.floorplan ?? unit?.unit_number ?? "—"}</td>
                    <td>{unit?.bedrooms ?? "—"} / {unit?.bathrooms ?? "—"}</td>
                    <td>{formatRent(unit)}</td>
                    <td>{apt?.metro_area === "HOUSTON_METRO" ? "Houston" : apt?.metro_area === "DFW_METRO" ? "DFW" : "—"}</td>
                    <td>{acceptParts.length > 0 ? acceptParts.join(", ") : "—"}</td>
                    <td>{scoreBadge(m.score)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

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
