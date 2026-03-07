-- ============================================================
-- Foster & Keys — Add property links + acceptance columns
-- Run this in Supabase SQL Editor to add new columns
-- to an EXISTING database without dropping data.
-- ============================================================

ALTER TABLE apartments
  ADD COLUMN IF NOT EXISTS url                  TEXT,
  ADD COLUMN IF NOT EXISTS accepts_broken_lease  BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS accepts_bankruptcy    BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS accepts_eviction      BOOLEAN DEFAULT NULL;

-- Quick sanity check
SELECT slug, url, accepts_broken_lease, accepts_bankruptcy, accepts_eviction
FROM apartments
LIMIT 5;
