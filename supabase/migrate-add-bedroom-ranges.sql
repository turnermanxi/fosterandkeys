-- ============================================================
-- Add Bedroom Ranges to Properties
-- Migration: Support properties with multiple bedroom options
-- ============================================================

-- Add bedroom range columns to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS bedrooms_min INT,
ADD COLUMN IF NOT EXISTS bedrooms_max INT;

-- Migrate existing bedrooms single value to min/max range
UPDATE properties
SET bedrooms_min = bedrooms,
    bedrooms_max = bedrooms
WHERE bedrooms IS NOT NULL
  AND (bedrooms_min IS NULL OR bedrooms_max IS NULL);

-- For properties with NULL bedrooms, set sensible defaults if we can infer from units/apartments
-- This would require joining with apartments/units, so we'll handle it in code for now

-- Create index for bedroom range queries
CREATE INDEX IF NOT EXISTS idx_properties_bedroom_range ON properties(bedrooms_min, bedrooms_max);

-- Update leads table to track bedroom requirement as range (but keep single for backwards compatibility for now)
-- We'll add bedrooms_min/bedrooms_max to leads in a separate step to avoid breaking existing leads

-- Summary statistics
SELECT 
  'properties' as table_name,
  COUNT(*) as total,
  COUNT(CASE WHEN bedrooms IS NOT NULL THEN 1 END) as with_old_bedrooms,
  COUNT(CASE WHEN bedrooms_min IS NOT NULL THEN 1 END) as with_bedrooms_min,
  COUNT(CASE WHEN bedrooms_max IS NOT NULL THEN 1 END) as with_bedrooms_max
FROM properties;
