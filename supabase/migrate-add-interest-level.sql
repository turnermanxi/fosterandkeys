-- Add interest_level column to lead_matches for tour confirmation feedback
ALTER TABLE lead_matches
ADD COLUMN IF NOT EXISTS interest_level TEXT DEFAULT NULL; -- 'not_visited', 'not_interested', 'interested', 'very_interested'

-- Add property_feedback column to leads to track per-property feedback
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS property_feedback JSONB DEFAULT NULL;

-- Create index for interest level queries
CREATE INDEX IF NOT EXISTS idx_lead_matches_interest ON lead_matches(interest_level);
