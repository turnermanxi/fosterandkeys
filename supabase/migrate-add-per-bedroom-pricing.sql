-- ============================================================
-- Add Per-Bedroom Pricing to Properties
-- Migration: Support different price ranges for each bedroom type
-- ============================================================

-- Add per-bedroom pricing columns to properties table
-- Each bedroom type can have its own min/max price range
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS studio_price_min NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS studio_price_max NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS bedroom_1_price_min NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS bedroom_1_price_max NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS bedroom_2_price_min NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS bedroom_2_price_max NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS bedroom_3_price_min NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS bedroom_3_price_max NUMERIC(12,2);

-- Create indexes for efficient queries on per-bedroom pricing
CREATE INDEX IF NOT EXISTS idx_properties_studio_price ON properties(studio_price_min, studio_price_max);
CREATE INDEX IF NOT EXISTS idx_properties_1br_price ON properties(bedroom_1_price_min, bedroom_1_price_max);
CREATE INDEX IF NOT EXISTS idx_properties_2br_price ON properties(bedroom_2_price_min, bedroom_2_price_max);
CREATE INDEX IF NOT EXISTS idx_properties_3br_price ON properties(bedroom_3_price_min, bedroom_3_price_max);

-- Summary: Show new columns added
SELECT 
  'properties' as table_name,
  COUNT(*) as total,
  COUNT(CASE WHEN studio_price_min IS NOT NULL THEN 1 END) as with_studio_pricing,
  COUNT(CASE WHEN bedroom_1_price_min IS NOT NULL THEN 1 END) as with_1br_pricing,
  COUNT(CASE WHEN bedroom_2_price_min IS NOT NULL THEN 1 END) as with_2br_pricing,
  COUNT(CASE WHEN bedroom_3_price_min IS NOT NULL THEN 1 END) as with_3br_pricing
FROM properties;
