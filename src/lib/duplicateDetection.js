import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Normalize address for comparison
 * Remove special characters, convert to lowercase, trim
 */
function normalizeAddress(address) {
  return address
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // remove special chars
    .trim();
}

/**
 * Simple Levenshtein distance for fuzzy string matching
 * Returns distance (0 = exact match)
 */
function levenshteinDistance(a, b) {
  const aLen = a.length;
  const bLen = b.length;
  
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  const matrix = Array(bLen + 1)
    .fill(null)
    .map(() => Array(aLen + 1).fill(0));

  for (let i = 0; i <= aLen; i++) matrix[0][i] = i;
  for (let j = 0; j <= bLen; j++) matrix[j][0] = j;

  for (let j = 1; j <= bLen; j++) {
    for (let i = 1; i <= aLen; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  return matrix[bLen][aLen];
}

/**
 * Check for probable duplicates
 * Returns array of potential duplicate matches with confidence scores
 */
export async function checkForDuplicates(property, accountId) {
  const supabase = getSupabaseAdmin();

  const {
    address,
    city,
    zip,
    property_name,
    price_min,
    price_max,
  } = property;

  const normalizedAddress = normalizeAddress(address);
  const normalizedName = normalizeAddress(property_name || "");

  const duplicates = [];

  // 1. Check for exact/similar address match
  if (address && city) {
    const { data: addressMatches } = await supabase
      .from("properties")
      .select("id, property_name, address, city, zip, price_min, price_max")
      .eq("account_id", accountId)
      .eq("city", city)
      .is("archived_at", null); // exclude archived

    if (addressMatches) {
      addressMatches.forEach((existing) => {
        const existingNormalized = normalizeAddress(existing.address);
        
        // Check if address is similar (Levenshtein distance < 3)
        const addressDistance = levenshteinDistance(
          normalizedAddress,
          existingNormalized
        );

        if (addressDistance < 3) {
          // Address match found
          const priceOverlap = !(
            (price_max || 0) < (existing.price_min || 0) ||
            (price_min || 0) > (existing.price_max || 0)
          );

          let confidence = 80; // Base confidence for address match
          let reason = "same_address";

          if (priceOverlap && price_min && price_max) {
            confidence = 95; // Higher confidence if price overlaps
            reason = "same_address_overlapping_price";
          }

          duplicates.push({
            similar_to_id: existing.id,
            property_name: existing.property_name,
            address: existing.address,
            city: existing.city,
            price_min: existing.price_min,
            price_max: existing.price_max,
            reason,
            confidence,
          });
        }
      });
    }
  }

  // 2. Check for similar property name (fuzzy match)
  if (property_name) {
    const { data: existingProps } = await supabase
      .from("properties")
      .select("id, property_name, address, city, zip")
      .eq("account_id", accountId)
      .is("archived_at", null);

    if (existingProps) {
      existingProps.forEach((existing) => {
        // Skip if already flagged as address match
        if (duplicates.some((d) => d.similar_to_id === existing.id)) {
          return;
        }

        const existingNormalized = normalizeAddress(existing.property_name || "");
        const nameDistance = levenshteinDistance(normalizedName, existingNormalized);

        if (nameDistance < 3) {
          duplicates.push({
            similar_to_id: existing.id,
            property_name: existing.property_name,
            address: existing.address,
            city: existing.city,
            reason: "similar_name",
            confidence: 60,
          });
        }
      });
    }
  }

  return duplicates;
}

/**
 * Record duplicate flags in the database
 */
export async function recordDuplicateFlags(
  propertyId,
  accountId,
  duplicates
) {
  const supabase = getSupabaseAdmin();

  if (duplicates.length === 0) return;

  const flags = duplicates.map((dup) => ({
    account_id: accountId,
    property_id: propertyId,
    similar_to_id: dup.similar_to_id,
    reason: dup.reason,
    confidence: dup.confidence,
    status: "flagged",
  }));

  await supabase.from("potential_duplicates").insert(flags);
}
