"use client";

import { useState } from "react";

export default function EditPropertyModal({ property, onClose, onSuccess }) {
  const [form, setForm] = useState({
    property_name: property.property_name || "",
    address: property.address || "",
    city: property.city || "",
    state: property.state || "TX",
    zip: property.zip || "",
    price_min: property.price_min ? String(property.price_min) : "",
    price_max: property.price_max ? String(property.price_max) : "",
    bedrooms_min: property.bedrooms_min ? String(property.bedrooms_min) : "",
    bedrooms_max: property.bedrooms_max ? String(property.bedrooms_max) : "",
    bathrooms: property.bathrooms ? String(property.bathrooms) : "",
    sqft_min: property.sqft_min ? String(property.sqft_min) : "",
    sqft_max: property.sqft_max ? String(property.sqft_max) : "",
    studio_price_min: property.studio_price_min ? String(property.studio_price_min) : "",
    studio_price_max: property.studio_price_max ? String(property.studio_price_max) : "",
    bedroom_1_price_min: property.bedroom_1_price_min ? String(property.bedroom_1_price_min) : "",
    bedroom_1_price_max: property.bedroom_1_price_max ? String(property.bedroom_1_price_max) : "",
    bedroom_2_price_min: property.bedroom_2_price_min ? String(property.bedroom_2_price_min) : "",
    bedroom_2_price_max: property.bedroom_2_price_max ? String(property.bedroom_2_price_max) : "",
    bedroom_3_price_min: property.bedroom_3_price_min ? String(property.bedroom_3_price_min) : "",
    bedroom_3_price_max: property.bedroom_3_price_max ? String(property.bedroom_3_price_max) : "",
    property_type: property.property_type || "apartment",
    pet_friendly: property.pet_friendly || false,
    accepts_evictions: property.accepts_evictions || false,
    accepts_broken_leases: property.accepts_broken_leases || false,
    accepts_low_credit: property.accepts_low_credit || false,
    accepts_itin: property.accepts_itin || false,
    accepts_second_chance: property.accepts_second_chance || false,
    admin_fee: property.admin_fee ? String(property.admin_fee) : "",
    app_fee: property.app_fee ? String(property.app_fee) : "",
    deposit_info: property.deposit_info || "",
    contact_name: property.contact_name || "",
    contact_phone: property.contact_phone || "",
    contact_email: property.contact_email || "",
    website: property.website || "",
    notes: property.notes || "",
    specials: property.specials || "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function handleInputChange(e) {
    const { name, type, checked, value } = e.target;
    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

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
      };

      const res = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to update property");
      }
    } catch (err) {
      console.error("Failed to update property:", err);
      setError("Failed to update property");
    } finally {
      setLoading(false);
    }
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
        <h2 style={{ margin: "0 0 24px", fontSize: "1.3rem" }}>Edit Property</h2>

        {error && (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              padding: 12,
              borderRadius: 4,
              marginBottom: 16,
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

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

          {/* Contact Info */}
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

          {/* Notes */}
          <div>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: 4 }}>
              📝 Notes
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

          {/* Specials */}
          <div>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: 4 }}>
              🎉 Specials/Promotions
            </label>
            <textarea
              name="specials"
              value={form.specials}
              onChange={handleInputChange}
              placeholder="Current specials, move-in offers, promotions..."
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
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
