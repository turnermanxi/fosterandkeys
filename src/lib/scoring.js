/**
 * Score how well a unit (+ its parent apartment) matches a lead's criteria.
 *
 * Returns a number 0-100.  Each criterion is weighted; if a criterion
 * is missing from the lead we skip it so total weight adjusts.
 *
 * Weights (tweakable):
 *   budget (rent)  – 35
 *   location       – 25
 *   bedrooms       – 20
 *   bathrooms      – 20
 */

const WEIGHTS = {
  budget: 35,
  location: 25,
  bedrooms: 20,
  bathrooms: 20,
};

/**
 * Normalise metro area strings for comparison.
 * "houston" → "HOUSTON_METRO", "dfw" / "dallas" / "fort worth" → "DFW_METRO"
 */
function normaliseMetro(raw) {
  if (!raw) return "";
  const s = raw.toLowerCase().trim();
  if (s.includes("houston")) return "HOUSTON_METRO";
  if (s.includes("dallas") || s.includes("dfw") || s.includes("fort worth"))
    return "DFW_METRO";
  return s;
}

/**
 * @param {object} lead       – row from `leads` table
 * @param {object} unit       – row from `units` table
 * @param {object} apartment  – row from `apartments` table
 * @returns {number}  0-100
 */
export function scoreUnit(lead, unit, apartment) {
  let earned = 0;
  let possible = 0;

  // --- Budget (monthly rent) ---
  if (lead.budget_min != null || lead.budget_max != null) {
    possible += WEIGHTS.budget;
    // Use the average of rent_min and rent_max for comparison
    const rentLo = Number(unit.rent_min) || 0;
    const rentHi = Number(unit.rent_max) || rentLo;
    const rent = (rentLo + rentHi) / 2 || 0;

    if (rent === 0) {
      // No rent data on the unit, give partial credit
      earned += WEIGHTS.budget * 0.3;
    } else {
      const min = Number(lead.budget_min) ?? 0;
      const max = Number(lead.budget_max) ?? Infinity;

      if (rent >= min && rent <= max) {
        earned += WEIGHTS.budget; // perfect fit
      } else {
        // partial credit — how far off?
        const mid = (min + (max === Infinity ? min * 1.5 : max)) / 2;
        const range =
          (max === Infinity ? min * 0.5 : (max - min) / 2) || 1;
        const diff = Math.abs(rent - mid);
        const ratio = Math.max(0, 1 - diff / range);
        earned += WEIGHTS.budget * ratio;
      }
    }
  }

  // --- Location (metro area / city) ---
  if (lead.desired_location) {
    possible += WEIGHTS.location;
    const leadMetro = normaliseMetro(lead.desired_location);
    const aptMetro = (apartment.metro_area ?? "").toUpperCase();
    const aptCity = (apartment.city ?? "").toLowerCase().trim();
    const leadLoc = lead.desired_location.toLowerCase().trim();

    if (leadMetro === aptMetro) {
      earned += WEIGHTS.location;
    } else if (aptCity && aptCity.includes(leadLoc)) {
      earned += WEIGHTS.location;
    } else if (aptCity && leadLoc.includes(aptCity)) {
      earned += WEIGHTS.location * 0.75;
    }
  }

  // --- Bedrooms ---
  // Support both new min/max range format and legacy single bedroom field
  // For leads: check if they have bedrooms_min/max (range requirement) or just bedrooms (exact)
  // For units/properties: check if they have bedrooms_min/max (multi-unit) or just bedrooms (single)
  
  const leadBedroomMin = lead.bedrooms_min !== null && lead.bedrooms_min !== undefined ? lead.bedrooms_min : lead.bedrooms;
  const leadBedroomMax = lead.bedrooms_max !== null && lead.bedrooms_max !== undefined ? lead.bedrooms_max : lead.bedrooms;
  const unitBedroomMin = unit.bedrooms_min !== null && unit.bedrooms_min !== undefined ? unit.bedrooms_min : unit.bedrooms;
  const unitBedroomMax = unit.bedrooms_max !== null && unit.bedrooms_max !== undefined ? unit.bedrooms_max : unit.bedrooms;
  
  if (leadBedroomMin != null || leadBedroomMax != null || unitBedroomMin != null || unitBedroomMax != null) {
    possible += WEIGHTS.bedrooms;
    
    // If lead specifies a range (bedrooms_min and bedrooms_max), check if unit offers that range
    if (leadBedroomMin != null && leadBedroomMax != null && unitBedroomMin != null && unitBedroomMax != null) {
      // Lead wants between leadBedroomMin and leadBedroomMax
      // Unit offers between unitBedroomMin and unitBedroomMax
      // Perfect match: lead's entire range falls within unit's range
      if (leadBedroomMin >= unitBedroomMin && leadBedroomMax <= unitBedroomMax) {
        earned += WEIGHTS.bedrooms; // exact fit
      } else if (
        // Partial overlap: lead's range overlaps with unit's range
        (leadBedroomMin <= unitBedroomMax && leadBedroomMax >= unitBedroomMin)
      ) {
        earned += WEIGHTS.bedrooms * 0.7; // acceptable match
      } else {
        // No overlap: lead's requirements don't align with what unit offers
        const leadMid = (leadBedroomMin + leadBedroomMax) / 2;
        const unitMid = (unitBedroomMin + unitBedroomMax) / 2;
        const diff = Math.abs(leadMid - unitMid);
        const ratio = Math.max(0, 1 - diff / 3);
        earned += WEIGHTS.bedrooms * ratio * 0.5;
      }
    } else if (leadBedroomMin != null && unitBedroomMin != null) {
      // Lead specifies exact requirement (or legacy single value), unit offers range
      // Check if lead's requirement falls within unit's range
      if (leadBedroomMin >= unitBedroomMin && leadBedroomMin <= unitBedroomMax) {
        earned += WEIGHTS.bedrooms; // perfect fit
      } else {
        const diff = Math.abs(leadBedroomMin - unitBedroomMin);
        if (diff === 1) earned += WEIGHTS.bedrooms * 0.6;
        else if (diff === 2) earned += WEIGHTS.bedrooms * 0.2;
      }
    } else if (leadBedroomMin != null && unit.bedrooms != null) {
      // Both are exact values (legacy format)
      const diff = Math.abs(unit.bedrooms - leadBedroomMin);
      if (diff === 0) earned += WEIGHTS.bedrooms;
      else if (diff === 1) earned += WEIGHTS.bedrooms * 0.6;
      else if (diff === 2) earned += WEIGHTS.bedrooms * 0.2;
    }
  }

  // --- Bathrooms ---
  if (lead.bathrooms != null && unit.bathrooms != null) {
    possible += WEIGHTS.bathrooms;
    const diff = Math.abs(Number(unit.bathrooms) - Number(lead.bathrooms));
    if (diff === 0) earned += WEIGHTS.bathrooms;
    else if (diff <= 0.5) earned += WEIGHTS.bathrooms * 0.8;
    else if (diff <= 1) earned += WEIGHTS.bathrooms * 0.5;
    else if (diff <= 2) earned += WEIGHTS.bathrooms * 0.2;
  }

  if (possible === 0) return 0;
  return Math.round((earned / possible) * 100);
}

