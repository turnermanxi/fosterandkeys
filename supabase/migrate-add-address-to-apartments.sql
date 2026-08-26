-- ============================================================
-- Add Address Fields to Apartments Table
-- Migration: Support complete address information on apartments
-- ============================================================

-- Add address, state, and zip fields to apartments table if not already present
ALTER TABLE apartments
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'TX',
ADD COLUMN IF NOT EXISTS zip TEXT;

-- Create index for address queries
CREATE INDEX IF NOT EXISTS idx_apartments_address
  ON apartments(address);

CREATE INDEX IF NOT EXISTS idx_apartments_city_state
  ON apartments(city, state);

-- Summary: Show updated apartments table structure
SELECT
  'apartments' as table_name,
  COUNT(*) as total,
  COUNT(CASE WHEN address IS NOT NULL THEN 1 END) as with_address,
  COUNT(CASE WHEN city IS NOT NULL THEN 1 END) as with_city,
  COUNT(CASE WHEN state IS NOT NULL THEN 1 END) as with_state,
  COUNT(CASE WHEN zip IS NOT NULL THEN 1 END) as with_zip
FROM apartments;
