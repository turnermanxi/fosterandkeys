"use client";

import { useState, useEffect } from "react";
import LeadTable from "@/components/LeadTable";
import LeadDetail from "@/components/LeadDetail";
import PropertiesTab from "@/components/Properties/PropertiesTab";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("leads");
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);

  useEffect(() => {
    if (activeTab === "leads") {
      fetchLeads();
    }
  }, [activeTab]);

  async function fetchLeads() {
    setLoading(true);
    try {
      const res = await fetch("/api/leads");
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load leads:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/login";
  }

  async function handleCheckEmail() {
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await fetch("/api/cron/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.error) {
        setCheckResult({ type: "error", message: data.error });
      } else {
        setCheckResult({ type: "success", message: data.message });
        fetchLeads();
      }
    } catch (err) {
      setCheckResult({ type: "error", message: err.message });
    } finally {
      setChecking(false);
      setTimeout(() => setCheckResult(null), 6000);
    }
  }

  async function handleSend(leadId, editedSummary) {
    try {
      const res = await fetch(`/api/leads/${leadId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai_summary: editedSummary }),
      });
      const data = await res.json();
      if (data.success) {
        // Copy the results URL to clipboard
        try {
          await navigator.clipboard.writeText(data.results_url);
        } catch {
          // clipboard may not be available
        }
        alert(`Email sent and results link copied!\n\n${data.results_url}`);
        fetchLeads(); // refresh status
        setSelectedLead(null);
      } else {
        alert("Error: " + (data.error ?? "Unknown"));
      }
    } catch (err) {
      alert("Failed to send: " + err.message);
    }
  }

  return (
    <div className="page-wrapper">
      <div className="flex-between mb-2">
        <h1 style={{ fontSize: "1.4rem" }}>
          {activeTab === "leads" ? "Leads" : "Properties"} Dashboard
        </h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {activeTab === "leads" && (
            <>
              <button
                className="btn btn-sm"
                style={{ background: "#059669", color: "#fff" }}
                onClick={handleCheckEmail}
                disabled={checking}
              >
                {checking ? "Checking…" : "📬 Check Gmail"}
              </button>
              <button className="btn btn-primary btn-sm" onClick={fetchLeads}>
                ↻ Refresh
              </button>
            </>
          )}
          <button
            className="btn btn-sm"
            style={{ background: "#ef4444", color: "#fff" }}
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 24,
          borderBottom: "2px solid #e5e7eb",
        }}
      >
        <button
          onClick={() => setActiveTab("leads")}
          style={{
            padding: "12px 16px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "leads" ? "3px solid #3b82f6" : "none",
            color: activeTab === "leads" ? "#3b82f6" : "#6b7280",
            cursor: "pointer",
            fontSize: "0.95rem",
            fontWeight: activeTab === "leads" ? 600 : 400,
          }}
        >
          Leads
        </button>
        <button
          onClick={() => setActiveTab("properties")}
          style={{
            padding: "12px 16px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "properties" ? "3px solid #3b82f6" : "none",
            color: activeTab === "properties" ? "#3b82f6" : "#6b7280",
            cursor: "pointer",
            fontSize: "0.95rem",
            fontWeight: activeTab === "properties" ? 600 : 400,
          }}
        >
          Properties
        </button>
      </div>

      {/* Leads Tab */}
      {activeTab === "leads" && (
        <>
          {checkResult && (
            <div
              style={{
                padding: "10px 16px",
                marginBottom: 12,
                borderRadius: 8,
                fontSize: "0.9rem",
                background: checkResult.type === "success" ? "#d1fae5" : "#fee2e2",
                color: checkResult.type === "success" ? "#065f46" : "#991b1b",
              }}
            >
              {checkResult.message}
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: 32 }}>
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="skeleton"
                    style={{ height: 20, marginBottom: 16, width: `${80 - i * 8}%` }}
                  />
                ))}
              </div>
            ) : leads.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center" }} className="text-muted">
                No leads yet. Click "Check Gmail" to pull new leads, or submit one via the WPForm webhook.
              </div>
            ) : (
              <LeadTable leads={leads} onSelect={setSelectedLead} />
            )}
          </div>

          {selectedLead && (
            <LeadDetail
              lead={selectedLead}
              onClose={() => setSelectedLead(null)}
              onSend={handleSend}
            />
          )}
        </>
      )}

      {/* Properties Tab */}
      {activeTab === "properties" && <PropertiesTab />}
    </div>
  );
}
