"use client";

import { useState } from "react";

export default function TagUI({ propertyId, initialTags, onTagsChange }) {
  const [tags, setTags] = useState(initialTags || []);
  const [newTag, setNewTag] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  async function handleAddTag(e) {
    e.preventDefault();
    if (!newTag.trim()) return;

    try {
      const res = await fetch(`/api/properties/${propertyId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: newTag }),
      });
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags || []);
        onTagsChange(data.tags || []);
        setNewTag("");
      }
    } catch (err) {
      console.error("Failed to add tag:", err);
    }
  }

  async function handleRemoveTag(tag) {
    try {
      const res = await fetch(
        `/api/properties/${propertyId}/tags/${encodeURIComponent(tag)}`,
        {
          method: "DELETE",
        }
      );
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags || []);
        onTagsChange(data.tags || []);
      }
    } catch (err) {
      console.error("Failed to remove tag:", err);
    }
  }

  return (
    <div style={{ marginBottom: 24, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
      <h4 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 600 }}>
        Tags
      </h4>

      {tags.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                background: "#dbeafe",
                color: "#1e40af",
                padding: "4px 10px",
                borderRadius: 12,
                fontSize: "0.85rem",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#1e40af",
                  cursor: "pointer",
                  fontSize: "1rem",
                  padding: 0,
                  marginLeft: 4,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <form onSubmit={handleAddTag} style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          placeholder="Add tag (e.g., pet-friendly)"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          style={{
            flex: 1,
            padding: "6px 10px",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            fontSize: "0.85rem",
          }}
        />
        <button
          type="submit"
          disabled={!newTag.trim()}
          style={{
            padding: "6px 12px",
            background: newTag.trim() ? "#3b82f6" : "#d1d5db",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: newTag.trim() ? "pointer" : "default",
            fontSize: "0.85rem",
          }}
        >
          Add
        </button>
      </form>
    </div>
  );
}
