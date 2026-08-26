-- ============================================================
-- Add Bedroom Ranges to Leads
-- Migration: Support leads with bedroom range requirements
-- ============================================================

-- Add bedroom range columns to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS bedrooms_min INT,
ADD COLUMN IF NOT EXISTS bedrooms_max INT;

-- For leads with existing bedroom values, populate the range
UPDATE leads
SET bedrooms_min = bedrooms,
    bedrooms_max = bedrooms
WHERE bedrooms IS NOT NULL
  AND (bedrooms_min IS NULL OR bedrooms_max IS NULL);

-- Create index for bedroom range queries
CREATE INDEX IF NOT EXISTS idx_leads_bedroom_range ON leads(bedrooms_min, bedrooms_max);

-- Summary statistics
SELECT 
  'leads' as table_name,
  COUNT(*) as total,
  COUNT(CASE WHEN bedrooms IS NOT NULL THEN 1 END) as with_old_bedrooms,
  COUNT(CASE WHEN bedrooms_min IS NOT NULL THEN 1 END) as with_bedrooms_min,
  COUNT(CASE WHEN bedrooms_max IS NOT NULL THEN 1 END) as with_bedrooms_max
FROM leads;
