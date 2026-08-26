"use client";

export default function DuplicateWarning({ duplicates, onDismiss, onProceed }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          padding: 32,
          maxWidth: 500,
          boxShadow: "0 20px 25px rgba(0,0,0,0.15)",
        }}
      >
        <h3 style={{ margin: "0 0 16px", fontSize: "1.1rem", color: "#d97706" }}>
          ⚠️ Similar Properties Found
        </h3>

        <p style={{ margin: "0 0 16px", color: "#666" }}>
          We found {duplicates.length} similar propert{duplicates.length === 1 ? "y" : "ies"}. 
          Please review to make sure you're not adding a duplicate:
        </p>

        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #fcd34d",
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
                borderBottom: idx < duplicates.length - 1 ? "1px solid #fcd34d" : "none",
              }}
            >
              <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "0.9rem" }}>
                {dup.property_name || dup.address}
              </p>
              <p style={{ margin: "0 0 4px", fontSize: "0.85rem", color: "#92400e" }}>
                {dup.address}, {dup.city}
              </p>
              <p style={{ margin: "0 0 4px", fontSize: "0.8rem", color: "#92400e" }}>
                Confidence: {dup.confidence}% • Reason: {dup.reason.replace(/_/g, " ")}
              </p>
              {dup.price_min && dup.price_max && (
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#92400e" }}>
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
              background: "#e5e7eb",
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
              background: "#f59e0b",
              color: "#fff",
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
