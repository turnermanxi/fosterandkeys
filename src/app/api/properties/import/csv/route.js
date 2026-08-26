import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCurrentAccountId } from "@/lib/accounts";
import {
  checkForDuplicates,
  recordDuplicateFlags,
} from "@/lib/duplicateDetection";

/**
 * POST /api/properties/import/csv
 * Import properties from CSV file
 *
 * Expected CSV columns (EXACT names required):
 *   - address (required)
 *   - city (required)
 *   - state (optional, default: TX)
 *   - zip (optional)
 *   - property_name (optional)
 *   - price_min (optional, numeric)
 *   - price_max (optional, numeric)
 *   - bedrooms (optional, numeric)
 *   - bathrooms (optional, numeric)
 *   - sqft (optional, numeric)
 *   - property_type (optional)
 *   - pet_friendly (optional, true/false/yes/no)
 *   - accepts_evictions (optional, true/false/yes/no)
 *   - accepts_broken_leases (optional, true/false/yes/no)
 *   - accepts_low_credit (optional, true/false/yes/no)
 *   - accepts_itin (optional, true/false/yes/no)
 *   - accepts_second_chance (optional, true/false/yes/no)
 *   - admin_fee (optional, numeric)
 *   - app_fee (optional, numeric)
 *   - deposit_info (optional)
 *   - contact_name (optional)
 *   - contact_phone (optional)
 *   - contact_email (optional)
 *   - website (optional)
 *   - notes (optional)
 */
export async function POST(request) {
  try {
    const accountId = await getCurrentAccountId();
    const supabase = getSupabaseAdmin();
    const formData = await request.formData();
    const csvFile = formData.get("file");

    if (!csvFile) {
      return NextResponse.json(
        { error: "No CSV file provided" },
        { status: 400 }
      );
    }

    // Read CSV file
    const text = await csvFile.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "CSV file is empty" },
        { status: 400 }
      );
    }

    // Extract headers from first row
    const headers = Object.keys(rows[0]);

    // Validate required columns
    if (!headers.includes("address") || !headers.includes("city")) {
      return NextResponse.json(
        {
          error: "CSV must include 'address' and 'city' columns",
          providedHeaders: headers,
        },
        { status: 400 }
      );
    }

    // Import properties
    const results = {
      successful: [],
      duplicates: [],
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because row 1 is headers, array is 0-indexed

      try {
        // Parse boolean fields
        const property = {
          property_name: row.property_name || undefined,
          address: row.address,
          city: row.city,
          state: row.state || "TX",
          zip: row.zip || undefined,
          price_min: row.price_min
            ? parseFloat(row.price_min)
            : undefined,
          price_max: row.price_max
            ? parseFloat(row.price_max)
            : undefined,
          bedrooms: row.bedrooms ? parseInt(row.bedrooms) : undefined,
          bathrooms: row.bathrooms
            ? parseFloat(row.bathrooms)
            : undefined,
          sqft: row.sqft ? parseInt(row.sqft) : undefined,
          property_type: row.property_type || undefined,
          pet_friendly: parseBool(row.pet_friendly),
          accepts_evictions: parseBool(row.accepts_evictions),
          accepts_broken_leases: parseBool(row.accepts_broken_leases),
          accepts_low_credit: parseBool(row.accepts_low_credit),
          accepts_itin: parseBool(row.accepts_itin),
          accepts_second_chance: parseBool(row.accepts_second_chance),
          admin_fee: row.admin_fee
            ? parseFloat(row.admin_fee)
            : undefined,
          app_fee: row.app_fee ? parseFloat(row.app_fee) : undefined,
          deposit_info: row.deposit_info || undefined,
          contact_name: row.contact_name || undefined,
          contact_phone: row.contact_phone || undefined,
          contact_email: row.contact_email || undefined,
          website: row.website || undefined,
          notes: row.notes || undefined,
          source: "csv_import",
        };

        // Check for duplicates
        const duplicates = await checkForDuplicates(property, accountId);

        if (duplicates.length > 0) {
          results.duplicates.push({
            row: rowNumber,
            address: property.address,
            duplicatesFound: duplicates,
          });
          continue;
        }

        // Create property
        const { data: createdProperty, error: createErr } = await supabase
          .from("properties")
          .insert({
            account_id: accountId,
            created_by: accountId,
            ...property,
          })
          .select()
          .single();

        if (createErr) throw createErr;

        // Record duplicate flags
        if (duplicates.length > 0) {
          await recordDuplicateFlags(
            createdProperty.id,
            accountId,
            duplicates
          );
        }

        results.successful.push({
          row: rowNumber,
          id: createdProperty.id,
          address: createdProperty.address,
          city: createdProperty.city,
        });
      } catch (err) {
        results.errors.push({
          row: rowNumber,
          address: row.address || "unknown",
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      imported: results.successful.length,
      duplicateFlagged: results.duplicates.length,
      errors: results.errors.length,
      results,
    });
  } catch (err) {
    console.error("POST /api/properties/import/csv error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Simple CSV parser (handles basic cases)
 * For production, use a library like 'papaparse'
 */
function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);

  // Parse rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue; // Skip empty rows

    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line (handles quoted values)
 */
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

/**
 * Parse boolean values from CSV
 */
function parseBool(value) {
  if (!value) return null;
  if (typeof value === "boolean") return value;

  const str = String(value).toLowerCase().trim();
  if (["true", "yes", "1", "y"].includes(str)) return true;
  if (["false", "no", "0", "n"].includes(str)) return false;
  return null;
}

/**
 * GET /api/properties/import/csv/template
 * Return CSV template with example data
 */
export async function GET() {
  const template = `address,city,state,zip,property_name,price_min,price_max,bedrooms,bathrooms,sqft,property_type,pet_friendly,accepts_evictions,accepts_broken_leases,accepts_low_credit,accepts_itin,accepts_second_chance,admin_fee,app_fee,deposit_info,contact_name,contact_phone,contact_email,website,notes
123 Main Street,Houston,TX,77001,Park Avenue Lofts,1500,2500,2,2,950,apartment,true,false,false,true,true,true,150,50,1 month's rent,John Doe,713-555-1234,john@apt.com,https://parkavenueapts.com,Recently renovated
456 Oak Avenue,Dallas,TX,75201,Riverside Complex,2000,3000,3,2,1200,apartment,false,true,true,false,false,true,200,75,1.5 month's rent,Jane Smith,214-555-5678,jane@riverside.com,https://riversidecomplex.com,Pool and gym`;

  return new Response(template, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="properties_import_template.csv"',
    },
  });
}
