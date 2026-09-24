"use client";

export default function DuplicateWarning({ duplicates, onDismiss, onProceed }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--overlay)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 8,
          padding: 32,
          maxWidth: 500,
          boxShadow: "0 20px 25px rgba(15,23,42,.16)",
        }}
      >
        <h3 style={{ margin: "0 0 16px", fontSize: "1.1rem", color: "var(--warning)" }}>
          ⚠️ Similar Properties Found
        </h3>

        <p style={{ margin: "0 0 16px", color: "var(--text-muted)" }}>
          We found {duplicates.length} similar propert{duplicates.length === 1 ? "y" : "ies"}. 
          Please review to make sure you're not adding a duplicate:
        </p>

        <div
          style={{
            background: "var(--warning-bg)",
            border: "1px solid var(--warning-border)",
            borderRadius: 4,
            padding: 16,
            marginBottom: 20,
            maxHeight: 200,
            overflowY: "auto",
          }}
        >
          {duplicates.map((dup, idx) => (
            <div
              key={idx}
              style={{
                padding: 12,
                borderBottom: idx < duplicates.length - 1 ? "1px solid var(--warning-border)" : "none",
              }}
            >
              <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "0.9rem" }}>
                {dup.property_name || dup.address}
              </p>
              <p style={{ margin: "0 0 4px", fontSize: "0.85rem", color: "var(--warning-text)" }}>
                {dup.address}, {dup.city}
              </p>
              <p style={{ margin: "0 0 4px", fontSize: "0.8rem", color: "var(--warning-text)" }}>
                Confidence: {dup.confidence}% • Reason: {dup.reason.replace(/_/g, " ")}
              </p>
              {dup.price_min && dup.price_max && (
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--warning-text)" }}>
                  Price: ${Number(dup.price_min).toLocaleString()} – ${Number(dup.price_max).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={onDismiss}
            style={{
              flex: 1,
              padding: "10px 16px",
              background: "var(--border)",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onProceed}
            style={{
              flex: 1,
              padding: "10px 16px",
              background: "var(--warning)",
              color: "var(--on-solid)",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: 500,
            }}
          >
            Save Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
