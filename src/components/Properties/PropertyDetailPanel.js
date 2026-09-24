"use client";

import { useState, useEffect } from "react";
import { generateSqftRange, generateBedroomRangeDisplay } from "@/lib/propertyFormatters";
import TagUI from "./TagUI";
import NoteUI from "./NoteUI";
import SendToLeadModal from "./SendToLeadModal";
import EditPropertyModal from "./EditPropertyModal";
import SinglePropertySyncModal from "./SinglePropertySyncModal";

export default function PropertyDetailPanel({
  property,
  onClose,
  onRefresh,
  onDelete,
}) {
  const [isFavorite, setIsFavorite] = useState(property.is_favorite);
  const [tags, setTags] = useState(property.property_tags?.map((t) => t.tag) || []);
  const [notes, setNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, [property.id]);

  async function fetchNotes() {
    setLoadingNotes(true);
    try {
      console.log("Fetching notes for property:", property.id);
      const res = await fetch(`/api/properties/${property.id}/notes`);
      if (!res.ok) {
        console.error("Notes API error:", res.status, res.statusText);
        setNotes([]);
        return;
      }
      const data = await res.json();
      console.log("Notes response:", data);
      setNotes(data.notes || []);
    } catch (err) {
      console.error("Failed to load notes:", err);
      setNotes([]);
    } finally {
      setLoadingNotes(false);
    }
  }

  async function toggleFavorite() {
    try {
      const res = await fetch(`/api/properties/${property.id}/favorite`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_favorite: !isFavorite }),
      });
      if (res.ok) {
        setIsFavorite(!isFavorite);
      }
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  }

  function formatPrice(min, max) {
    if (!min && !max) return "–";
    if (!max) return `$${Number(min || 0).toLocaleString()}`;
    if (!min) return `$${Number(max || 0).toLocaleString()}`;
    return `$${Number(min).toLocaleString()} – $${Number(max).toLocaleString()}`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        bottom: 0,
        width: 400,
        background: "var(--surface)",
        borderLeft: "1px solid var(--border)",
        boxShadow: "-4px 0 6px rgba(15,23,42,.12)",
        overflowY: "auto",
        zIndex: 100,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, marginBottom: 8 }}>
            {property.property_name || property.address}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: "0.9rem",
              color: "var(--text-muted)",
            }}
          >
            {property.address}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: "0.9rem", color: "var(--text-muted)" }}>
            {property.city}, {property.state} {property.zip}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: "1.5rem",
            cursor: "pointer",
            padding: 0,
            marginLeft: 12,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: "16px", maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
        {/* Price & Basics */}
        <div style={{ marginBottom: 24 }}>
          <p
            style={{
              fontSize: "1.4rem",
              fontWeight: 600,
              color: "var(--success-text)",
              margin: "0 0 8px",
            }}
          >
            {formatPrice(property.price_min, property.price_max)}
          </p>
          <p style={{ margin: "4px 0", fontSize: "0.9rem" }}>
            <strong>{generateBedroomRangeDisplay(property)}</strong> |{" "}
            <strong>{property.bathrooms || "–"} BA</strong> | {generateSqftRange(property)}
          </p>
          {property.property_type && (
            <p style={{ margin: "4px 0", fontSize: "0.9rem", color: "var(--text-muted)" }}>
              Type: {property.property_type}
            </p>
          )}
        </div>

        {/* Per-Bedroom Pricing Table */}
        {(property.studio_price_min || property.bedroom_1_price_min || property.bedroom_2_price_min || property.bedroom_3_price_min) && (
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 600 }}>
              Price by Bedroom Type
            </h4>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}>
              <tbody>
                {property.studio_price_min && (
                  <tr>
                    <td style={{ padding: "6px", borderBottom: "1px solid var(--border)" }}>Studio</td>
                    <td style={{ padding: "6px", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 500 }}>
                      {formatPrice(property.studio_price_min, property.studio_price_max)}
                    </td>
                  </tr>
                )}
                {property.bedroom_1_price_min && (
                  <tr>
                    <td style={{ padding: "6px", borderBottom: "1px solid var(--border)" }}>1 Bedroom</td>
                    <td style={{ padding: "6px", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 500 }}>
                      {formatPrice(property.bedroom_1_price_min, property.bedroom_1_price_max)}
                    </td>
                  </tr>
                )}
                {property.bedroom_2_price_min && (
                  <tr>
                    <td style={{ padding: "6px", borderBottom: "1px solid var(--border)" }}>2 Bedrooms</td>
                    <td style={{ padding: "6px", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 500 }}>
                      {formatPrice(property.bedroom_2_price_min, property.bedroom_2_price_max)}
                    </td>
                  </tr>
                )}
                {property.bedroom_3_price_min && (
                  <tr>
                    <td style={{ padding: "6px", borderBottom: "1px solid var(--border)" }}>3 Bedrooms</td>
                    <td style={{ padding: "6px", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 500 }}>
                      {formatPrice(property.bedroom_3_price_min, property.bedroom_3_price_max)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={toggleFavorite}
            style={{
              padding: "8px 12px",
              background: isFavorite ? "var(--warning)" : "var(--border)",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: isFavorite ? 600 : 400,
            }}
          >
            {isFavorite ? "★" : "☆"} Favorite
          </button>

          <button
            onClick={() => setShowSendModal(true)}
            style={{
              padding: "8px 12px",
              background: "var(--success)",
              color: "var(--on-solid)",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            📧 Send to Lead
          </button>

          <button
            onClick={() => setShowEditModal(true)}
            style={{
              padding: "8px 12px",
              background: "var(--info)",
              color: "var(--on-solid)",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            ✏️ Edit
          </button>

          <button
            onClick={() => setShowSyncModal(true)}
            style={{
              padding: "8px 12px",
              background: "var(--purple)",
              color: "var(--on-solid)",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            🔄 Sync
          </button>

          <button
            onClick={() => onDelete(property.id)}
            style={{
              padding: "8px 12px",
              background: "var(--danger)",
              color: "var(--on-solid)",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            🗑 Archive
          </button>
        </div>

        {/* Acceptance Criteria */}
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 600 }}>
            Acceptance Criteria
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {property.pet_friendly !== null && (
              <p style={{ margin: 0, fontSize: "0.85rem" }}>
                Pet Friendly: {property.pet_friendly ? "✓" : "✗"}
              </p>
            )}
            {property.accepts_evictions !== null && (
              <p style={{ margin: 0, fontSize: "0.85rem" }}>
                Accepts Evictions: {property.accepts_evictions ? "✓" : "✗"}
              </p>
            )}
            {property.accepts_broken_leases !== null && (
              <p style={{ margin: 0, fontSize: "0.85rem" }}>
                Broken Leases: {property.accepts_broken_leases ? "✓" : "✗"}
              </p>
            )}
            {property.accepts_low_credit !== null && (
              <p style={{ margin: 0, fontSize: "0.85rem" }}>
                Low Credit: {property.accepts_low_credit ? "✓" : "✗"}
              </p>
            )}
            {property.accepts_itin !== null && (
              <p style={{ margin: 0, fontSize: "0.85rem" }}>
                ITIN: {property.accepts_itin ? "✓" : "✗"}
              </p>
            )}
            {property.accepts_second_chance !== null && (
              <p style={{ margin: 0, fontSize: "0.85rem" }}>
                Second Chance: {property.accepts_second_chance ? "✓" : "✗"}
              </p>
            )}
          </div>
        </div>

        {/* Fees & Deposit */}
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 600 }}>
            Fees & Deposit
          </h4>
          {property.admin_fee && (
            <p style={{ margin: "4px 0", fontSize: "0.85rem" }}>
              Admin Fee: ${Number(property.admin_fee).toLocaleString()}
            </p>
          )}
          {property.app_fee && (
            <p style={{ margin: "4px 0", fontSize: "0.85rem" }}>
              Application Fee: ${Number(property.app_fee).toLocaleString()}
            </p>
          )}
          {property.deposit_info && (
            <p style={{ margin: "4px 0", fontSize: "0.85rem" }}>
              Deposit: {property.deposit_info}
            </p>
          )}
        </div>

        {/* Contact Info */}
        {(property.contact_name ||
          property.contact_phone ||
          property.contact_email) && (
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 600 }}>
              Contact
            </h4>
            {property.contact_name && (
              <p style={{ margin: "4px 0", fontSize: "0.85rem" }}>
                {property.contact_name}
              </p>
            )}
            {property.contact_phone && (
              <p style={{ margin: "4px 0", fontSize: "0.85rem" }}>
                {property.contact_phone}
              </p>
            )}
            {property.contact_email && (
              <p style={{ margin: "4px 0", fontSize: "0.85rem" }}>
                <a
                  href={`mailto:${property.contact_email}`}
                  style={{ color: "var(--info)", textDecoration: "none" }}
                >
                  {property.contact_email}
                </a>
              </p>
            )}
          </div>
        )}

        {property.website && (
          <div style={{ marginBottom: 24 }}>
            <a
              href={property.website}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--info)",
                textDecoration: "none",
                fontSize: "0.9rem",
              }}
            >
              View Website →
            </a>
          </div>
        )}

        {/* Specials (for apartments) */}
        {property.specials && (
          <div style={{ marginBottom: 24, padding: "12px", background: "var(--info-bg)", borderRadius: 6, border: "1px solid var(--info-border)" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: "0.95rem", fontWeight: 600, color: "var(--info-text)" }}>
              🎉 Current Specials
            </h4>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--info-text)", whiteSpace: "pre-wrap" }}>
              {property.specials}
            </p>
          </div>
        )}

        {/* Tags */}
        <TagUI propertyId={property.id} initialTags={tags} onTagsChange={setTags} />

        {/* Notes */}
        <div style={{ marginTop: 24 }}>
          <NoteUI
            propertyId={property.id}
            notes={notes}
            onNotesChange={setNotes}
            loading={loadingNotes}
          />
        </div>
      </div>

      {showSendModal && (
        <SendToLeadModal
          property={property}
          onClose={() => setShowSendModal(false)}
          onSuccess={() => {
            setShowSendModal(false);
            alert("Email sent successfully!");
          }}
        />
      )}

      {showEditModal && (
        <EditPropertyModal
          property={property}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            onRefresh();
          }}
        />
      )}

      {showSyncModal && (
        <SinglePropertySyncModal
          isOpen={showSyncModal}
          onClose={() => setShowSyncModal(false)}
          property={property}
        />
      )}
    </div>
  );
}
