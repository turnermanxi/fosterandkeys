/**
 * Property Comparator
 * 
 * Compares extracted property data with existing database records.
 * Generates diffs and determines if updates are safe or need review.
 */

/**
 * Fields that should never be null in the database
 */
const REQUIRED_FIELDS = ['address', 'city'];

/**
 * Fields that trigger review if they change significantly
 */
const CRITICAL_FIELDS = {
  price_min: true,
  price_max: true,
  address: true,
  property_name: true,
};

/**
 * Compare extracted data with existing property data
 * 
 * @param {object} extracted - Data extracted from HTML (output from extractPropertyDataFromHTML)
 * @param {object} existing - Existing property record from database
 * @param {object} config - Safety configuration (thresholds, etc.)
 * @returns {object} Comparison result with should_update, needs_review, diff, reasons
 */
export function comparePropertyData(
  extracted,
  existing,
  config = {}
) {
  const {
    priceChangeThreshold = 0.20, // 20% by default
    maxNullThreshold = 0.30, // 30% null is too many
    strictAddressMatch = true,
  } = config;

  const comparison = {
    should_update: true,
    needs_review: false,
    diff: [],
    reasons: [],
    changedFields: [],
    nullFieldsCount: 0,
  };

  // Iterate through extracted fields
  const fieldsToCheck = Object.keys(extracted);

  for (const field of fieldsToCheck) {
    const extractedValue = extracted[field];
    const existingValue = existing[field];

    // Check for null values in critical fields
    if (REQUIRED_FIELDS.includes(field) && extractedValue === null) {
      comparison.needs_review = true;
      comparison.reasons.push(
        `Required field "${field}" became null in extracted data`
      );
    }

    // Only add to diff if there's a change
    const hasChanged = !valuesEqual(extractedValue, existingValue);

    if (hasChanged) {
      comparison.changedFields.push(field);

      const change = {
        field: field,
        old_value: existingValue,
        new_value: extractedValue,
        changed: true,
      };

      comparison.diff.push(change);

      // Check if this is a critical field that needs review
      if (CRITICAL_FIELDS[field]) {
        const reviewResult = checkCriticalFieldChange(
          field,
          extractedValue,
          existingValue,
          priceChangeThreshold
        );

        if (reviewResult.needsReview) {
          comparison.needs_review = true;
          comparison.reasons.push(reviewResult.reason);
        }
      }
    }
  }

  // Count how many fields became null
  const nullCount = fieldsToCheck.filter((f) => extracted[f] === null).length;
  const nullPercentage = nullCount / fieldsToCheck.length;

  comparison.nullFieldsCount = nullCount;

  if (nullPercentage > maxNullThreshold) {
    comparison.needs_review = true;
    comparison.reasons.push(
      `Too many fields became null (${(nullPercentage * 100).toFixed(1)}% > ${(maxNullThreshold * 100).toFixed(1)}%)`
    );
  }

  // If no changes at all, don't update
  if (comparison.changedFields.length === 0) {
    comparison.should_update = false;
    comparison.reasons.push('No changes detected');
  }

  return comparison;
}

/**
 * Check if a critical field change requires review
 * 
 * @param {string} field - Field name
 * @param {*} newValue - New value
 * @param {*} oldValue - Old value
 * @param {number} priceThreshold - Percentage threshold for price changes
 * @returns {object} {needsReview: boolean, reason: string}
 */
function checkCriticalFieldChange(field, newValue, oldValue, priceThreshold) {
  // Price change check
  if (field.startsWith('price_') && oldValue !== null && newValue !== null) {
    const percentChange = Math.abs((newValue - oldValue) / oldValue);

    if (percentChange > priceThreshold) {
      return {
        needsReview: true,
        reason: `Price change exceeds ${(priceThreshold * 100).toFixed(1)}%: ${oldValue} → ${newValue}`,
      };
    }
  }

  // Address change check
  if (field === 'address') {
    if (newValue !== oldValue && newValue !== null && oldValue !== null) {
      return {
        needsReview: true,
        reason: `Address changed: "${oldValue}" → "${newValue}"`,
      };
    }
  }

  // Property name significant change check
  if (field === 'property_name') {
    if (newValue !== oldValue && newValue !== null && oldValue !== null) {
      const similarity = calculateStringSimilarity(oldValue, newValue);
      if (similarity < 0.7) {
        return {
          needsReview: true,
          reason: `Property name changed significantly: "${oldValue}" → "${newValue}"`,
        };
      }
    }
  }

  return { needsReview: false, reason: null };
}

/**
 * Build update object with only changed fields
 * (ignores null values unless explicitly allowing them)
 * 
 * @param {array} diff - Diff array from comparison
 * @param {boolean} allowNullUpdates - Whether to set fields to null
 * @returns {object} Update object for database
 */
export function buildUpdateObject(diff, allowNullUpdates = false) {
  const update = {};
  const timestamp = new Date().toISOString();

  for (const change of diff) {
    const { field, new_value } = change;

    // Skip null values unless explicitly allowed
    if (new_value === null && !allowNullUpdates) {
      continue;
    }

    update[field] = new_value;
  }

  // Always update timestamp
  update.updated_at = timestamp;

  return update;
}

/**
 * Compare two values for equality (handles different types)
 * 
 * @param {*} val1
 * @param {*} val2
 * @returns {boolean}
 */
function valuesEqual(val1, val2) {
  // Both null/undefined
  if (val1 == null && val2 == null) {
    return true;
  }

  // One is null/undefined
  if (val1 == null || val2 == null) {
    return false;
  }

  // Array comparison
  if (Array.isArray(val1) && Array.isArray(val2)) {
    if (val1.length !== val2.length) {
      return false;
    }
    return val1.every((item, index) => item === val2[index]);
  }

  // Object comparison (for JSONB fields)
  if (typeof val1 === 'object' && typeof val2 === 'object') {
    return JSON.stringify(val1) === JSON.stringify(val2);
  }

  // Numeric comparison (handle precision)
  if (typeof val1 === 'number' && typeof val2 === 'number') {
    return Math.abs(val1 - val2) < 0.01; // Allow small precision differences
  }

  // String comparison (trim whitespace)
  if (typeof val1 === 'string' && typeof val2 === 'string') {
    return val1.trim() === val2.trim();
  }

  return val1 === val2;
}

/**
 * Calculate string similarity (0-1)
 * Simple implementation using Levenshtein distance
 * 
 * @param {string} str1
 * @param {string} str2
 * @returns {number} Similarity score 0-1
 */
function calculateStringSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate edit distance (Levenshtein)
 * 
 * @param {string} s1
 * @param {string} s2
 * @returns {number}
 */
function getEditDistance(s1, s2) {
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

/**
 * Generate summary of changes for logging/display
 * 
 * @param {object} comparison - Result from comparePropertyData
 * @returns {object} Summary
 */
export function generateComparisonSummary(comparison) {
  const { diff, needs_review, changedFields, reasons } = comparison;

  const summary = {
    changeCount: changedFields.length,
    changedFields: changedFields,
    needs_review: needs_review,
    review_reasons: reasons,
    changes: {},
  };

  // Build human-readable changes
  for (const change of diff) {
    summary.changes[change.field] = {
      from: change.old_value,
      to: change.new_value,
    };
  }

  return summary;
}
