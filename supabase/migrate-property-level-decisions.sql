-- ============================================================
-- Migration: Track Property-Level Application Decisions
-- Stores which specific properties were approved/denied for each lead
-- ============================================================

-- Update application_status structure comment to include approved/denied properties
-- application_status now includes:
-- {
--   "status": "pending|submitted|approved|denied",
--   "decision": "approved|denied",
--   "decision_at": "ISO8601",
--   "denial_reason": "...",
--   "approved_units": [{"unit_id": "...", "apartment_name": "...", "bedrooms": 1, "rent_range": "..."}],
--   "denied_units": [{"unit_id": "...", "apartment_name": "...", "bedrooms": 1, "rent_range": "..."}]
-- }

-- Summary
SELECT 'Migration: Property-Level Decision Tracking' as migration_name;
