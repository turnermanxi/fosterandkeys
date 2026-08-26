/**
 * Generate formatted bedroom and bathroom ranges from property data
 * 
 * @param {object} propertyData - The property/unit data
 * @returns {object} { bedroomRange, bathroomRange }
 */
export function generateBedroomRange(propertyData) {
  if (!propertyData) return { bedroomRange: "–", bathroomRange: "–" };
  
  const bedrooms = propertyData.bedrooms;
  if (!bedrooms) return { bedroomRange: "–", bathroomRange: "–" };
  
  // For a single unit/property value, show it as a single value
  // This can be extended later if we have arrays of values
  let bedroomRange;
  if (bedrooms === 0) {
    bedroomRange = "Studio";
  } else if (bedrooms === 1) {
    bedroomRange = "1 BD";
  } else if (bedrooms === 2) {
    bedroomRange = "2 BD";
  } else if (bedrooms === 3) {
    bedroomRange = "3 BD";
  } else {
    bedroomRange = `${bedrooms}+ BD`;
  }
  
  const bathrooms = propertyData.bathrooms;
  const bathroomRange = bathrooms ? `${bathrooms} BA` : "–";
  
  return { bedroomRange, bathroomRange };
}

/**
 * Generate bedroom ranges for multiple units/floorplans
 * Used when a property has multiple unit types
 * 
 * @param {array} units - Array of unit objects with bedrooms field
 * @returns {string} Formatted range like "1-3+ BR"
 */
export function generateMultipleBedroomRanges(units = []) {
  if (!units || units.length === 0) return "–";
  
  const bedroomsList = units.map(u => u.bedrooms).filter(b => b !== null && b !== undefined);
  if (bedroomsList.length === 0) return "–";
  
  const minBeds = Math.min(...bedroomsList);
  const maxBeds = Math.max(...bedroomsList);
  
  if (minBeds === maxBeds) {
    return minBeds === 0 ? "Studio" : `${minBeds} BD`;
  }
  
  // Format range like "1-3 BD" or "1-3+ BD"
  const maxLabel = maxBeds >= 3 ? `${maxBeds}+` : maxBeds;
  return `${minBeds}-${maxLabel} BD`;
}

/**
 * Generate bathroom ranges for multiple units/floorplans
 * 
 * @param {array} units - Array of unit objects with bathrooms field
 * @returns {string} Formatted range like "1-2.5 BA"
 */
export function generateMultipleBathroomRanges(units = []) {
  if (!units || units.length === 0) return "–";
  
  const bathroomsList = units.map(u => u.bathrooms).filter(b => b !== null && b !== undefined);
  if (bathroomsList.length === 0) return "–";
  
  const minBaths = Math.min(...bathroomsList);
  const maxBaths = Math.max(...bathroomsList);
  
  if (minBaths === maxBaths) {
    return `${minBaths} BA`;
  }
  
  return `${minBaths}-${maxBaths} BA`;
}

/**
 * Generate square footage range for display
 * 
 * @param {object} propertyData - Property with sqft, sqft_min, sqft_max fields
 * @returns {string} Formatted sqft like "1000" or "1000-1200 sqft"
 */
export function generateSqftRange(propertyData) {
  if (!propertyData) return "–";
  
  // Check for min/max sqft first
  if (propertyData.sqft_min && propertyData.sqft_max) {
    if (propertyData.sqft_min === propertyData.sqft_max) {
      return `${Number(propertyData.sqft_min).toLocaleString()} sqft`;
    }
    return `${Number(propertyData.sqft_min).toLocaleString()}-${Number(propertyData.sqft_max).toLocaleString()} sqft`;
  }
  
  // Fall back to single sqft value
  if (propertyData.sqft) {
    return `${Number(propertyData.sqft).toLocaleString()} sqft`;
  }
  
  return "–";
}

/**
 * Format bedroom count as readable text (Studio, 1BR, 2BR, etc.)
 * @param {number} count - Number of bedrooms (0 = Studio)
 * @returns {string} Formatted bedroom text
 */
function formatBedroomCount(count) {
  if (count === null || count === undefined) return null;
  if (count === 0) return "Studio";
  if (count === 1) return "1BR";
  if (count === 2) return "2BR";
  if (count === 3) return "3BR";
  return `${count}BR`;
}

/**
 * Generate bedroom range for display using bedrooms_min and bedrooms_max
 * e.g., "Studio-3BR" or "2BR" if single value
 * 
 * @param {object} propertyData - Property/unit with bedrooms_min, bedrooms_max, or bedrooms fields
 * @returns {string} Formatted range like "Studio-3BR" or "–"
 */
export function generateBedroomRangeDisplay(propertyData) {
  if (!propertyData) return "–";
  
  // Check for min/max bedrooms first
  if (propertyData.bedrooms_min !== null && propertyData.bedrooms_min !== undefined && 
      propertyData.bedrooms_max !== null && propertyData.bedrooms_max !== undefined) {
    const minFormatted = formatBedroomCount(propertyData.bedrooms_min);
    const maxFormatted = formatBedroomCount(propertyData.bedrooms_max);
    
    if (propertyData.bedrooms_min === propertyData.bedrooms_max) {
      return minFormatted;
    }
    return `${minFormatted}-${maxFormatted}`;
  }
  
  // Fall back to single bedroom value
  if (propertyData.bedrooms !== null && propertyData.bedrooms !== undefined) {
    return formatBedroomCount(propertyData.bedrooms);
  }
  
  return "–";
}
