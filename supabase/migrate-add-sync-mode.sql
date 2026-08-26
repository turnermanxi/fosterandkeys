-- ============================================================
-- Add Sync Mode Support (Simple vs Advanced/Vision)
-- Migration: Add sync mode tracking and per-property preferences
-- ============================================================

-- 1. Add sync_mode to properties table (simple or advanced)
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS sync_mode TEXT DEFAULT 'simple' CHECK (sync_mode IN ('simple', 'advanced'));

-- 2. Add sync_mode to apartments table (for consistency)
ALTER TABLE apartments 
ADD COLUMN IF NOT EXISTS sync_mode TEXT DEFAULT 'simple' CHECK (sync_mode IN ('simple', 'advanced'));

-- 3. Add sync_mode to property_sync_logs to track which mode was used
ALTER TABLE property_sync_logs 
ADD COLUMN IF NOT EXISTS sync_mode TEXT DEFAULT 'simple' CHECK (sync_mode IN ('simple', 'advanced'));

-- 4. Add extraction_method to property_sync_logs for audit trail
ALTER TABLE property_sync_logs 
ADD COLUMN IF NOT EXISTS extraction_method TEXT CHECK (extraction_method IN ('html', 'screenshot', 'error'));

-- 5. Create index for sync mode queries
CREATE INDEX IF NOT EXISTS idx_properties_sync_mode ON properties(sync_mode);
CREATE INDEX IF NOT EXISTS idx_apartments_sync_mode ON apartments(sync_mode);
CREATE INDEX IF NOT EXISTS idx_sync_logs_sync_mode ON property_sync_logs(sync_mode);

-- Summary
SELECT 
  'properties' as table_name,
  COUNT(*) as total,
  COUNT(CASE WHEN sync_mode = 'simple' THEN 1 END) as simple_mode,
  COUNT(CASE WHEN sync_mode = 'advanced' THEN 1 END) as advanced_mode
FROM properties

UNION ALL

SELECT 
  'apartments' as table_name,
  COUNT(*) as total,
  COUNT(CASE WHEN sync_mode = 'simple' THEN 1 END) as simple_mode,
  COUNT(CASE WHEN sync_mode = 'advanced' THEN 1 END) as advanced_mode
FROM apartments;
