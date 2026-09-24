"use client";

import { useState } from "react";

export default function NoteUI({ propertyId, notes, onNotesChange, loading }) {
  const [newNote, setNewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAddNote(e) {
    e.preventDefault();
    if (!newNote.trim()) return;

    setIsSubmitting(true);
    try {
      console.log("Adding note for property:", propertyId);
      const res = await fetch(`/api/properties/${propertyId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: newNote }),
      });
      console.log("Add note response status:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("Add note success, new notes:", data.notes);
        onNotesChange(data.notes || []);
        setNewNote("");
      } else {
        const errorData = await res.json();
        console.error("Add note failed:", res.status, errorData);
      }
    } catch (err) {
      console.error("Failed to add note:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const today = new Date();
    const isToday =
      date.toDateString() === today.toDateString();

    if (isToday) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  return (
    <div style={{ paddingTop: 16, borderTop: "1px solid var(--border)" }}>
      <h4 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 600 }}>
        Notes
      </h4>

      {loading ? (
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Loading notes...</p>
      ) : notes.length > 0 ? (
        <div style={{ marginBottom: 16, maxHeight: 200, overflowY: "auto" }}>
          {notes.map((note) => (
            <div
              key={note.id}
              style={{
                background: "var(--surface-2)",
                padding: "10px 12px",
                borderRadius: 4,
                marginBottom: 8,
                fontSize: "0.85rem",
              }}
            >
              <p style={{ margin: 0, marginBottom: 4, fontSize: "0.75rem", color: "var(--border-strong)" }}>
                {formatDate(note.created_at)}
              </p>
              <p style={{ margin: 0, color: "var(--text-strong)" }}>{note.note}</p>
            </div>
          ))}
        </div>
      ) : (
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--border-strong)",
            marginBottom: 16,
          }}
        >
          No notes yet
        </p>
      )}

      <form onSubmit={handleAddNote} style={{ display: "flex", gap: 6 }}>
        <textarea
          placeholder="Add a note..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={2}
          style={{
            flex: 1,
            padding: "8px 10px",
            border: "1px solid var(--border-strong)",
            borderRadius: 4,
            fontSize: "0.85rem",
            fontFamily: "inherit",
            resize: "none",
          }}
        />
        <button
          type="submit"
          disabled={!newNote.trim() || isSubmitting}
          style={{
            padding: "8px 12px",
            background: newNote.trim() ? "var(--info)" : "var(--border-strong)",
            color: "var(--on-solid)",
            border: "none",
            borderRadius: 4,
            cursor: newNote.trim() ? "pointer" : "default",
            fontSize: "0.85rem",
            alignSelf: "flex-end",
            whiteSpace:"nowrap"
          }}
        >
          {isSubmitting ? "..." : "Add"}
        </button>
      </form>
    </div>
  );
}
