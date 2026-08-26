-- ============================================================
-- Add Square Footage Ranges for Properties
-- Migration: Support multiple floor plans with sqft min/max
-- ============================================================

-- Add sqft range columns to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS sqft_min INT;

ALTER TABLE properties
ADD COLUMN IF NOT EXISTS sqft_max INT;

-- For properties that already have sqft, populate the ranges
UPDATE properties
SET sqft_min = sqft,
    sqft_max = sqft
WHERE sqft IS NOT NULL
  AND (sqft_min IS NULL OR sqft_max IS NULL);

-- Create indexes for range queries
CREATE INDEX IF NOT EXISTS idx_properties_sqft_range ON properties(sqft_min, sqft_max);

-- Summary statistics
SELECT 
  'properties' as table_name,
  COUNT(*) as total,
  COUNT(CASE WHEN sqft IS NOT NULL THEN 1 END) as with_old_sqft,
  COUNT(CASE WHEN sqft_min IS NOT NULL THEN 1 END) as with_sqft_min,
  COUNT(CASE WHEN sqft_max IS NOT NULL THEN 1 END) as with_sqft_max
FROM properties;
