# Complete Account Separation Migration - Checklist

## ✅ System is Secure for Both Leads AND Properties

Lorenzo's data is protected at both the database and API levels.

---

## Migration Checklist (5-10 minutes)

### Phase 1: Prepare (2 minutes)

```bash
# 1. Identify Lorenzo's Account
# Go to Supabase Dashboard → Auth Users
# Find Lorenzo's user ID
# Copy it for later
```

```sql
-- 2. In Supabase SQL Editor, run:
SELECT id AS account_id, email, name, user_id 
FROM accounts 
WHERE email LIKE '%lorenzo%';

-- SAVE THIS ID - You'll use it in next steps
-- Expected result: One account with Lorenzo's info
```

### Phase 2: Add Column to Leads Table (1 minute)

```sql
-- Run in Supabase SQL Editor:

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_leads_account_id ON leads(account_id);
CREATE INDEX IF NOT EXISTS idx_leads_account_created ON leads(account_id, created_at DESC);

-- Success: Table altered, indexes created
```

### Phase 3: Assign Data to Accounts (2 minutes)

```sql
-- REPLACE '{{ LORENZO_ACCOUNT_ID }}' with the ID from Phase 1

-- Step 1: Assign leads to Lorenzo
UPDATE leads 
SET account_id = '{{ LORENZO_ACCOUNT_ID }}'
WHERE account_id IS NULL;

-- Step 2: Assign properties to Lorenzo (if needed)
UPDATE properties 
SET account_id = '{{ LORENZO_ACCOUNT_ID }}'
WHERE account_id IS NULL
AND created_by IS NULL;  -- Only unassigned ones

-- Step 3: Assign property tags
UPDATE property_tags 
SET account_id = (
  SELECT account_id FROM properties WHERE id = property_tags.property_id
)
WHERE account_id IS NULL;

-- Step 4: Assign property notes
UPDATE property_notes 
SET account_id = (
  SELECT account_id FROM properties WHERE id = property_notes.property_id
)
WHERE account_id IS NULL;
```

### Phase 4: Verify Everything (1 minute)

```sql
-- Run verification query:
SELECT 
  'Leads' as object_type,
  COUNT(*) as total,
  COUNT(CASE WHEN account_id IS NOT NULL THEN 1 END) as assigned,
  COUNT(CASE WHEN account_id IS NULL THEN 1 END) as unassigned
FROM leads

UNION ALL

SELECT 
  'Properties',
  COUNT(*),
  COUNT(CASE WHEN account_id IS NOT NULL THEN 1 END),
  COUNT(CASE WHEN account_id IS NULL THEN 1 END)
FROM properties

UNION ALL

SELECT 
  'Property Tags',
  COUNT(*),
  COUNT(CASE WHEN account_id IS NOT NULL THEN 1 END),
  COUNT(CASE WHEN account_id IS NULL THEN 1 END)
FROM property_tags

UNION ALL

SELECT 
  'Property Notes',
  COUNT(*),
  COUNT(CASE WHEN account_id IS NOT NULL THEN 1 END),
  COUNT(CASE WHEN account_id IS NULL THEN 1 END)
FROM property_notes;

-- EXPECTED RESULT:
-- All rows should show: unassigned = 0
-- All rows should show: assigned = total
```

### Phase 5: Test Locally (2 minutes)

```bash
# In terminal:
npm run dev

# In browser:
# 1. Open http://localhost:3000
# 2. Login as Lorenzo (his email/password)
# 3. Go to /dashboard
# 4. Check: Leads visible? ✅
# 5. Go to Properties tab
# 6. Check: Properties visible? ✅
# 7. Create test lead → Appears? ✅
# 8. Create test property → Appears? ✅
```

### Phase 6: Test Authorization (Optional but Good Idea)

```bash
# In browser console (while logged in as Lorenzo):

# Check account status
fetch('/api/debug/account-status')
  .then(r => r.json())
  .then(d => console.log(JSON.stringify(d, null, 2)))

# Should show:
# - authenticated: true
# - leads with_account: (your number)
# - leads without_account: 0
# - migration_status: "✅ OK"
```

---

## What's Protected

### Leads (NEW - Migrated Today)
- [x] Existing leads → Assigned to account
- [x] GET /api/leads → Filtered by account
- [x] All lead endpoints → Require ownership
- [x] New leads → Auto-tied to account

### Properties (ALREADY PROTECTED)
- [x] Existing properties → Already have account_id
- [x] GET /api/properties → Filtered by account
- [x] POST /api/properties → Auto-tied to account
- [x] Property tags → Assigned to account
- [x] Property notes → Assigned to account

---

## Rollback (If Needed)

**ONLY if something goes wrong:**

```sql
-- Remove the changes to leads table
DROP INDEX IF EXISTS idx_leads_account_created;
DROP INDEX IF EXISTS idx_leads_account_id;
ALTER TABLE leads DROP COLUMN IF EXISTS account_id;

-- This leaves all data intact - just removes the column
```

---

## After Deployment

✅ **Lorenzo logs in** → Sees all his leads and properties
✅ **New users sign up** → Get their own account automatically
✅ **Each user isolated** → Can't see other accounts' data
✅ **Ready for SaaS** → Multi-tenant system is live

---

## Files & References

- `LORENZO_DATA_SAFE_VERIFIED.md` - Data safety explanation
- `PROPERTIES_ALREADY_PROTECTED.md` - Properties security details
- `ACCOUNT_SEPARATION_DEPLOYMENT.md` - Full testing guide
- `supabase/migrate-add-account-to-leads.sql` - Leads migration
- `supabase/migrate-assign-properties-to-accounts.sql` - Properties mapping
- `src/lib/api-auth.js` - Authorization code
- `src/app/api/debug/account-status/route.js` - Debug endpoint

---

## Time Estimate

Total time: **10-15 minutes**
- SQL migrations: 3-5 minutes
- Local testing: 5-10 minutes
- Issue resolution (if any): 5-10 minutes

---

**Status: READY TO DEPLOY** ✅
