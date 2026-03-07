"use client";

function scoreBadge(score) {
  if (score == null) return <span className="text-muted">—</span>;
  let cls = "low";
  if (score >= 70) cls = "high";
  else if (score >= 40) cls = "medium";
  return <span className={`score-badge ${cls}`}>{score}</span>;
}

function statusBadge(status) {
  return <span className={`status-badge ${status}`}>{status}</span>;
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
            <td>{statusBadge(lead.status)}</td>
            <td className="text-muted" style={{ fontSize: ".85rem" }}>
              {new Date(lead.created_at).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
