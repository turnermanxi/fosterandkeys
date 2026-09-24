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
    created: { bg: "var(--info-bg)", color: "var(--info-text)", label: "New" },
    recommended_sent: { bg: "var(--purple-border)", color: "var(--purple-text)", label: "Sent" },
    cx_responded: { bg: "var(--purple-bg)", color: "var(--purple-text)", label: "CX Response" },
    tour_scheduled: { bg: "var(--warning-bg)", color: "var(--warning-text)", label: "Tour Scheduled" },
    tour_confirmation_sent: { bg: "var(--warning-bg)", color: "var(--warning-text)", label: "Waiting Confirmation" },
    tour_completed: { bg: "var(--success-bg)", color: "var(--success-text)", label: "Tour Done" },
    application_pending: { bg: "var(--info-bg)", color: "var(--info-text)", label: "App Pending" },
    application_submitted: { bg: "var(--info-bg)", color: "var(--info-text)", label: "App Submitted" },
    approved: { bg: "var(--success-bg)", color: "var(--success-text)", label: "✓ Approved" },
    denied: { bg: "var(--danger-bg)", color: "var(--danger-text)", label: "✗ Denied" },
    commission_confirmed: { bg: "var(--purple-bg)", color: "var(--purple-text)", label: "Commission Done" },
  };
  const config = statusConfig[status] || { bg: "var(--surface-2)", color: "var(--text)", label: status };
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
