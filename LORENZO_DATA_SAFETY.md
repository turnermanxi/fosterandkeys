# Lorenzo's Data Safety - Account Separation Migration

## ✅ IMPORTANT: Lorenzo's Data Will NOT Be Lost

Here's exactly how to ensure Lorenzo's leads and account stay intact:

---

## The Migration Process (Step-by-Step)

### STEP 1: Check Lorenzo's Current Account

```sql
-- Go to Supabase Dashboard → SQL Editor
-- Run this query:
SELECT id, user_id, email, name FROM accounts;

-- Look for Lorenzo's record. You should see something like:
-- id: f47ac10b-58cc-4372-a567-0e02b2c3d479
-- user_id: (his Supabase Auth UUID)
-- email: (his email)
-- name: (his name)

-- COPY that ID - you'll need it in the next step
```

### STEP 2: Run the Column Addition (Safe - just adds column)

```sql
-- Run this - it ONLY adds a column, doesn't touch any data:
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

-- Create indexes for performance:
CREATE INDEX IF NOT EXISTS idx_leads_account_id ON leads(account_id);
CREATE INDEX IF NOT EXISTS idx_leads_account_created ON leads(account_id, created_at DESC);
```

### STEP 3: Assign Lorenzo's Leads to His Account

```sql
-- THIS IS CRITICAL - assigns his existing leads to his account
-- Replace 'LORENZO_ACCOUNT_ID' with the ID from Step 1

UPDATE leads 
SET account_id = 'LORENZO_ACCOUNT_ID'
WHERE account_id IS NULL;

-- Verify it worked:
SELECT 
  COUNT(*) as total_leads,
  COUNT(CASE WHEN account_id IS NOT NULL THEN 1 END) as with_account,
  COUNT(CASE WHEN account_id IS NULL THEN 1 END) as without_account
FROM leads;

-- Should show: all leads now have account_id
```

### STEP 4: Verify Lorenzo's Data

```sql
-- Check Lorenzo still has all his leads:
SELECT id, full_name, email, account_id FROM leads 
WHERE account_id = 'LORENZO_ACCOUNT_ID';

-- Should show all his existing leads
```

---

## What Happens When Lorenzo Logs In

### Scenario 1: Lorenzo Has an Account Record
```
1. Lorenzo logs in → Supabase authenticates him
2. Dashboard calls GET /api/leads
3. App gets his user_id → finds his account_id from accounts table
4. Query returns: leads WHERE account_id = his_account_id
5. ✅ All his leads display normally
```

### Scenario 2: Lorenzo Has No Account Record (Auto-Create)
```
1. Lorenzo logs in → Supabase authenticates him
2. Dashboard calls GET /api/leads
3. App doesn't find account for his user_id
4. App AUTOMATICALLY creates new account via getOrCreateAccount()
5. ✅ His leads still work because we assigned them in Step 3
```

---

## Safety Guarantees

✅ **His leads won't disappear** - We assign them to his account_id in the SQL migration

✅ **His account is safe** - The `getOrCreateAccount()` function auto-creates if missing

✅ **No data is deleted** - The migration only adds a column (nullable by default)

✅ **Backwards compatible** - The `account_id` column doesn't break existing functionality

---

## Rollback Safety (If Something Goes Wrong)

### If You Need to Undo:

```sql
-- Drop the new columns:
DROP INDEX IF EXISTS idx_leads_account_created;
DROP INDEX IF EXISTS idx_leads_account_id;
ALTER TABLE leads DROP COLUMN IF EXISTS account_id;

-- This leaves all leads intact - just removes the account_id field
```

---

## Complete Checklist

- [ ] **Step 1:** Find Lorenzo's account_id in Supabase
- [ ] **Step 2:** Run the ALTER TABLE statements (add column + indexes)
- [ ] **Step 3:** Run the UPDATE statement to assign leads to Lorenzo
- [ ] **Step 4:** Verify with query - all leads should have account_id
- [ ] **Step 5:** Test locally - Lorenzo logs in and sees his leads
- [ ] **Step 6:** Verify no leads are missing

---

## Testing Locally After Migration

```bash
# Start dev server with your Supabase connected to test DB
npm run dev

# 1. Login as Lorenzo
# 2. Dashboard should load with all his existing leads
# 3. Create a new lead - verify it appears
# 4. Refresh page - verify leads persist

# Test API directly:
# In browser console:
fetch('/api/leads')
  .then(r => r.json())
  .then(d => console.log(`Found ${d.length} leads`))

# Should show all Lorenzo's leads
```

---

## If Lorenzo Hasn't Logged In Yet

If Lorenzo hasn't logged in yet after you apply the migration:

```sql
-- When he logs in for first time:
-- 1. Supabase Auth creates/verifies his user
-- 2. getOrCreateAccount() will automatically create an account record
-- 3. BUT his old leads won't be tied to the new account!

-- To prevent this, make sure to complete Step 3 BEFORE he logs in
```

---

## TL;DR - The Three Commands

```sql
-- 1. Add the column (safe)
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_leads_account_id ON leads(account_id);
CREATE INDEX IF NOT EXISTS idx_leads_account_created ON leads(account_id, created_at DESC);

-- 2. Find Lorenzo's account ID
SELECT id FROM accounts WHERE email = 'lorenzo@fosterandkeys.com';

-- 3. Assign his leads (replace ID with result from step 2)
UPDATE leads SET account_id = 'ACCOUNT_ID_HERE' WHERE account_id IS NULL;
```

**Result:** ✅ Lorenzo logs in → sees all his leads like nothing changed
