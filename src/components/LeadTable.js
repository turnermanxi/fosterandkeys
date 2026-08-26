"use client";

function scoreBadge(score) {
  if (score == null) return <span className="text-muted">—</span>;
  let cls = "low";
  if (score >= 70) cls = "high";
  else if (score >= 40) cls = "medium";
  return <span className={`score-badge ${cls}`}>{score}</span>;
}

function statusBadge(status) {
  const statusConfig = {
    created: { bg: "#dbeafe", color: "#1e40af", label: "New" },
    recommended_sent: { bg: "#e9d5ff", color: "#6b21a8", label: "Sent" },
    cx_responded: { bg: "#fbcfe8", color: "#831843", label: "CX Response" },
    tour_scheduled: { bg: "#fef3c7", color: "#92400e", label: "Tour Scheduled" },
    tour_confirmation_sent: { bg: "#fef3c7", color: "#92400e", label: "Waiting Confirmation" },
    tour_completed: { bg: "#d1fae5", color: "#065f46", label: "Tour Done" },
    application_pending: { bg: "#e0e7ff", color: "#312e81", label: "App Pending" },
    application_submitted: { bg: "#e0e7ff", color: "#312e81", label: "App Submitted" },
    approved: { bg: "#dcfce7", color: "#166534", label: "✓ Approved" },
    denied: { bg: "#fee2e2", color: "#991b1b", label: "✗ Denied" },
    commission_confirmed: { bg: "#ede9fe", color: "#5b21b6", label: "Commission Done" },
  };
  const config = statusConfig[status] || { bg: "#f3f4f6", color: "#374151", label: status };
  return (
    <span style={{ background: config.bg, color: config.color, padding: "4px 12px", borderRadius: 4, fontSize: ".85rem", fontWeight: 500 }}>
      {config.label}
    </span>
  );
}

export default function LeadTable({ leads, onSelect }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Rent Budget</th>
          <th>Location</th>
          <th>Top Score</th>
          <th>Status</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {leads.map((lead) => (
          <tr
            key={lead.id}
            onClick={() => onSelect(lead)}
            style={{ cursor: "pointer" }}
          >
            <td style={{ fontWeight: 600 }}>{lead.full_name}</td>
            <td>{lead.email}</td>
            <td>
              {lead.budget_min != null || lead.budget_max != null
                ? `$${(lead.budget_min ?? 0).toLocaleString()} – $${(lead.budget_max ?? "∞").toLocaleString()}/mo`
                : "—"}
            </td>
            <td>{lead.desired_location || "—"}</td>
            <td>{scoreBadge(lead.top_score)}</td>
            <td>{statusBadge(lead.current_status || lead.status)}</td>
            <td className="text-muted" style={{ fontSize: ".85rem" }}>
              {new Date(lead.created_at).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