/**
 * Score a lead against ALL units (with their apartments) and return sorted results.
 * @param {object}   lead
 * @param {object[]} units       – each unit should have a nested `apartment` or flat apartment fields
 * @param {object}   apartmentMap – { [apartment_id]: apartment }
 * @returns {{ unit: object, apartment: object, score: number }[]}
 */
export function scoreLeadAgainstAll(lead, units, apartmentMap) {
  return units
    .map((u) => {
      const apt = apartmentMap[u.apartment_id] ?? {};
      return { unit: u, apartment: apt, score: scoreUnit(lead, u, apt) };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Validate that a unit match is appropriate for the lead.
 * Returns { isValid: boolean, issues: string[], mismatches: { [key]: string } }
 */
export function validateUnitMatch(lead, unit, apartment) {
  const issues = [];
  const mismatches = {};

  // Check location
  if (lead.desired_location) {
    const leadMetro = normaliseMetro(lead.desired_location);
    const aptMetro = (apartment.metro_area ?? "").toUpperCase();
    if (leadMetro && aptMetro && leadMetro !== aptMetro) {
      mismatches.location = `Requested: ${lead.desired_location}, Apartment: ${apartment.metro_area || "Unknown"}`;
      issues.push(`Location mismatch: ${lead.desired_location} vs ${apartment.metro_area || "Unknown"}`);
    }
  }

  // Check budget
  if (lead.budget_min != null || lead.budget_max != null) {
    const rentLo = Number(unit.rent_min) || 0;
    const rentHi = Number(unit.rent_max) || rentLo;
    const avgRent = (rentLo + rentHi) / 2;
    
    if (lead.budget_max && avgRent > lead.budget_max * 1.2) {
      mismatches.budget = `Rent avg $${Math.round(avgRent)}, Budget max: $${lead.budget_max}`;
      issues.push(`Budget: rent $${Math.round(avgRent)} exceeds budget by 20%+`);
    }
  }

  // Check bedrooms
  const leadBedroomMin = lead.bedrooms_min !== null && lead.bedrooms_min !== undefined ? lead.bedrooms_min : lead.bedrooms;
  const leadBedroomMax = lead.bedrooms_max !== null && lead.bedrooms_max !== undefined ? lead.bedrooms_max : lead.bedrooms;
  const unitBedroomMin = unit.bedrooms_min !== null && unit.bedrooms_min !== undefined ? unit.bedrooms_min : unit.bedrooms;
  const unitBedroomMax = unit.bedrooms_max !== null && unit.bedrooms_max !== undefined ? unit.bedrooms_max : unit.bedrooms;
  
  if ((leadBedroomMin != null || leadBedroomMax != null) && (unitBedroomMin != null || unitBedroomMax != null)) {
    const leadBed = leadBedroomMin ?? leadBedroomMax;
    const unitBed = unitBedroomMin ?? unitBedroomMax;
    
    // For range format: check if lead's bedroom need falls within unit's range
    if (leadBedroomMin != null && leadBedroomMax != null && unitBedroomMin != null && unitBedroomMax != null) {
      if (!(leadBedroomMin >= unitBedroomMin && leadBedroomMax <= unitBedroomMax)) {
        // Lead's range doesn't fully fit within unit's range
        if (!(leadBedroomMin <= unitBedroomMax && leadBedroomMax >= unitBedroomMin)) {
          // No overlap at all
          mismatches.bedrooms = `Unit offers ${unitBedroomMin}-${unitBedroomMax} BR, Requested: ${leadBedroomMin}-${leadBedroomMax} BR`;
          issues.push(`Bedrooms: unit offers ${unitBedroomMin}-${unitBedroomMax}, requested ${leadBedroomMin}-${leadBedroomMax}`);
        }
      }
    } else if (leadBed != null && unitBed != null) {
      // Single value format: check difference
      const diff = Math.abs(unitBed - leadBed);
      if (diff > 2) {
        mismatches.bedrooms = `Unit: ${unitBed} bed, Requested: ${leadBed} bed`;
        issues.push(`Bedrooms differ by ${diff}: unit has ${unitBed}, requested ${leadBed}`);
      }
    }
  }

  // Check bathrooms
  if (lead.bathrooms != null && unit.bathrooms != null) {
    const diff = Math.abs(unit.bathrooms - lead.bathrooms);
    if (diff > 2) {
      mismatches.bathrooms = `Unit: ${unit.bathrooms} bath, Requested: ${lead.bathrooms} bath`;
      issues.push(`Bathrooms differ by ${diff}: unit has ${unit.bathrooms}, requested ${lead.bathrooms}`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    mismatches,
  };
}
