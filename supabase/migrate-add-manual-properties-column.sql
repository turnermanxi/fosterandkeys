-- Add manual_properties JSONB column to leads table
-- This stores manually-added properties/apartments in format:
-- [
--   { property_id: "uuid", apartment_id: null, added_at: "timestamp" },
--   { property_id: null, apartment_id: 123, added_at: "timestamp" }
-- ]

ALTER TABLE leads
ADD COLUMN manual_properties JSONB DEFAULT '[]'::jsonb;
