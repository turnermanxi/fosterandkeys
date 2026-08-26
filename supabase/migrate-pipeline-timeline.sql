-- ============================================================
-- Migration: Add Pipeline Timeline & Status Tracking
-- Adds JSONB timeline, recommended units, tour details, and application tracking
-- ============================================================

-- Add new columns to leads table for the pipeline workflow
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS current_status TEXT DEFAULT 'created',
ADD COLUMN IF NOT EXISTS timeline JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS recommended_units JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS tour_details JSONB,
ADD COLUMN IF NOT EXISTS application_status JSONB DEFAULT '{"status": "pending", "applied_at": null, "decision": null, "decision_at": null, "denial_reason": null}',
ADD COLUMN IF NOT EXISTS follow_up_needed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS follow_up_reminder_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cx_feedback TEXT,
ADD COLUMN IF NOT EXISTS commission_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS commission_confirmed_at TIMESTAMPTZ;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_leads_current_status ON leads(current_status);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON leads(follow_up_needed);
CREATE INDEX IF NOT EXISTS idx_leads_application_status ON leads USING gin(application_status);

-- Add helpful trigger comment
COMMENT ON COLUMN leads.timeline IS 'JSONB array of timeline events: [{"stage": "created|recommended_sent|tour_scheduled|tour_completed|application_submitted|approved|denied", "timestamp": "ISO8601", "notes": "...", "data": {...}}]';
COMMENT ON COLUMN leads.current_status IS 'Quick reference for current pipeline stage: created|recommended_sent|cx_responded|tour_scheduled|tour_confirmation_sent|tour_completed|application_pending|application_submitted|approved|denied|commission_confirmed';
COMMENT ON COLUMN leads.recommended_units IS 'JSON array of recommended units: [{"unit_id": 123, "apartment_id": 456, "score": 95, "sent_at": "ISO8601", "cx_response": "interested|not_interested"}]';
COMMENT ON COLUMN leads.tour_details IS 'JSON: {date: "YYYY-MM-DD", time: "HH:MM", location: "apartment_name", confirmation_sent_at: "ISO8601", location_notes: "..."}';
COMMENT ON COLUMN leads.application_status IS 'JSON: {status: "pending|submitted|approved|denied", applied_at: "ISO8601", decision: "approved|denied", decision_at: "ISO8601", denial_reason: "..."}';
