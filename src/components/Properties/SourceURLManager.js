"use client";

import { useState, useEffect } from "react";

/**
 * SourceURLManager
 * Allows editing source_url for properties
 * Integrated into the property detail or edit flow
 */
export default function SourceURLManager({ property, onSave }) {
  const [sourceUrl, setSourceUrl] = useState(property?.source_url || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSave() {
    if (!sourceUrl.trim()) {
      setMessage({ type: "error", text: "Source URL cannot be empty" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_url: sourceUrl }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "✅ Source URL saved!" });
        if (onSave) onSave(sourceUrl);
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to save" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }

    setSaving(false);
  }

  return (
    <div style={{ marginBottom: "20px", padding: "12px", backgroundColor: "var(--surface-2)", borderRadius: "6px" }}>
      <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "8px" }}>
        Source URL (for syncing)
      </label>
      <input
        type="url"
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
        placeholder="https://example.com/property-123"
        style={{
          width: "100%",
          padding: "8px",
          border: "1px solid var(--border)",
          borderRadius: "4px",
          fontSize: "0.9rem",
          marginBottom: "8px",
          boxSizing: "border-box",
        }}
      />
      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 8px 0" }}>
        💡 This URL will be used to automatically fetch and sync property data
      </p>

      {message && (
        <p
          style={{
            fontSize: "0.85rem",
            color: message.type === "error" ? "var(--danger-text)" : "var(--success-text)",
            margin: "8px 0",
          }}
        >
          {message.text}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: "6px 12px",
          backgroundColor: "var(--info)",
          color: "var(--on-solid)",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "0.85rem",
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "Saving..." : "Save URL"}
      </button>
    </div>
  );
}
