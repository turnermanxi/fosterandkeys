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
  if (lead.bedrooms != null && unit.bedrooms != null) {
    possible += WEIGHTS.bedrooms;
    const diff = Math.abs(unit.bedrooms - lead.bedrooms);
    if (diff === 0) earned += WEIGHTS.bedrooms;
    else if (diff === 1) earned += WEIGHTS.bedrooms * 0.6;
    else if (diff === 2) earned += WEIGHTS.bedrooms * 0.2;
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
