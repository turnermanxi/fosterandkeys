"use client";

import { useState, useEffect } from "react";
import PropertiesFilter from "./PropertiesFilter";
import PropertiesTable from "./PropertiesTable";
import PropertyDetailPanel from "./PropertyDetailPanel";
import AddPropertyModal from "./AddPropertyModal";
import CSVImportModal from "./CSVImportModal";
import PropertySyncModal from "./PropertySyncModal";

export default function PropertiesTab() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCSVImportModal, setShowCSVImportModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    source: "all",
    favorite: false,
    archived: false,
    bedrooms: "",
  });
  const [isInitialized, setIsInitialized] = useState(false);

  // Ensure filters are reset on component mount
  useEffect(() => {
    if (!isInitialized) {
      setFilters({
        search: "",
        source: "all",
        favorite: false,
        archived: false,
        bedrooms: "",
      });
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (isInitialized) {
      fetchProperties();
    }
  }, [filters, isInitialized]);

  async function fetchProperties() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append("search", filters.search);
      if (filters.source !== "all") params.append("source", filters.source);
      if (filters.favorite) params.append("favorite", "true");
      // Always filter archived status - default to showing non-archived properties only
      params.append("archived", filters.archived ? "true" : "false");
      if (filters.bedrooms) params.append("bedrooms", filters.bedrooms);

      const res = await fetch(`/api/properties?${params.toString()}`);
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const errorData = await res.json();
        console.error("API error:", errorData);
        throw new Error(errorData.error || "Failed to load properties");
      }
      const data = await res.json();
      console.log("Loaded properties:", data);
      setProperties(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error("Failed to load properties:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddProperty(newProperty) {
    // Modal will call the add and trigger refresh
    setShowAddModal(false);
    fetchProperties();
  }

  async function handleDeleteProperty(propertyId) {
    if (!confirm("Archive this property?")) return;
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchProperties();
        setSelectedProperty(null);
      } else {
        alert("Failed to archive property");
      }
    } catch (err) {
      console.error("Failed to delete property:", err);
    }
  }

  return (
    <div className="properties-container">
      <div className="flex-between mb-4">
        <h2 style={{ fontSize: "1.2rem" }}>Properties</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="btn btn-default btn-sm"
            onClick={() => setShowCSVImportModal(true)}
          >
            📁 Import CSV
          </button>
          <button
            className="btn btn-default btn-sm"
            onClick={() => setShowSyncModal(true)}
          >
            🔄 Sync Properties
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddModal(true)}
          >
            + Add Property
          </button>
        </div>
      </div>

      <PropertiesFilter filters={filters} onFilterChange={setFilters} />

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 32 }}>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: 16, marginBottom: 16, width: `${80 - i * 8}%` }}
              />
            ))}
          </div>
        ) : properties.length === 0 ? (
          <div
            style={{ padding: 48, textAlign: "center" }}
            className="text-muted"
          >
            No properties yet. Add one to get started!
          </div>
        ) : (
          <PropertiesTable properties={properties} onSelect={setSelectedProperty} />
        )}
      </div>

      {selectedProperty && (
        <PropertyDetailPanel
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          onRefresh={fetchProperties}
          onDelete={handleDeleteProperty}
        />
      )}

      {showAddModal && (
        <AddPropertyModal
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddProperty}
        />
      )}

      {showCSVImportModal && (
        <CSVImportModal
          isOpen={showCSVImportModal}
          onClose={() => setShowCSVImportModal(false)}
          onImportSuccess={fetchProperties}
        />
      )}

      {showSyncModal && (
        <PropertySyncModal
          isOpen={showSyncModal}
          onClose={() => setShowSyncModal(false)}
          properties={properties}
        />
      )}
    </div>
  );
}
