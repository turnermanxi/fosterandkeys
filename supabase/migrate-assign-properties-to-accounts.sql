-- ============================================================
-- Assign Existing Properties to Accounts
-- Migration: Tie existing properties to correct account
-- ============================================================

-- Step 1: Check which properties don't have account_id
SELECT id, property_name, address, account_id 
FROM properties 
WHERE account_id IS NULL
LIMIT 10;

-- Step 2: Get Lorenzo's account ID
SELECT id, email FROM accounts WHERE email = 'lorenzo@fosterandkeys.com';

-- Step 3: Assign existing properties to Lorenzo's account
-- (Replace 'YOUR_ACCOUNT_ID' with Lorenzo's account ID from Step 2)
UPDATE properties 
SET account_id = 'YOUR_ACCOUNT_ID'
WHERE account_id IS NULL;

-- Step 4: Verify
SELECT 
  COUNT(*) as total_properties,
  COUNT(CASE WHEN account_id IS NOT NULL THEN 1 END) as with_account,
  COUNT(CASE WHEN account_id IS NULL THEN 1 END) as without_account
FROM properties;

-- Step 5: Verify property tags are also assigned (same account)
UPDATE property_tags 
SET account_id = (
  SELECT account_id FROM properties 
  WHERE id = property_tags.property_id
)
WHERE account_id IS NULL;

-- Step 6: Verify property notes are also assigned (same account)
UPDATE property_notes 
SET account_id = (
  SELECT account_id FROM properties 
  WHERE id = property_notes.property_id
)
WHERE account_id IS NULL;
