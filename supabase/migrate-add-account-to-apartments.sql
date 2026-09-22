-- ============================================================
-- Add Account Isolation to Apartments
-- Migration: Add account_id to apartments for multi-tenant SaaS support
-- Apartments were previously a global/shared table with no owner.
-- ============================================================

-- Step 1: Add account_id column (nullable first so existing rows survive)
ALTER TABLE apartments
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

-- Step 2: Create indexes for fast per-account queries
CREATE INDEX IF NOT EXISTS idx_apartments_account_id ON apartments(account_id);
CREATE INDEX IF NOT EXISTS idx_apartments_account_city ON apartments(account_id, city);
CREATE INDEX IF NOT EXISTS idx_apartments_account_metro ON apartments(account_id, metro_area);

-- Step 3: Backfill existing apartments to the oldest account.
-- This assigns all currently-unowned apartments to the first account as a
-- safety default (typically the original admin's account). After verifying,
-- any remaining NULL account_id rows are orphan-data that must be corrected.
UPDATE apartments
SET account_id = (
  SELECT id FROM accounts ORDER BY created_at ASC, id ASC LIMIT 1
)
WHERE account_id IS NULL;

-- Step 4: Drop the temporary RLS policy block if applied previously,
-- then re-create policies only if RLS is enabled (not by default here).
-- Enforcement happens in application code via account_id filtering.

-- Step 5: Summary
SELECT
  'apartments' as table_name,
  COUNT(*) as total,
  COUNT(CASE WHEN account_id IS NOT NULL THEN 1 END) as with_account_id,
  COUNT(CASE WHEN account_id IS NULL THEN 1 END) as without_account_id,
  COUNT(DISTINCT account_id) as unique_accounts
FROM apartments;