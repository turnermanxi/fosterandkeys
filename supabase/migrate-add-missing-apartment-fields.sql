-- Add missing acceptance criteria fields to apartments table
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS pet_friendly BOOLEAN DEFAULT NULL;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS accepts_low_credit BOOLEAN DEFAULT NULL;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS accepts_itin BOOLEAN DEFAULT NULL;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS accepts_second_chance BOOLEAN DEFAULT NULL;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS deposit_info TEXT;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS property_type TEXT DEFAULT 'apartment';
