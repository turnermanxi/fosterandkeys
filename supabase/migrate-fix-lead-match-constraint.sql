-- Drop the problematic check constraint entirely
-- This allows apartment_id to work alongside unit_id and property_id
ALTER TABLE lead_matches
DROP CONSTRAINT IF EXISTS lead_match_type_check;

-- We'll rely on foreign key constraints and app logic instead of database constraints
-- to ensure data integrity
