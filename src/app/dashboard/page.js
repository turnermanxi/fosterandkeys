"use client";

import { useState, useEffect, useMemo } from "react";
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
  const [leadSearch, setLeadSearch] = useState("");

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

  const filteredLeads = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    if (!q) return leads;

    return leads.filter((lead) => {
      const budget = [lead.budget_min, lead.budget_max]
        .filter((v) => v != null)
        .map((v) => `$${Number(v).toLocaleString()}`)
        .join(" ");
      const createdDate = lead.created_at
        ? new Date(lead.created_at).toLocaleDateString()
        : "";
      return [
        lead.full_name,
        lead.email,
        lead.phone,
        lead.desired_location,
        lead.current_status || lead.status,
        lead.status,
        budget,
        lead.top_score,
        createdDate,
      ]
        .filter((value) => value != null)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [leads, leadSearch]);

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
                className="btn btn-success btn-sm"
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
            className="btn btn-danger btn-sm"
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
          borderBottom: "2px solid var(--border)",
        }}
      >
        <button
          onClick={() => setActiveTab("leads")}
          style={{
            padding: "12px 16px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "leads" ? "3px solid var(--info)" : "none",
            color: activeTab === "leads" ? "var(--info)" : "var(--text-muted)",
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
            borderBottom: activeTab === "properties" ? "3px solid var(--info)" : "none",
            color: activeTab === "properties" ? "var(--info)" : "var(--text-muted)",
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
                background: checkResult.type === "success" ? "var(--success-bg)" : "var(--danger-bg)",
                color: checkResult.type === "success" ? "var(--success-text)" : "var(--danger-text)",
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
              <>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    borderBottom: "1px solid var(--border)",
                    background: "var(--surface-2)",
                  }}
                >
                  <div style={{ flex: 1, position: "relative" }}>
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--text-muted)",
                        fontSize: ".9rem",
                      }}
                    >
                      🔎
                    </span>
                    <input
                      type="search"
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      placeholder="Search leads by name, email, phone, location, status, budget..."
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 38px",
                        border: "1px solid var(--border-strong)",
                        borderRadius: 10,
                        background: "var(--surface)",
                        color: "var(--text)",
                        fontSize: ".92rem",
                        outline: "none",
                      }}
                    />
                  </div>
                  <div
                    className="text-muted"
                    style={{ fontSize: ".85rem", whiteSpace: "nowrap" }}
                  >
                    {filteredLeads.length} of {leads.length} leads
                  </div>
                </div>
                {filteredLeads.length === 0 ? (
                  <div style={{ padding: 48, textAlign: "center" }} className="text-muted">
                    No leads match your search.
                  </div>
                ) : (
                  <LeadTable leads={filteredLeads} onSelect={setSelectedLead} />
                )}
              </>
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
