"use client";

import { useState } from "react";

/**
 * SinglePropertySyncModal
 * Sync a single property from its source URL
 * Shows data changes and allows manual application
 */
export default function SinglePropertySyncModal({ isOpen, onClose, property }) {
  const [result, setResult] = useState(null);
  const [selectedMode, setSelectedMode] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);

  async function runSync() {
    if (!selectedMode) return;

    setSyncing(true);
    setError(null);

    try {
      const res = await fetch("/api/properties/sync-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          propertyId: property.id,
          mode: selectedMode 
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to check for changes");
        setSyncing(false);
        return;
      }

      setResult({
        propertyId: property.id,
        propertyName: property.property_name || "Unnamed",
        comparison: data.comparison,
        extractedData: data.extractedData,
        sourceUrl: data.sourceUrl,
        mode: data.mode,
        extractionMethod: data.extractionMethod,
        wouldUpdate: data.comparison.should_update && !data.comparison.needs_review,
        wouldReview: data.comparison.needs_review,
      });
    } catch (error) {
      console.error("Sync error:", error);
      setError(error.message || "Sync failed");
    }

    setSyncing(false);
  }

  async function applyChanges() {
    if (!result || !result.comparison.diff || result.comparison.diff.length === 0) {
      return;
    }

    setApplying(true);
    setError(null);

    try {
      const res = await fetch("/api/properties/sync-preview", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          changeset: result.comparison.diff,
          mode: result.mode,
          extractionMethod: result.extractionMethod,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to apply changes");
        setApplying(false);
        return;
      }

      alert(`✅ Applied ${data.changesApplied} change(s) successfully!`);
      setResult(null);
      setSelectedMode(null);
      onClose();
    } catch (error) {
      console.error("Apply error:", error);
      setError(error.message || "Failed to apply changes");
    }

    setApplying(false);
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0 }}>Sync Property</h2>
          <button className="btn btn-text" onClick={onClose}>
            ✕
          </button>
        </div>

        <p style={{ color: "#666", marginBottom: "16px", fontSize: "0.95rem" }}>
          <strong>{property.property_name || "Unnamed Property"}</strong>
          <br />
          {property.address}, {property.city}, {property.state} {property.zip}
        </p>

        {error && (
          <div style={{
            backgroundColor: "#fee",
            border: "1px solid #fcc",
            borderRadius: "6px",
            padding: "12px",
            marginBottom: "16px",
            color: "#c33",
            fontSize: "0.9rem"
          }}>
            ⚠️ {error}
          </div>
        )}

        {!result ? (
          <div style={{ marginBottom: "20px" }}>
            {!selectedMode ? (
              <>
                <p style={{ color: "#666", marginBottom: "16px" }}>
                  Choose how you'd like to sync this property:
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  <button
                    className={`mode-button ${selectedMode === 'simple' ? 'selected' : ''}`}
                    onClick={() => setSelectedMode('simple')}
                    style={{
                      padding: "16px",
                      border: "2px solid #ddd",
                      borderRadius: "6px",
                      cursor: "pointer",
                      backgroundColor: selectedMode === 'simple' ? "#e3f2fd" : "white",
                      borderColor: selectedMode === 'simple' ? "#0066cc" : "#ddd",
                      transition: "all 0.2s"
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: "4px" }}>📄 Simple Sync</div>
                    <div style={{ fontSize: "0.8rem", color: "#666" }}>Fast, HTML-based<br/>extraction</div>
                  </button>

                  <button
                    className={`mode-button ${selectedMode === 'advanced' ? 'selected' : ''}`}
                    onClick={() => setSelectedMode('advanced')}
                    style={{
                      padding: "16px",
                      border: "2px solid #ddd",
                      borderRadius: "6px",
                      cursor: "pointer",
                      backgroundColor: selectedMode === 'advanced' ? "#fff8f0" : "white",
                      borderColor: selectedMode === 'advanced' ? "#ffa500" : "#ddd",
                      transition: "all 0.2s"
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: "4px" }}>🤖 Advanced Sync</div>
                    <div style={{ fontSize: "0.8rem", color: "#666" }}>AI vision for<br/>graphic prices</div>
                  </button>
                </div>

                {!property.source_url && (
                  <div style={{
                    backgroundColor: "#fef3cd",
                    border: "1px solid #ffc107",
                    borderRadius: "6px",
                    padding: "12px",
                    marginBottom: "16px",
                    fontSize: "0.9rem",
                    color: "#856404"
                  }}>
                    ⚠️ No source URL configured. Please add a source URL to the property first.
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  onClick={runSync}
                  disabled={syncing || !selectedMode || !property.source_url}
                  style={{ width: "100%" }}
                >
                  {syncing ? `Syncing with ${selectedMode}...` : "Check for Changes"}
                </button>
              </>
            ) : (
              <>
                <p style={{ color: "#666", marginBottom: "16px" }}>
                  ✓ Mode selected: <strong>{selectedMode === 'simple' ? '📄 Simple' : '🤖 Advanced'}</strong>
                </p>
                <button
                  className="btn btn-primary"
                  onClick={runSync}
                  disabled={syncing || !property.source_url}
                  style={{ width: "100%", marginBottom: "8px" }}
                >
                  {syncing ? `Checking for changes...` : "Check for Changes"}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedMode(null)}
                  style={{ width: "100%" }}
                >
                  Change Mode
                </button>
              </>
            )}
          </div>
        ) : (
          <div>
            <div style={{
              backgroundColor: result.wouldUpdate ? "#f0f8f0" : result.wouldReview ? "#fff8f0" : "#f5f5f5",
              padding: "12px",
              borderRadius: "6px",
              marginBottom: "16px",
              border: `1px solid ${result.wouldUpdate ? "#c6f6d5" : result.wouldReview ? "#fed7aa" : "#e5e7eb"}`
            }}>
              <p style={{ margin: "0 0 8px 0", fontSize: "0.95rem", fontWeight: 600 }}>
                {result.wouldUpdate && "✅ Would Auto-Update"}
                {result.wouldReview && "⚠️ Needs Manual Review"}
                {!result.wouldUpdate && !result.wouldReview && "⏭️ No Changes Needed"}
              </p>
              <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", color: "#666" }}>
                {result.comparison.changedFields.length === 0
                  ? "No fields would change"
                  : `${result.comparison.changedFields.length} field(s) would change`}
              </p>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#999" }}>
                Mode: <strong>{result.mode === 'simple' ? '📄 Simple' : '🤖 Advanced'}</strong> | 
                Method: <strong>{result.extractionMethod === 'screenshot' ? '📸 Screenshot' : 'HTML'}</strong>
              </p>
            </div>

            {result.comparison.changedFields.length > 0 && (
              <>
                <h4 style={{ margin: "0 0 12px 0", fontSize: "0.95rem" }}>Changed Fields</h4>
                <table style={{ width: "100%", fontSize: "0.85rem", marginBottom: "16px" }}>
                  <tbody>
                    {result.comparison.diff.map((change, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "8px", color: "#666", fontWeight: 500 }}>{change.field}</td>
                        <td style={{ padding: "8px", color: "#999", textAlign: "right" }}>
                          {JSON.stringify(change.old_value)}
                        </td>
                        <td style={{ padding: "8px", textAlign: "center", color: "#999" }}>→</td>
                        <td style={{ padding: "8px", color: "#333", fontWeight: 600, textAlign: "right" }}>
                          {JSON.stringify(change.new_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {result.comparison.reasons.length > 0 && (
              <>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95rem" }}>Review Reasons</h4>
                <ul style={{ margin: "0 0 16px 0", paddingLeft: "20px", fontSize: "0.85rem" }}>
                  {result.comparison.reasons.map((reason, i) => (
                    <li key={i} style={{ color: "#666", marginBottom: "4px" }}>
                      {reason}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
              <button
                className="btn btn-secondary"
                onClick={() => setResult(null)}
                style={{ width: "100%" }}
              >
                Check Again
              </button>
              {result.comparison.diff.length > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={applyChanges}
                  disabled={applying}
                  style={{ width: "100%", backgroundColor: "#28a745", borderColor: "#28a745" }}
                >
                  {applying ? "Applying..." : `Make Changes (${result.comparison.diff.length})`}
                </button>
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #eee" }}>
          <p style={{ fontSize: "0.8rem", color: "#999", margin: 0 }}>
            💡 This fetches real data from the source URL and shows what would change. You can apply changes or check again.
          </p>
        </div>

        <button className="btn btn-default" onClick={onClose} style={{ width: "100%", marginTop: "12px" }}>
          Close
        </button>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background-color: white;
          border-radius: 8px;
          padding: 24px;
          max-width: 500px;
          max-height: 85vh;
          overflow-y: auto;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
        }

        .btn-text {
          background: none;
          color: #666;
          padding: 0;
          font-size: 1.2rem;
        }

        .btn-text:hover {
          color: #000;
        }

        .btn-primary {
          background-color: #0066cc;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: #0052a3;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-default,
        .btn-secondary {
          background-color: #f0f0f0;
          color: #333;
          border: 1px solid #ddd;
        }

        .btn-default:hover,
        .btn-secondary:hover {
          background-color: #e0e0e0;
        }
      `}</style>
    </div>
  );
}
