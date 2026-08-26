"use client";

import { useState } from "react";

/**
 * AutoSyncSettings
 * Configure automatic property syncing
 * Allows scheduling and triggering manual syncs
 */
export default function AutoSyncSettings({ accountId }) {
  const [syncFrequency, setSyncFrequency] = useState("daily");
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [message, setMessage] = useState(null);

  async function handleManualSync() {
    setSyncing(true);
    setMessage(null);

    try {
      const res = await fetch(
        `/api/properties/auto-sync?accountId=${accountId}`
      );
      const data = await res.json();

      if (res.ok) {
        setLastSync(new Date().toLocaleString());
        setMessage({
          type: "success",
          text: `✅ Synced ${data.processed} properties. Updated: ${data.updated}, Needs Review: ${data.reviewed}`,
        });
      } else {
        setMessage({
          type: "error",
          text: data.error || "Sync failed",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message,
      });
    }

    setSyncing(false);
  }

  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "20px",
        marginBottom: "20px",
      }}
    >
      <h3 style={{ margin: "0 0 16px 0", fontSize: "1.1rem" }}>
        🤖 Automatic Property Sync
      </h3>

      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", fontWeight: 500 }}>
          Sync Frequency
        </label>
        <select
          value={syncFrequency}
          onChange={(e) => setSyncFrequency(e.target.value)}
          style={{
            padding: "8px",
            border: "1px solid #ddd",
            borderRadius: "4px",
            fontSize: "0.9rem",
          }}
        >
          <option value="manual">Manual Only</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
        <p style={{ fontSize: "0.8rem", color: "#666", margin: "4px 0 0 0" }}>
          💡 Properties will automatically sync from their source URLs at this frequency
        </p>
      </div>

      {message && (
        <div
          style={{
            padding: "12px",
            borderRadius: "4px",
            marginBottom: "16px",
            backgroundColor: message.type === "error" ? "#fee" : "#efe",
            border: `1px solid ${message.type === "error" ? "#fcc" : "#cfc"}`,
            color: message.type === "error" ? "#c33" : "#363",
            fontSize: "0.9rem",
          }}
        >
          {message.text}
        </div>
      )}

      {lastSync && (
        <p style={{ fontSize: "0.85rem", color: "#666", margin: "0 0 16px 0" }}>
          Last synced: {lastSync}
        </p>
      )}

      <button
        onClick={handleManualSync}
        disabled={syncing}
        style={{
          padding: "10px 16px",
          backgroundColor: "#10b981",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "0.9rem",
          fontWeight: 500,
          opacity: syncing ? 0.6 : 1,
        }}
      >
        {syncing ? "Syncing..." : "🚀 Sync Now"}
      </button>

      <p style={{ fontSize: "0.8rem", color: "#999", margin: "12px 0 0 0" }}>
        ⚡ Runs in background and automatically applies safe changes. Changes that need
        review are added to the review queue.
      </p>
    </div>
  );
}
