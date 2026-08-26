-- ============================================================
-- Migration: Add Manual Properties to Leads
-- Allows manually-created properties and apartments to be added to lead matches
-- ============================================================

-- Create table to link manual properties and apartments to leads
CREATE TABLE IF NOT EXISTS lead_manual_properties (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  apartment_id BIGINT REFERENCES apartments(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, property_id),
  UNIQUE(lead_id, apartment_id),
  CHECK (property_id IS NOT NULL OR apartment_id IS NOT NULL)
);

-- Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_lead_manual_properties_lead
  ON lead_manual_properties(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_manual_properties_property
  ON lead_manual_properties(property_id);
CREATE INDEX IF NOT EXISTS idx_lead_manual_properties_apartment
  ON lead_manual_properties(apartment_id);

-- Add comment
COMMENT ON TABLE lead_manual_properties IS 'Links manually-created properties and apartments to leads for the All Matches view';
