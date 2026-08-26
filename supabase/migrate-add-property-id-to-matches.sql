-- Add property_id column to lead_matches to support manual properties
ALTER TABLE lead_matches
ADD COLUMN property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
ADD COLUMN cx_response TEXT DEFAULT NULL,  -- 'interested', 'not_interested', or NULL
ADD COLUMN toured_status TEXT DEFAULT NULL,  -- 'toured', 'not_toured', or NULL
ADD COLUMN toured_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN sent_at TIMESTAMPTZ DEFAULT NULL;

-- Drop the old UNIQUE constraint that only allows unit_id
ALTER TABLE lead_matches
DROP CONSTRAINT IF EXISTS lead_matches_lead_id_unit_id_key;

-- Create partial unique indexes to handle NULL values correctly
-- For unit matches: (lead_id, unit_id) must be unique when property_id is NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_unit_match ON lead_matches(lead_id, unit_id) WHERE property_id IS NULL;

-- For property matches: (lead_id, property_id) must be unique when unit_id is NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_property_match ON lead_matches(lead_id, property_id) WHERE unit_id IS NULL;
-- Create index for property lookups
CREATE INDEX IF NOT EXISTS idx_lead_matches_property ON lead_matches(property_id);

-- Add check constraint to ensure exactly one of unit_id, property_id, or apartment_id is set
ALTER TABLE lead_matches
DROP CONSTRAINT IF EXISTS lead_match_type_check;

ALTER TABLE lead_matches
ADD CONSTRAINT lead_match_type_check CHECK (
  (unit_id IS NOT NULL AND property_id IS NULL AND apartment_id IS NULL) OR 
  (unit_id IS NULL AND property_id IS NOT NULL AND apartment_id IS NULL) OR
  (unit_id IS NULL AND property_id IS NULL AND apartment_id IS NOT NULL)
);