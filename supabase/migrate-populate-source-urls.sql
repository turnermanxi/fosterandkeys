-- ============================================================
-- Auto-populate source_url from existing website/url fields
-- Run this AFTER applying the migrate-add-property-sync.sql migration
-- ============================================================

-- First, add source_url column to apartments table if it doesn't exist
ALTER TABLE apartments 
ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Populate source_url from website field for properties
UPDATE properties 
SET source_url = website 
WHERE source_url IS NULL 
  AND website IS NOT NULL 
  AND website != '';

-- Populate source_url from url field for apartments
UPDATE apartments 
SET source_url = url 
WHERE source_url IS NULL 
  AND url IS NOT NULL 
  AND url != '';

-- Show summary
SELECT 
  'properties' as table_name,
  COUNT(*) as total,
  COUNT(CASE WHEN source_url IS NOT NULL THEN 1 END) as with_source_url,
  COUNT(CASE WHEN source_url IS NULL THEN 1 END) as without_source_url
FROM properties

UNION ALL

SELECT 
  'apartments' as table_name,
  COUNT(*) as total,
  COUNT(CASE WHEN source_url IS NOT NULL THEN 1 END) as with_source_url,
  COUNT(CASE WHEN source_url IS NULL THEN 1 END) as without_source_url
FROM apartments;
