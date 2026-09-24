"use client";

import { useState } from "react";

const STAGE_LABELS = {
  created: "Lead Created",
  recommended_sent: "Recommendations Sent",
  cx_responded: "CX Responded",
  tour_scheduled: "Tour Scheduled",
  tour_confirmation_sent: "Tour Confirmation Sent",
  tour_completed: "Tour Completed",
  application_pending: "Application Pending",
  application_submitted: "Application Submitted",
  approved: "Approved",
  denied: "Denied",
  commission_confirmed: "Commission Confirmed",
};

const STAGE_COLORS = {
  created: "var(--info)",
  recommended_sent: "var(--purple)",
  cx_responded: "var(--purple)",
  tour_scheduled: "var(--warning)",
  tour_confirmation_sent: "var(--warning)",
  tour_completed: "var(--success)",
  application_pending: "var(--purple)",
  application_submitted: "var(--purple)",
  approved: "var(--success)",
  denied: "var(--danger)",
  commission_confirmed: "var(--purple)",
};

export default function Timeline({ events = [], viewMode = "agent" }) {
  const [expandedEvent, setExpandedEvent] = useState(null);

  // Filter events based on viewMode
  const visibleEvents = events.filter((event) => {
    if (viewMode === "cx") {
      return event.visibility === "both" || event.visibility === "cx_only";
    }
    return true; // agent sees all
  });

  if (!visibleEvents.length) {
    return (
      <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px 16px" }}>
        No timeline events yet.
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Vertical line */}
      {visibleEvents.length > 1 && (
        <div
          style={{
            position: "absolute",
            left: 15,
            top: 0,
            bottom: 0,
            width: 2,
            background: "var(--border)",
          }}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {visibleEvents.map((event, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              gap: 12,
              cursor: event.notes || event.data ? "pointer" : "default",
            }}
            onClick={() =>
              event.notes || event.data
                ? setExpandedEvent(expandedEvent === idx ? null : idx)
                : null
            }
          >
            {/* Circle dot */}
            <div
              style={{
                flexShrink: 0,
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: STAGE_COLORS[event.stage] || "var(--text-muted)",
                border: "3px solid var(--surface)",
                position: "relative",
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--on-solid)",
                fontSize: "0.7rem",
                fontWeight: 700,
              }}
            >
              {idx + 1}
            </div>

            {/* Content */}
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <strong style={{ fontSize: ".95rem" }}>
                  {STAGE_LABELS[event.stage] || event.stage}
                </strong>
                {event.notes || event.data ? (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    {expandedEvent === idx ? "▾" : "▸"}
                  </span>
                ) : null}
              </div>

              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {new Date(event.timestamp).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>

              {/* Expandable details */}
              {expandedEvent === idx && (event.notes || event.data) && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "12px 12px",
                    background: "var(--surface-2)",
                    borderLeft: `3px solid ${STAGE_COLORS[event.stage] || "var(--text-muted)"}`,
                    borderRadius: 4,
                  }}
                >
                  {event.notes && (
                    <div style={{ fontSize: ".85rem", lineHeight: 1.5, marginBottom: event.data ? 8 : 0 }}>
                      {event.notes}
                    </div>
                  )}
                  {event.data && Object.keys(event.data).length > 0 && (
                    <pre
                      style={{
                        fontSize: ".75rem",
                        background: "var(--surface)",
                        padding: 8,
                        borderRadius: 3,
                        overflow: "auto",
                        margin: 0,
                      }}
                    >
                      {JSON.stringify(event.data, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
