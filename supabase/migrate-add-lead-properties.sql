-- Add lead-property selections table (if not already created via property_sends)
-- This tracks which properties (including apartments) are selected for each lead

-- Create a table for lead-property selections (before sending)
-- property_id can be either a UUID (for properties table) or "apt_X" format (for apartments)
CREATE TABLE IF NOT EXISTS lead_property_selections (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  property_id   TEXT NOT NULL,  -- Can be UUID or "apt_123" format
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  selected_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_property_selections_lead ON lead_property_selections(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_property_selections_property ON lead_property_selections(property_id);
