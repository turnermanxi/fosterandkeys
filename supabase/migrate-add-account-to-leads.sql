-- ============================================================
-- Add Account Isolation to Leads
-- Migration: Add account_id to leads for multi-account SaaS support
-- IMPORTANT: This is SAFE - it only adds a column, doesn't delete data
-- ============================================================

-- Step 1: Add account_id column to leads table (nullable at first)
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

-- Step 2: Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_leads_account_id ON leads(account_id);
CREATE INDEX IF NOT EXISTS idx_leads_account_created ON leads(account_id, created_at DESC);

-- Step 3: IMPORTANT - Assign existing leads to Lorenzo's account
-- This ensures Lorenzo's existing leads don't disappear!
-- Step 3a: Find Lorenzo's account (by email - adjust if needed)
-- Step 3b: Assign all leads without account_id to that account

-- First, check what accounts exist:
SELECT id, user_id, email, name FROM accounts;

-- Then, use this to assign leads to the correct account:
-- (Replace 'YOUR_ACCOUNT_ID' with Lorenzo's actual account UUID from above)
-- UPDATE leads SET account_id = 'YOUR_ACCOUNT_ID' WHERE account_id IS NULL;

-- Step 4: Summary - verify migration worked
SELECT
  'leads' as table_name,
  COUNT(*) as total_leads,
  COUNT(CASE WHEN account_id IS NOT NULL THEN 1 END) as with_account_id,
  COUNT(CASE WHEN account_id IS NULL THEN 1 END) as without_account_id,
  COUNT(DISTINCT account_id) as unique_accounts
FROM leads;
