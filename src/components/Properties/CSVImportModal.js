import React, { useState } from "react";

const REQUIRED_HEADERS = ["address", "city"];
const OPTIONAL_HEADERS = [
  "state",
  "zip",
  "property_name",
  "price_min",
  "price_max",
  "bedrooms",
  "bathrooms",
  "sqft",
  "property_type",
  "pet_friendly",
  "accepts_evictions",
  "accepts_broken_leases",
  "accepts_low_credit",
  "accepts_itin",
  "accepts_second_chance",
  "admin_fee",
  "app_fee",
  "deposit_info",
  "contact_name",
  "contact_phone",
  "contact_email",
  "website",
  "notes",
];

export default function CSVImportModal({ isOpen, onClose, onImportSuccess }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      setFile(null);
      setPreview(null);
      return;
    }

    // Validate file type
    if (!selectedFile.name.endsWith(".csv")) {
      setError("Please select a CSV file");
      return;
    }

    setFile(selectedFile);
    setError(null);
    await previewFile(selectedFile);
  };

  const previewFile = async (selectedFile) => {
    try {
      const text = await selectedFile.text();
      const lines = text.trim().split("\n");

      if (lines.length < 2) {
        setError("CSV file must have headers and at least one data row");
        return;
      }

      // Parse headers
      const headers = parseCSVLine(lines[0]);
      const validationErrors = validateHeaders(headers);

      if (validationErrors.length > 0) {
        setError(validationErrors.join(" | "));
        return;
      }

      // Parse first 5 data rows for preview
      const dataRows = [];
      for (let i = 1; i < Math.min(6, lines.length); i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length > 0) {
          const row = {};
          headers.forEach((h, idx) => {
            row[h] = values[idx] || "";
          });
          dataRows.push(row);
        }
      }

      setPreview({
        headers,
        rows: dataRows,
        totalRows: lines.length - 1,
      });
    } catch (err) {
      setError(`Failed to preview file: ${err.message}`);
    }
  };

  const validateHeaders = (headers) => {
    const errors = [];
    const missingRequired = REQUIRED_HEADERS.filter(
      (h) => !headers.includes(h)
    );

    if (missingRequired.length > 0) {
      errors.push(`Missing required columns: ${missingRequired.join(", ")}`);
    }

    const unknownHeaders = headers.filter(
      (h) => !REQUIRED_HEADERS.includes(h) && !OPTIONAL_HEADERS.includes(h)
    );
    if (unknownHeaders.length > 0) {
      errors.push(
        `Unknown columns: ${unknownHeaders.join(", ")}. These will be ignored.`
      );
    }

    return errors;
  };

  const handleImport = async () => {
    if (!file || !preview) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/properties/import/csv", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Import failed");
      }

      const result = await response.json();
      setImportResult(result);

      // Call success callback after a short delay
      setTimeout(() => {
        onImportSuccess?.();
        handleClose();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setImportResult(null);
    onClose();
  };

  const downloadTemplate = () => {
    window.location.href = "/api/properties/import/csv";
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
          maxWidth: "900px",
          width: "90%",
          maxHeight: "90vh",
          overflow: "auto",
          padding: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600" }}>
            Import Properties from CSV
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "#666",
            }}
          >
            ×
          </button>
        </div>

        {importResult ? (
          // Success state
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div
              style={{
                fontSize: "48px",
                marginBottom: "16px",
              }}
            >
              ✓
            </div>
            <h3 style={{ margin: 0, marginBottom: "16px", color: "#10b981" }}>
              Import Complete
            </h3>
            <p style={{ margin: 0, marginBottom: "8px", color: "#666" }}>
              <strong>{importResult.imported}</strong> properties imported
              successfully
            </p>
            {importResult.duplicateFlagged > 0 && (
              <p style={{ margin: 0, marginBottom: "8px", color: "#f59e0b" }}>
                <strong>{importResult.duplicateFlagged}</strong> duplicate(s)
                flagged for review
              </p>
            )}
            {importResult.errors > 0 && (
              <p style={{ margin: 0, color: "#ef4444" }}>
                <strong>{importResult.errors}</strong> error(s) occurred
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Instructions */}
            <div
              style={{
                backgroundColor: "#f0f9ff",
                border: "1px solid #bfdbfe",
                borderRadius: "6px",
                padding: "12px",
                marginBottom: "20px",
                fontSize: "14px",
                color: "#1e40af",
              }}
            >
              <strong>Column names must match exactly</strong> (case-sensitive).
              Required: <code>address</code>, <code>city</code>. All other
              columns are optional.
              <br />
              <button
                onClick={downloadTemplate}
                style={{
                  display: "block",
                  marginTop: "8px",
                  background: "none",
                  border: "none",
                  color: "#0284c7",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                  fontSize: "14px",
                }}
              >
                Download CSV template
              </button>
            </div>

            {/* File upload */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "500",
                  color: "#333",
                }}
              >
                Select CSV File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={loading}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              />
            </div>

            {/* Error message */}
            {error && (
              <div
                style={{
                  backgroundColor: "#fee2e2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  padding: "12px",
                  borderRadius: "4px",
                  marginBottom: "20px",
                  fontSize: "14px",
                }}
              >
                {error}
              </div>
            )}

            {/* File preview */}
            {preview && (
              <div style={{ marginBottom: "20px" }}>
                <h3
                  style={{
                    margin: "0 0 12px 0",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#333",
                  }}
                >
                  Preview ({preview.totalRows} rows)
                </h3>

                {/* Column list */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  {preview.headers.map((header) => {
                    const isRequired = REQUIRED_HEADERS.includes(header);
                    return (
                      <span
                        key={header}
                        style={{
                          display: "inline-block",
                          padding: "4px 8px",
                          backgroundColor: isRequired ? "#dcfce7" : "#f3f4f6",
                          border: isRequired
                            ? "1px solid #86efac"
                            : "1px solid #d1d5db",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "500",
                          color: isRequired ? "#166534" : "#374151",
                        }}
                      >
                        {header}
                        {isRequired && " *"}
                      </span>
                    );
                  })}
                </div>

                {/* Data preview table */}
                <div
                  style={{
                    overflowX: "auto",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "13px",
                    }}
                  >
                    <thead>
                      <tr style={{ backgroundColor: "#f3f4f6" }}>
                        {preview.headers.map((header) => (
                          <th
                            key={header}
                            style={{
                              padding: "8px",
                              textAlign: "left",
                              fontWeight: "600",
                              borderRight: "1px solid #d1d5db",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderTop: "1px solid #d1d5db",
                            backgroundColor: idx % 2 === 0 ? "#fff" : "#f9fafb",
                          }}
                        >
                          {preview.headers.map((header) => (
                            <td
                              key={`${idx}-${header}`}
                              style={{
                                padding: "8px",
                                borderRight: "1px solid #d1d5db",
                                maxWidth: "150px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={row[header]}
                            >
                              {row[header] || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Column reference */}
            <div
              style={{
                backgroundColor: "#faf5ff",
                border: "1px solid #e9d5ff",
                borderRadius: "6px",
                padding: "12px",
                marginBottom: "20px",
                fontSize: "12px",
                color: "#6b21a8",
              }}
            >
              <strong>Optional columns:</strong> state, zip, property_name,
              price_min, price_max, bedrooms, bathrooms, sqft,
              property_type, pet_friendly, accepts_evictions,
              accepts_broken_leases, accepts_low_credit, accepts_itin,
              accepts_second_chance, admin_fee, app_fee, deposit_info,
              contact_name, contact_phone, contact_email, website, notes
            </div>

            {/* Action buttons */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={handleClose}
                disabled={loading}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  backgroundColor: "#fff",
                  color: "#333",
                  cursor: "pointer",
                  fontWeight: "500",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!preview || loading}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  backgroundColor: preview && !loading ? "#2563eb" : "#9ca3af",
                  color: "white",
                  cursor: preview && !loading ? "pointer" : "not-allowed",
                  fontWeight: "500",
                }}
              >
                {loading ? "Importing..." : "Import Properties"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Parse a single CSV line (handles quoted values)
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
