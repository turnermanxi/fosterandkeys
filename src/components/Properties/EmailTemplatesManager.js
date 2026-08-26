"use client";

import { useState, useEffect } from "react";

export default function EmailTemplatesManager() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    body: "",
    is_default: false,
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const res = await fetch("/api/email-templates");
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleFormChange(e) {
    const { name, type, checked, value } = e.target;
    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      const url = editingId
        ? `/api/email-templates/${editingId}`
        : "/api/email-templates";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        fetchTemplates();
        resetForm();
        setShowAddModal(false);
        setEditingId(null);
      } else {
        alert("Failed to save template");
      }
    } catch (err) {
      console.error("Failed to save template:", err);
      alert("Failed to save template");
    }
  }

  function resetForm() {
    setForm({
      name: "",
      subject: "",
      body: "",
      is_default: false,
    });
  }

  function handleEdit(template) {
    setForm(template);
    setEditingId(template.id);
    setShowAddModal(true);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this template?")) return;

    try {
      const res = await fetch(`/api/email-templates/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchTemplates();
      } else {
        alert("Failed to delete template");
      }
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  }

  return (
    <div>
      <div className="flex-between mb-4">
        <h2 style={{ fontSize: "1.2rem" }}>Email Templates</h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            resetForm();
            setEditingId(null);
            setShowAddModal(true);
          }}
        >
          + New Template
        </button>
      </div>

      {loading ? (
        <p>Loading templates...</p>
      ) : templates.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No templates yet. Create one to get started.</p>
      ) : (
        <div className="card">
          {templates.map((template) => (
            <div
              key={template.id}
              style={{
                padding: 16,
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h4
                  style={{
                    margin: "0 0 4px",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                  }}
                >
                  {template.name}
                  {template.is_default && (
                    <span
                      style={{
                        marginLeft: 8,
                        padding: "2px 8px",
                        background: "#dbeafe",
                        color: "#1e40af",
                        borderRadius: 12,
                        fontSize: "0.75rem",
                      }}
                    >
                      Default
                    </span>
                  )}
                </h4>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b7280" }}>
                  {template.subject}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => handleEdit(template)}
                  style={{
                    padding: "6px 12px",
                    background: "#3b82f6",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  style={{
                    padding: "6px 12px",
                    background: "#ef4444",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              padding: 32,
              maxWidth: 700,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 24px", fontSize: "1.3rem" }}>
              {editingId ? "Edit Template" : "New Template"}
            </h2>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: 4 }}>
                  Template Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="e.g., Client Match Report"
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 4,
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: 4 }}>
                  Email Subject *
                </label>
                <input
                  type="text"
                  name="subject"
                  value={form.subject}
                  onChange={handleFormChange}
                  placeholder="e.g., Great Properties for You!"
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 4,
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: 4 }}>
                  HTML Body *
                </label>
                <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: "0 0 8px" }}>
                  Use {{`{{lead.full_name}}`}}, {{`{{lead.desired_location}}`}}, {{`{{agent.name}}`}}, and {{`{{properties_list}}`}} as placeholders
                </p>
                <textarea
                  name="body"
                  value={form.body}
                  onChange={handleFormChange}
                  placeholder="Enter HTML template..."
                  rows={12}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 4,
                    fontFamily: "monospace",
                    fontSize: "0.85rem",
                    resize: "vertical",
                  }}
                />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  name="is_default"
                  checked={form.is_default}
                  onChange={handleFormChange}
                />
                <span style={{ fontSize: "0.9rem" }}>Set as default template</span>
              </label>

              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    background: "#e5e7eb",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    background: "#3b82f6",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  {editingId ? "Save Changes" : "Create Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
