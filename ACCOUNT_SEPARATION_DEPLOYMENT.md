# Account Separation - Testing & Deployment Guide

## What Was Implemented

Your project now has a **complete account separation system** with multi-tenant support. Every lead API endpoint now requires:

1. **Authentication** - User must be logged in via Supabase Auth
2. **Authorization** - User can only access leads belonging to their account
3. **Data Isolation** - Each user/account sees only their own data

### Files Modified

**New Files:**
- `supabase/migrate-add-account-to-leads.sql` - Database migration
- `src/lib/api-auth.js` - Account verification utilities

**Enhanced Files:**
- `src/lib/supabase.js` - Added `getSupabaseUser()` and `getUserAccount()`

**Protected Endpoints (14 total):**
- `src/app/api/leads/route.js` - GET
- `src/app/api/leads/[id]/matches/route.js` - GET
- `src/app/api/leads/[id]/send/route.js` - POST
- `src/app/api/leads/[id]/send-to-agent/route.js` - POST
- `src/app/api/leads/[id]/update-status/route.js` - POST
- `src/app/api/leads/[id]/schedule-tour/route.js` - POST
- `src/app/api/leads/[id]/confirm-tour/route.js` - POST
- `src/app/api/leads/[id]/add-property/route.js` - POST
- `src/app/api/leads/[id]/preferences/route.js` - POST
- `src/app/api/leads/[id]/manual-properties/route.js` - GET
- `src/app/api/leads/[id]/set-followup/route.js` - POST
- `src/app/api/leads/[id]/request-reschedule/route.js` - POST
- `src/app/api/leads/[id]/send-application-reminder/route.js` - POST
- `src/app/api/leads/[id]/update-application-status/route.js` - POST

---

## Deployment Steps

### Step 1: Run the Database Migration

You need to add the `account_id` column to your Supabase leads table:

```bash
# 1. Go to Supabase Dashboard → SQL Editor
# 2. Copy & paste the contents of this file:
supabase/migrate-add-account-to-leads.sql

# 3. Execute the migration
# You should see output confirming index creation and summary query
```

### Step 2: Handle Existing Leads

If you have existing leads without `account_id`, you need to assign them:

```sql
-- Get a list of all accounts
SELECT id, user_id, email FROM accounts;

-- Assign all leads to the first/primary account (for testing)
UPDATE leads 
SET account_id = '{{ ACCOUNT_ID_HERE }}' 
WHERE account_id IS NULL;

-- Verify the update
SELECT COUNT(*) as total_leads, 
       COUNT(account_id) as with_account,
       COUNT(CASE WHEN account_id IS NULL THEN 1 END) as without_account
FROM leads;
```

### Step 3: Deploy to Production

```bash
# Build and deploy as normal
npm run build
npm run start

# Or deploy to Netlify
# Commit changes and Netlify will auto-deploy
```

---

## Testing Account Separation

### Test 1: Single User Access

```bash
# Start dev server
npm run dev

# 1. Login with your account
# 2. Navigate to /dashboard
# 3. You should see your leads

# Expected: ✅ Leads display normally
```

### Test 2: Verify Authentication Required

```bash
# In a terminal, test an API endpoint without authentication:
curl http://localhost:3000/api/leads

# Expected: ❌ 401 Unauthorized
# Message: "Unauthorized"
```

### Test 3: Verify Ownership Check

```bash
# Replace SOME_OTHER_LEAD_ID with any lead ID that exists
curl -H "Authorization: Bearer $YOUR_TOKEN" \
  http://localhost:3000/api/leads/SOME_OTHER_LEAD_ID/matches

# If the lead exists but doesn't belong to your account:
# Expected: ❌ 403 Forbidden
# Message: "Forbidden: Lead does not belong to your account"
```

### Test 4: Multi-Account Scenario (Advanced)

This requires creating multiple Supabase Auth users:

```bash
# Terminal 1: Chrome - User A
1. npm run dev
2. Open http://localhost:3000
3. Login/Signup as user-a@example.com
4. Create a few leads
5. Note the lead IDs

# Terminal 2: Firefox - User B (different browser profile)
1. Open http://localhost:3000 (same dev server)
2. Login/Signup as user-b@example.com
3. Try to access User A's lead:
   - Run in browser console:
   - fetch('/api/leads/{{ USER_A_LEAD_ID }}')
     .then(r => r.json())
     .then(console.log)

# Expected: 403 Forbidden
```

---

## What Security Issues This Fixes

### Before Account Separation ❌

```javascript
// OLD CODE - INSECURE!
export async function GET(request, { params }) {
  const { id } = await params;
  // Gets ANY lead regardless of who's asking
  const lead = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();
  return lead; // ⚠️ Possible leak!
}
```

**Vulnerability:** User A could fetch User B's leads by guessing lead IDs

### After Account Separation ✅

```javascript
// NEW CODE - SECURE!
export async function GET(request, { params }) {
  const { id } = await params;
  
  // 1. Verify user is logged in
  const user = await getSupabaseUser();
  if (!user) return 401; // Not logged in
  
  // 2. Verify user has an account
  const account = await getUserAccount();
  if (!account) return 404; // No account found
  
  // 3. Verify lead belongs to this account
  const lead = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .eq("account_id", account.id) // ✅ Account filter!
    .single();
  
  if (!lead) return 403; // Forbidden
  return lead; // ✅ Only if authorized
}
```

---

## Next: Landing Page & Signup

Once account separation is tested and working, you can build:

1. **Landing Page** (`/`)
   - Hero section
   - Demo/testimonials
   - Pricing table

2. **Signup Flow** (`/signup`)
   - Form captures customer info
   - Creates Supabase Auth user
   - Creates account record
   - Assigns subscription plan
   -  Applies promo code if provided

3. **Subscription Table** (`subscriptions`)
   - Plan: free, pro, enterprise
   - Status: active, cancelled, etc.
   - Promo codes with discount logic

---

## Common Issues & Fixes

### Issue: "Account not found" error

**Cause:** User has Supabase Auth but no account record

**Fix:**
```sql
-- Manually create account for testing
INSERT INTO accounts (user_id, email, name) 
VALUES ('{{ USER_ID }}', 'test@example.com', 'Test User');
```

### Issue: Build fails with "Cannot find module api-auth"

**Cause:** Didn't save the new file or import is incorrect

**Fix:**
```bash
# Verify the file exists:
ls -la src/lib/api-auth.js

# Rebuild:
npm run build
```

### Issue: Existing leads show as empty

**Cause:** Existing leads don't have `account_id` set

**Fix:**
```sql
-- Run the migration again:
UPDATE leads SET account_id = '{{ ACCOUNT_ID }}' WHERE account_id IS NULL;
```

---

## Performance Considerations

The new indexes created in the migration will speed up:
- Account-based lead queries: `idx_leads_account_id`
- Dashboard "newest first" queries: `idx_leads_account_created`

---

## Questions or Issues?

1. Check [ACCOUNT_SEPARATION_PROGRESS.md](ACCOUNT_SEPARATION_PROGRESS.md) for detailed implementation notes
2. Review the new authorization functions in [src/lib/api-auth.js](src/lib/api-auth.js)
3. Check [TESTING_ACCOUNT_SEPARATION_SETUP.md](TESTING_ACCOUNT_SEPARATION_SETUP.md) for more info
