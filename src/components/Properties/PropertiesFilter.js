"use client";

export default function PropertiesFilter({ filters, onFilterChange }) {
  function handleSearchChange(e) {
    onFilterChange({ ...filters, search: e.target.value });
  }

  function handleSourceChange(e) {
    onFilterChange({ ...filters, source: e.target.value });
  }

  function handleBedroomsChange(e) {
    onFilterChange({ ...filters, bedrooms: e.target.value ? parseInt(e.target.value) : "" });
  }

  function handleFavoriteToggle() {
    onFilterChange({ ...filters, favorite: !filters.favorite });
  }

  function handleArchivedToggle() {
    onFilterChange({ ...filters, archived: !filters.archived });
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        marginBottom: 16,
        padding: 16,
        background: "#f9fafb",
        borderRadius: 8,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label style={{ fontSize: "0.9rem", fontWeight: 500 }}>Source:</label>
        <select
          value={filters.source}
          onChange={handleSourceChange}
          style={{
            padding: "6px 10px",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            fontSize: "0.9rem",
          }}
        >
          <option value="all">All Sources</option>
          <option value="apartment_data">Apartment Data</option>
          <option value="manual">Manual Add</option>
          <option value="csv_import">CSV Import</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label style={{ fontSize: "0.9rem", fontWeight: 500 }}>Bedrooms:</label>
        <select
          value={filters.bedrooms ?? ""}
          onChange={handleBedroomsChange}
          style={{
            padding: "6px 10px",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            fontSize: "0.9rem",
          }}
        >
          <option value="">All</option>
          <option value="1">1 BD</option>
          <option value="2">2 BD</option>
          <option value="3">3 BD</option>
          <option value="4">4+ BD</option>
        </select>
      </div>

      <input
        type="text"
        placeholder="Search address, name, contact..."
        value={filters.search}
        onChange={handleSearchChange}
        style={{
          padding: "6px 10px",
          border: "1px solid #d1d5db",
          borderRadius: 4,
          fontSize: "0.9rem",
          flex: 1,
          minWidth: 200,
        }}
      />

      <button
        onClick={handleFavoriteToggle}
        style={{
          padding: "6px 12px",
          background: filters.favorite ? "#fbbf24" : "#e5e7eb",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          fontSize: "0.9rem",
          fontWeight: filters.favorite ? 600 : 400,
        }}
      >
        ★ Favorites
      </button>

      <button
        onClick={handleArchivedToggle}
        style={{
          padding: "6px 12px",
          background: filters.archived ? "#60a5fa" : "#e5e7eb",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          fontSize: "0.9rem",
          fontWeight: filters.archived ? 600 : 400,
        }}
      >
        📦 Archived
      </button>
    </div>
  );
}
