import { useState, useEffect } from "react";
import { generateSqftRange } from "@/lib/propertyFormatters";

export default function PropertiesSelector({ leadId, onSelectionChange }) {
  const [properties, setProperties] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadProperties();
  }, [leadId]);

  async function loadProperties() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/properties`);
      if (!res.ok) throw new Error("Failed to load properties");

      const data = await res.json();
      setProperties(data.properties || []);
      setSelectedIds(
        new Set(
          (data.properties || [])
            .filter((p) => p.isSelected)
            .map((p) => p.id)
        )
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/properties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyIds: Array.from(selectedIds) }),
      });

      if (!res.ok) throw new Error("Failed to save selections");

      const data = await res.json();
      onSelectionChange?.(data.selectedCount);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleProperty(propertyId) {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(propertyId)) {
      newSelected.delete(propertyId);
    } else {
      newSelected.add(propertyId);
    }
    setSelectedIds(newSelected);
  }

  const filteredProperties = properties.filter(
    (p) =>
      (p.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.property_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.city?.toLowerCase().includes(searchTerm.toLowerCase())) &&
      p.id // ensure valid property
  );

  if (loading) {
    return (
      <div style={{ padding: "16px", textAlign: "center", color: "#666" }}>
        Loading properties...
      </div>
    );
  }

  return (
    <div style={{ marginTop: "16px" }}>
      {properties.length === 0 ? (
        <div
          style={{
            padding: "16px",
            backgroundColor: "#fef3c7",
            border: "1px solid #fcd34d",
            borderRadius: "6px",
            color: "#92400e",
            fontSize: "0.9rem",
          }}
        >
          No properties available yet. Add properties in the Properties tab first.
        </div>
      ) : (
        <>
          {/* Search bar */}
          <div style={{ marginBottom: "12px" }}>
            <input
              type="text"
              placeholder="Search properties..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "0.9rem",
              }}
            />
          </div>

          {/* Properties list */}
          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              backgroundColor: "#f9fafb",
            }}
          >
            {filteredProperties.length === 0 ? (
              <div style={{ padding: "12px", color: "#666", textAlign: "center" }}>
                No properties match your search
              </div>
            ) : (
              filteredProperties.map((prop) => (
                <label
                  key={prop.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "12px",
                    borderBottom: "1px solid #e5e7eb",
                    cursor: "pointer",
                    backgroundColor: selectedIds.has(prop.id)
                      ? "#eff6ff"
                      : "#fff",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedIds.has(prop.id)) {
                      e.currentTarget.style.backgroundColor = "#f3f4f6";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedIds.has(prop.id)) {
                      e.currentTarget.style.backgroundColor = "#fff";
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(prop.id)}
                    onChange={() => toggleProperty(prop.id)}
                    style={{
                      marginRight: "12px",
                      cursor: "pointer",
                      accentColor: "#2563eb",
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "600", fontSize: "0.95rem" }}>
                      {prop.property_name || prop.address}
                    </div>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "#666",
                        marginTop: "2px",
                      }}
                    >
                      {prop.address}, {prop.city}, {prop.state} {prop.zip}
                    </div>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "#666",
                        marginTop: "4px",
                      }}
                    >
                      {prop.price_min && prop.price_max && (
                        <>
                          ${prop.price_min.toLocaleString()} – $
                          {prop.price_max.toLocaleString()} •{" "}
                        </>
                      )}
                      {prop.bedrooms && `${prop.bedrooms} bed `}
                      {prop.bathrooms && `${prop.bathrooms} bath`}
                      {prop.contact_phone && (
                        <>
                          {" "}
                          • {prop.contact_phone}
                        </>
                      )}
                    </div>
                  </div>
                  {prop.is_favorite && (
                    <span style={{ marginLeft: "8px", fontSize: "1rem" }}>
                      ⭐
                    </span>
                  )}
                </label>
              ))
            )}
          </div>

          {/* Selection summary and save button */}
          <div
            style={{
              marginTop: "12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px",
              backgroundColor: "#f0f9ff",
              border: "1px solid #bfdbfe",
              borderRadius: "4px",
            }}
          >
            <div style={{ fontSize: "0.9rem", color: "#1e40af" }}>
              <strong>{selectedIds.size}</strong> of{" "}
              <strong>{properties.length}</strong> properties selected
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "6px 16px",
                backgroundColor: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                fontSize: "0.9rem",
                fontWeight: "500",
              }}
            >
              {saving ? "Saving..." : "Save Selection"}
            </button>
          </div>

          {error && (
            <div
              style={{
                marginTop: "8px",
                padding: "8px 12px",
                backgroundColor: "#fee2e2",
                color: "#991b1b",
                borderRadius: "4px",
                fontSize: "0.85rem",
              }}
            >
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
