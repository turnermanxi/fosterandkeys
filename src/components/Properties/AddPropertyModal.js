"use client";

import { useState } from "react";
import DuplicateWarning from "./DuplicateWarning";

export default function AddPropertyModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    property_name: "",
    address: "",
    city: "",
    state: "TX",
    zip: "",
    price_min: "",
    price_max: "",
    bedrooms_min: "",
    bedrooms_max: "",
    bathrooms: "",
    sqft_min: "",
    sqft_max: "",
    studio_price_min: "",
    studio_price_max: "",
    bedroom_1_price_min: "",
    bedroom_1_price_max: "",
    bedroom_2_price_min: "",
    bedroom_2_price_max: "",
    bedroom_3_price_min: "",
    bedroom_3_price_max: "",
    property_type: "apartment",
    pet_friendly: false,
    accepts_evictions: false,
    accepts_broken_leases: false,
    accepts_low_credit: false,
    accepts_itin: false,
    accepts_second_chance: false,
    admin_fee: "",
    app_fee: "",
    deposit_info: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    website: "",
    notes: "",
  });

  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [forceSave, setForceSave] = useState(false);

  function handleInputChange(e) {
    const { name, type, checked, value } = e.target;
    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  }

  async function checkDuplicates() {
    if (!form.address || !form.city) return;

    try {
      const params = new URLSearchParams({
        address: form.address,
        city: form.city,
        zip: form.zip,
        property_name: form.property_name,
        price_min: form.price_min,
        price_max: form.price_max,
      });

      const res = await fetch(`/api/properties/check-duplicates?${params}`);
      const data = await res.json();
      return data.duplicates || [];
    } catch (err) {
      console.error("Failed to check duplicates:", err);
      return [];
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    // Check for duplicates first
    const foundDuplicates = await checkDuplicates();
    if (foundDuplicates.length > 0) {
      setDuplicates(foundDuplicates);
      setShowDuplicateWarning(true);
      setLoading(false);
      return;
    }

    // Proceed with saving
    await saveProperty();
  }

  async function saveProperty(shouldForceSave = false) {
    try {
      const payload = {
        ...form,
        price_min: form.price_min ? parseFloat(form.price_min) : null,
        price_max: form.price_max ? parseFloat(form.price_max) : null,
        bedrooms_min: form.bedrooms_min ? parseInt(form.bedrooms_min) : null,
        bedrooms_max: form.bedrooms_max ? parseInt(form.bedrooms_max) : null,
        bathrooms: form.bathrooms ? parseFloat(form.bathrooms) : null,
        sqft_min: form.sqft_min ? parseInt(form.sqft_min) : null,
        sqft_max: form.sqft_max ? parseInt(form.sqft_max) : null,
        studio_price_min: form.studio_price_min ? parseFloat(form.studio_price_min) : null,
        studio_price_max: form.studio_price_max ? parseFloat(form.studio_price_max) : null,
        bedroom_1_price_min: form.bedroom_1_price_min ? parseFloat(form.bedroom_1_price_min) : null,
        bedroom_1_price_max: form.bedroom_1_price_max ? parseFloat(form.bedroom_1_price_max) : null,
        bedroom_2_price_min: form.bedroom_2_price_min ? parseFloat(form.bedroom_2_price_min) : null,
        bedroom_2_price_max: form.bedroom_2_price_max ? parseFloat(form.bedroom_2_price_max) : null,
        bedroom_3_price_min: form.bedroom_3_price_min ? parseFloat(form.bedroom_3_price_min) : null,
        bedroom_3_price_max: form.bedroom_3_price_max ? parseFloat(form.bedroom_3_price_max) : null,
        admin_fee: form.admin_fee ? parseFloat(form.admin_fee) : null,
        app_fee: form.app_fee ? parseFloat(form.app_fee) : null,
        force_save: shouldForceSave || forceSave, // Include the force_save flag
      };

      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409 && !shouldForceSave && !forceSave) {
        // Duplicates found and we're not forcing save
        const data = await res.json();
        setDuplicates(data.duplicates_found || []);
        setShowDuplicateWarning(true);
        setLoading(false);
      } else if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        alert("Error: " + (err.error || "Unknown error"));
        setLoading(false);
      }
    } catch (err) {
      console.error("Failed to save property:", err);
      alert("Failed to save property");
      setLoading(false);
    }
  }

  if (showDuplicateWarning) {
    return (
      <DuplicateWarning
        duplicates={duplicates}
        onDismiss={() => {
          setShowDuplicateWarning(false);
          setForceSave(false);
          setLoading(false);
        }}
        onProceed={() => {
          setShowDuplicateWarning(false);
          setLoading(true);
          saveProperty(true); // Pass true to force save
        }}
      />
    );
  }

  return (
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
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          padding: 32,
          maxWidth: 600,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 25px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 24px", fontSize: "1.3rem" }}>Add Property</h2>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Basic Info */}
          <div>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: 4 }}>
              Property Name (optional)
            </label>
            <input
              type="text"
              name="property_name"
              value={form.property_name}
              onChange={handleInputChange}
              placeholder="e.g., Park Avenue Lofts"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 4,
              }}
            />
          </div>

          {/* Address */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: 4 }}>
                Address *
              </label>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={handleInputChange}
                placeholder="Street address"
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
                City *
              </label>
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleInputChange}
                placeholder="City"
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 4,
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: 4 }}>
                State
              </label>
              <input
                type="text"
                name="state"
                value={form.state}
                onChange={handleInputChange}
                maxLength={2}
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
                Zip
              </label>
              <input
                type="text"
                name="zip"
                value={form.zip}
                onChange={handleInputChange}
                placeholder="Zip code"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 4,
                }}
              />
            </div>
          </div>

          {/* Pricing */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: 4 }}>
                Price Min
              </label>
              <input
                type="number"
                name="price_min"
                value={form.price_min}
                onChange={handleInputChange}
                placeholder="Min price"
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
                Price Max
              </label>
              <input
                type="number"
                name="price_max"
                value={form.price_max}
                onChange={handleInputChange}
                placeholder="Max price"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 4,
                }}
              />
            </div>
          </div>

          {/* Unit Details */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: 4 }}>
                Bedrooms Min
              </label>
              <input
                type="number"
                name="bedrooms_min"
                value={form.bedrooms_min}
                onChange={handleInputChange}
                placeholder="e.g., 0 for Studio"
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
                Bedrooms Max
              </label>
              <input
                type="number"
                name="bedrooms_max"
                value={form.bedrooms_max}
                onChange={handleInputChange}
                placeholder="e.g., 3"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 4,
                }}
              />
            </div>
          </div>

          {/* Bathrooms */}
          <div>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: 4 }}>
              Bathrooms
            </label>
            <input
              type="number"
              name="bathrooms"
              value={form.bathrooms}
              onChange={handleInputChange}
              step="0.5"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 4,
              }}
            />
          </div>

          {/* Square Footage Range */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: 4 }}>
                Sqft Min
              </label>
              <input
                type="number"
                name="sqft_min"
                value={form.sqft_min}
                onChange={handleInputChange}
                placeholder="Minimum sqft"
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
                Sqft Max
              </label>
              <input
                type="number"
                name="sqft_max"
                value={form.sqft_max}
                onChange={handleInputChange}
                placeholder="Maximum sqft"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 4,
                }}
              />
            </div>
          </div>

          {/* Per-Bedroom Pricing */}
          <div style={{ background: "#f0f9ff", padding: 12, borderRadius: 4 }}>
            <h4 style={{ margin: "0 0 12px", fontSize: "0.95rem" }}>Price by Bedroom Type (Optional)</h4>
            
            {/* Studio */}
            <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #e5e7eb" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 6 }}>Studio</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input
                  type="number"
                  name="studio_price_min"
                  value={form.studio_price_min}
                  onChange={handleInputChange}
                  placeholder="Min"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 4,
                    fontSize: "0.9rem",
                  }}
                />
                <input
                  type="number"
                  name="studio_price_max"
                  value={form.studio_price_max}
                  onChange={handleInputChange}
                  placeholder="Max"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 4,
                    fontSize: "0.9rem",
                  }}
                />
              </div>
            </div>

            {/* 1 Bedroom */}
            <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #e5e7eb" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 6 }}>1 Bedroom</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input
                  type="number"
                  name="bedroom_1_price_min"
                  value={form.bedroom_1_price_min}
                  onChange={handleInputChange}
                  placeholder="Min"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 4,
                    fontSize: "0.9rem",
                  }}
                />
                <input
                  type="number"
                  name="bedroom_1_price_max"
                  value={form.bedroom_1_price_max}
                  onChange={handleInputChange}
                  placeholder="Max"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 4,
                    fontSize: "0.9rem",
                  }}
                />
              </div>
            </div>

            {/* 2 Bedroom */}
            <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #e5e7eb" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 6 }}>2 Bedrooms</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input
                  type="number"
                  name="bedroom_2_price_min"
                  value={form.bedroom_2_price_min}
                  onChange={handleInputChange}
                  placeholder="Min"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 4,
                    fontSize: "0.9rem",
                  }}
                />
                <input
                  type="number"
                  name="bedroom_2_price_max"
                  value={form.bedroom_2_price_max}
                  onChange={handleInputChange}
                  placeholder="Max"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 4,
                    fontSize: "0.9rem",
                  }}
                />
              </div>
            </div>

            {/* 3 Bedroom */}
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 6 }}>3 Bedrooms</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input
                  type="number"
                  name="bedroom_3_price_min"
                  value={form.bedroom_3_price_min}
                  onChange={handleInputChange}
                  placeholder="Min"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 4,
                    fontSize: "0.9rem",
                  }}
                />
                <input
                  type="number"
                  name="bedroom_3_price_max"
                  value={form.bedroom_3_price_max}
                  onChange={handleInputChange}
                  placeholder="Max"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 4,
                    fontSize: "0.9rem",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Property Type */}
          <div>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: 4 }}>
              Property Type
            </label>
            <select
              name="property_type"
              value={form.property_type}
              onChange={handleInputChange}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 4,
              }}
            >
              <option value="apartment">Apartment</option>
              <option value="house">House</option>
              <option value="townhouse">Townhouse</option>
              <option value="condo">Condo</option>
              <option value="studio">Studio</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Fees Section */}
          <div style={{ background: "#f9f9f9", padding: 12, borderRadius: 4 }}>
            <h4 style={{ margin: "0 0 12px", fontSize: "0.95rem" }}>Fees & Deposit</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: 4 }}>
                  Admin Fee
                </label>
                <input
                  type="number"
                  name="admin_fee"
                  value={form.admin_fee}
                  onChange={handleInputChange}
                  placeholder="Admin fee"
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
                  Application Fee
                </label>
                <input
                  type="number"
                  name="app_fee"
                  value={form.app_fee}
                  onChange={handleInputChange}
                  placeholder="App fee"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: 4 }}>
                Deposit Info
              </label>
              <input
                type="text"
                name="deposit_info"
                value={form.deposit_info}
                onChange={handleInputChange}
                placeholder="e.g., 1 month deposit"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 4,
                }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: 4 }}>
              Contact Name
            </label>
            <input
              type="text"
              name="contact_name"
              value={form.contact_name}
              onChange={handleInputChange}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 4,
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: 4 }}>
                Contact Phone
              </label>
              <input
                type="tel"
                name="contact_phone"
                value={form.contact_phone}
                onChange={handleInputChange}
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
                Contact Email
              </label>
              <input
                type="email"
                name="contact_email"
                value={form.contact_email}
                onChange={handleInputChange}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 4,
                }}
              />
            </div>
          </div>

          {/* Website */}
          <div>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: 4 }}>
              Property Website
            </label>
            <input
              type="url"
              name="website"
              value={form.website}
              onChange={handleInputChange}
              placeholder="https://example.com"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 4,
              }}
            />
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: 4 }}>
              Notes
            </label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleInputChange}
              placeholder="Any additional notes about this property..."
              rows="4"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Checkboxes for acceptance criteria */}
          <div style={{ background: "#f9f9f9", padding: 12, borderRadius: 4 }}>
            <h4 style={{ margin: "0 0 12px", fontSize: "0.95rem" }}>Acceptance Criteria</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                ["pet_friendly", "Pet Friendly"],
                ["accepts_evictions", "Accepts Evictions"],
                ["accepts_broken_leases", "Broken Leases"],
                ["accepts_low_credit", "Low Credit"],
                ["accepts_itin", "ITIN"],
                ["accepts_second_chance", "Second Chance"],
              ].map(([key, label]) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    name={key}
                    checked={form[key]}
                    onChange={handleInputChange}
                  />
                  <span style={{ fontSize: "0.85rem" }}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button
              type="button"
              onClick={onClose}
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
              type="submit"
              disabled={loading || !form.address || !form.city}
              style={{
                flex: 1,
                padding: "10px 16px",
                background: form.address && form.city ? "#3b82f6" : "#d1d5db",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: form.address && form.city ? "pointer" : "default",
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              {loading ? "Saving..." : "Save Property"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
