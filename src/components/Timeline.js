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
  created: "#3b82f6",
  recommended_sent: "#8b5cf6",
  cx_responded: "#ec4899",
  tour_scheduled: "#f59e0b",
  tour_confirmation_sent: "#f59e0b",
  tour_completed: "#10b981",
  application_pending: "#6366f1",
  application_submitted: "#6366f1",
  approved: "#059669",
  denied: "#dc2626",
  commission_confirmed: "#7c3aed",
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
      <div style={{ textAlign: "center", color: "#6b7280", padding: "24px 16px" }}>
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
            background: "#e5e7eb",
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
                background: STAGE_COLORS[event.stage] || "#6b7280",
                border: "3px solid #fff",
                position: "relative",
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
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
                      color: "#6b7280",
                      cursor: "pointer",
                    }}
                  >
                    {expandedEvent === idx ? "▾" : "▸"}
                  </span>
                ) : null}
              </div>

              <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
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
                    background: "#f9fafb",
                    borderLeft: `3px solid ${STAGE_COLORS[event.stage] || "#6b7280"}`,
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
                        background: "#fff",
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
