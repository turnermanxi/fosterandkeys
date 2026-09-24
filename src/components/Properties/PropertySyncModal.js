"use client";

import { useState } from "react";

/**
 * PropertySyncModal
 * Bulk sync properties from their source URLs
 * Shows comparison results and allows manual application of changes
 */
export default function PropertySyncModal({ isOpen, onClose, properties = [] }) {
  const [results, setResults] = useState(null);
  const [selectedMode, setSelectedMode] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError] = useState(null);
  const resultsPerPage = 5;

  async function runSync() {
    if (!selectedMode) return;

    setSyncing(true);
    setError(null);

    try {
      // Only fetch properties that have source_url
      const propsToSync = properties.filter(p => p.source_url);

      if (propsToSync.length === 0) {
        setError("No properties have source URLs configured");
        setSyncing(false);
        return;
      }

      // Fetch sync previews for all properties with source_url
      const syncPromises = propsToSync.map(prop =>
        fetch("/api/properties/sync-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            propertyId: prop.id,
            mode: selectedMode 
          }),
        })
          .then(res => res.json())
          .then(data => ({
            propertyId: prop.id,
            propertyName: prop.property_name || "Unnamed",
            success: data.comparison !== undefined,
            mode: data.mode,
            extractionMethod: data.extractionMethod,
            ...data,
          }))
          .catch(err => ({
            propertyId: prop.id,
            propertyName: prop.property_name || "Unnamed",
            success: false,
            error: err.message,
          }))
      );

      const syncResults = await Promise.all(syncPromises);

      // Filter successful syncs
      const successfulSyncs = syncResults
        .filter(r => r.success)
        .map(r => ({
          propertyId: r.propertyId,
          propertyName: r.propertyName,
          comparison: r.comparison,
          extractedData: r.extractedData,
          mode: r.mode,
          extractionMethod: r.extractionMethod,
          wouldUpdate: r.comparison.should_update && !r.comparison.needs_review,
          wouldReview: r.comparison.needs_review,
        }));

      setResults(successfulSyncs);
      setCurrentPage(0);

      if (successfulSyncs.length < syncResults.length) {
        const failedCount = syncResults.length - successfulSyncs.length;
        console.warn(`${failedCount} properties failed to sync (no source URL or fetch error)`);
      }
    } catch (error) {
      console.error("Bulk sync error:", error);
      setError(error.message || "Failed to sync properties");
    }

    setSyncing(false);
  }

  async function applyAllChanges() {
    if (!results || results.length === 0) {
      return;
    }

    setApplying(true);
    setError(null);

    try {
      // Apply changes for all properties that have changes
      const applyPromises = results
        .filter(r => r.comparison.diff.length > 0)
        .map(r =>
          fetch("/api/properties/sync-preview", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              propertyId: r.propertyId,
              changeset: r.comparison.diff,
              mode: r.mode,
              extractionMethod: r.extractionMethod,
            }),
          })
            .then(res => res.json())
            .then(() => ({
              propertyId: r.propertyId,
              success: true,
            }))
            .catch(err => ({
              propertyId: r.propertyId,
              success: false,
              error: err.message,
            }))
        );

      const applyResults = await Promise.all(applyPromises);

      const successCount = applyResults.filter(r => r.success).length;
      const failureCount = applyResults.filter(r => !r.success).length;

      if (successCount > 0) {
        alert(`✅ Applied changes to ${successCount} properties!`);
      }
      if (failureCount > 0) {
        setError(`⚠️ Failed to apply changes to ${failureCount} properties`);
      }

      setResults(null);
      setSelectedMode(null);
    } catch (error) {
      console.error("Bulk apply error:", error);
      setError(error.message || "Failed to apply changes");
    }

    setApplying(false);
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2>Sync Properties</h2>
          <button className="btn btn-text" onClick={onClose}>
            ✕
          </button>
        </div>

        <p style={{ color: "var(--text-muted)", marginBottom: "20px" }}>
          This tool syncs properties from their configured source URLs and extracts real data.
          <br />
          <strong>Note:</strong> Properties must have a source URL configured before they can be synced.
        </p>

        {error && (
          <div style={{
            backgroundColor: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            borderRadius: "6px",
            padding: "12px",
            marginBottom: "16px",
            color: "var(--danger-text)",
            fontSize: "0.9rem"
          }}>
            ⚠️ {error}
          </div>
        )}

        {!results ? (
          <div style={{ marginBottom: "20px" }}>
            {!selectedMode ? (
              <>
                <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>
                  Choose how you'd like to sync all properties:
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  <button
                    onClick={() => setSelectedMode('simple')}
                    style={{
                      padding: "16px",
                      border: "2px solid var(--border)",
                      borderRadius: "6px",
                      cursor: "pointer",
                      backgroundColor: selectedMode === 'simple' ? "var(--info-bg)" : "var(--surface)",
                      borderColor: selectedMode === 'simple' ? "var(--info)" : "var(--border)",
                      transition: "all 0.2s"
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: "4px" }}>📄 Simple Sync</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Fast, HTML-based<br/>extraction</div>
                  </button>

                  <button
                    onClick={() => setSelectedMode('advanced')}
                    style={{
                      padding: "16px",
                      border: "2px solid var(--border)",
                      borderRadius: "6px",
                      cursor: "pointer",
                      backgroundColor: selectedMode === 'advanced' ? "var(--warning-bg)" : "var(--surface)",
                      borderColor: selectedMode === 'advanced' ? "var(--warning)" : "var(--border)",
                      transition: "all 0.2s"
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: "4px" }}>🤖 Advanced Sync</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>AI vision for<br/>graphic prices</div>
                  </button>
                </div>

                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px" }}>
                  Properties available: <strong>{properties.length}</strong>
                  <br/>
                  (Only properties with source URLs will be synced)
                </p>
              </>
            ) : (
              <>
                <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>
                  ✓ Using <strong>{selectedMode === 'simple' ? 'Simple' : 'Advanced'}</strong> sync mode
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setSelectedMode(null)}
                  >
                    Change Mode
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={runSync}
                    disabled={syncing || properties.length === 0}
                  >
                    {syncing ? `Syncing...` : `Run Sync`}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div>
            <div style={{ backgroundColor: "var(--surface-2)", padding: "12px", borderRadius: "6px", marginBottom: "15px" }}>
              <h3 style={{ margin: "0 0 8px 0" }}>Sync Results Summary</h3>
              <p style={{ margin: "4px 0", fontSize: "0.9rem" }}>
                <span style={{ color: "var(--success)", marginRight: "15px" }}>✅ Would Update: {results.filter(r => r.wouldUpdate).length}</span>
                <span style={{ color: "var(--warning)", marginRight: "15px" }}>⚠️ Needs Review: {results.filter(r => r.wouldReview).length}</span>
                <span style={{ color: "var(--text-muted)" }}>⏭️ Ignored: {results.filter(r => !r.wouldUpdate && !r.wouldReview).length}</span>
              </p>
              <p style={{ margin: "8px 0 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Mode: <strong>{selectedMode === 'simple' ? '📄 Simple' : '🤖 Advanced'}</strong> | 
                Showing page {currentPage + 1} of {Math.ceil(results.length / resultsPerPage)} ({results.length} total with changes)
              </p>
            </div>

            <h3 style={{ margin: "0 0 10px 0" }}>Changes by Property</h3>
            {results.slice(currentPage * resultsPerPage, (currentPage + 1) * resultsPerPage).map((result) => (
              <div
                key={result.propertyId}
                style={{
                  border: "1px solid var(--border)",
                  padding: "15px",
                  marginBottom: "10px",
                  borderRadius: "8px",
                  backgroundColor: result.wouldUpdate ? "var(--success-bg)" : result.wouldReview ? "var(--warning-bg)" : "var(--surface-2)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <h4 style={{ margin: "0 0 10px 0" }}>{result.propertyName}</h4>
                    <p style={{ margin: "5px 0", fontSize: "0.9rem" }}>
                      <strong>Changed fields:</strong> {result.comparison.changedFields.join(", ") || "None"}
                    </p>
                    <p style={{ margin: "5px 0", fontSize: "0.9rem" }}>
                      <strong>Status:</strong>
                      {result.wouldUpdate && " ✅ Would Update"}
                      {result.wouldReview && " ⚠️ Needs Review"}
                      {!result.wouldUpdate && !result.wouldReview && " ⏭️ Ignored"}
                    </p>

                    {result.comparison.reasons.length > 0 && (
                      <details style={{ marginTop: "10px" }}>
                        <summary style={{ cursor: "pointer", color: "var(--text-muted)" }}>Reasons ({result.comparison.reasons.length})</summary>
                        <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
                          {result.comparison.reasons.map((reason, i) => (
                            <li key={i} style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}

                    {result.comparison.diff.length > 0 && (
                      <details style={{ marginTop: "10px" }}>
                        <summary style={{ cursor: "pointer", color: "var(--text-muted)" }}>Changes ({result.comparison.diff.length})</summary>
                        <table style={{ marginTop: "8px", fontSize: "0.85rem", width: "100%" }}>
                          <tbody>
                            {result.comparison.diff.map((change, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                                <td style={{ padding: "4px", color: "var(--text-muted)" }}>{change.field}</td>
                                <td style={{ padding: "4px", color: "var(--text-muted)" }}>{JSON.stringify(change.old_value)}</td>
                                <td style={{ padding: "4px" }}>→</td>
                                <td style={{ padding: "4px", color: "var(--text)" }}>
                                  <strong>{JSON.stringify(change.new_value)}</strong>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "20px",
              paddingTop: "15px",
              borderTop: "1px solid var(--border)"
            }}>
              <button
                className="btn btn-default"
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
              >
                ← Previous
              </button>

              <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
                Page {currentPage + 1} of {Math.ceil(results.length / resultsPerPage)}
              </span>

              <button
                className="btn btn-default"
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={(currentPage + 1) * resultsPerPage >= results.length}
              >
                Next →
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "15px" }}>
              <button className="btn btn-secondary" onClick={() => setResults(null)}>
                Run Again
              </button>
              {results.some(r => r.comparison.diff.length > 0) && (
                <button
                  className="btn btn-primary"
                  onClick={applyAllChanges}
                  disabled={applying}
                  style={{ backgroundColor: "var(--success)", borderColor: "var(--success)" }}
                >
                  {applying ? "Applying..." : `Make Changes (${results.filter(r => r.comparison.diff.length > 0).length})`}
                </button>
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            💡 <strong>How it works:</strong> This syncs properties by fetching real data from their source URLs, extracting key fields, and comparing them with current data. You can review changes before applying.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button className="btn btn-default" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--overlay);
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
          box-shadow: 0 4px 16px rgba(15,23,42,.16);
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
          color: var(--text-muted);
          padding: 0;
          font-size: 1.2rem;
        }

        .btn-text:hover {
          color: var(--text-strong);
        }

        .btn-primary {
          background-color: var(--info);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: var(--info-text);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-default,
        .btn-secondary {
          background-color: var(--surface-2);
          color: var(--text);
          border: 1px solid var(--border);
        }

        .btn-default:hover,
        .btn-secondary:hover {
          background-color: var(--surface-3);
        }
      `}</style>
    </div>
  );
}
