-- ============================================================
-- Add Contact & Address Fields to Apartments
-- Migration: Add fields to store synced contact info and address
-- ============================================================

-- Add address fields to apartments table
ALTER TABLE apartments 
ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE apartments 
ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'TX';

ALTER TABLE apartments 
ADD COLUMN IF NOT EXISTS zip TEXT;

-- Add contact fields to apartments table
ALTER TABLE apartments 
ADD COLUMN IF NOT EXISTS contact_name TEXT;

ALTER TABLE apartments 
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

ALTER TABLE apartments 
ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- Add other useful fields
ALTER TABLE apartments 
ADD COLUMN IF NOT EXISTS website TEXT;

-- Create indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_apartments_address ON apartments(city, address);
CREATE INDEX IF NOT EXISTS idx_apartments_contact_email ON apartments(contact_email);

-- Summary
SELECT 
  'apartments' as table_name,
  COUNT(*) as total,
  COUNT(CASE WHEN address IS NOT NULL THEN 1 END) as with_address,
  COUNT(CASE WHEN contact_name IS NOT NULL THEN 1 END) as with_contact
FROM apartments;
