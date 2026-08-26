-- ============================================================
-- Migration: Add Multi-Round Reschedule Support
-- Allows leads to go through multiple rounds of recommendations
-- and be reassigned to other agents via email
-- ============================================================

-- Add columns for multi-round support and agent assignment
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS current_round INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS assigned_agent_email TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS match_history JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS tour_history JSONB DEFAULT '[]';

-- Create index for agent assignment queries
CREATE INDEX IF NOT EXISTS idx_leads_assigned_agent ON leads(assigned_agent_email);
CREATE INDEX IF NOT EXISTS idx_leads_current_round ON leads(current_round);

-- Add helpful comments
COMMENT ON COLUMN leads.current_round IS 'Track which round of recommendations the lead is on (1, 2, 3, etc.)';
COMMENT ON COLUMN leads.assigned_agent_email IS 'Email of the agent this lead has been forwarded to';
COMMENT ON COLUMN leads.match_history IS 'Archive of match recommendations from all rounds: [{"round": 1, "matches": [...], "sent_at": "..."}]';
COMMENT ON COLUMN leads.tour_history IS 'Archive of all tour details: [{"round": 1, "tours": [...], "scheduled_at": "..."}]';
