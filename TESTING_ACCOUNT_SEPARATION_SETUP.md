# Testing & Account Separation Setup Guide

## 🚀 Getting Started with Testing (Right Now)

Your project is **ready to test**. All environment variables are configured:

### Quick Start - 30 seconds

```bash
# Terminal 1: Start development server
cd /home/turnermanxi/Documents/fosterandkeys
npm install  # (only first time)
npm run dev

# Terminal 2: In another terminal, run tests
npm run test:sync

# Terminal 3: Browse to demos
# Visit: http://localhost:3000/demo/sync
```

### Environment Status ✅

Your `.env.local` has these configured:
- ✅ Supabase URL & Keys (JWT tokens set up)
- ✅ OpenAI API Key (gpt-4o-mini enabled)
- ✅ Gmail credentials (intakefosterandkeys@gmail.com configured)
- ✅ Webhook secret (for cron jobs)
- ✅ Base URL (http://localhost:3000)

---

## 📊 Current Architecture Issues for Account Separation

### The Problem

Currently, the leads API endpoint (`/api/leads`) returns **ALL leads** in the database without filtering by account. This needs to be fixed for multi-account support.

**Current flaw:**
```javascript
// ❌ WRONG - Returns all leads regardless of user
const { data: leads } = await supabase.from("leads").select("*");
```

### What Needs Fixing

1. **Leads Table** - Needs `account_id` column to link each lead to an account
2. **Authentication** - API endpoints need to check current user and their account
3. **Data Isolation** - Each endpoint should filter by `account_id` automatically
4. **Dashboard** - Should only show leads for the logged-in user's account

---

## 🔧 Implementation Steps for Account Separation

### Step 1: Add account_id to Leads Table

Create a new migration file (`supabase/migrate-add-account-to-leads.sql`):

```sql
-- Add account_id to leads table for multi-account support
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_leads_account_id ON leads(account_id);

-- For existing leads without account_id, assign to a default account
-- (This is temporary - in production, you'd handle this differently)
UPDATE leads 
SET account_id = (SELECT id FROM accounts LIMIT 1) 
WHERE account_id IS NULL;

-- Make account_id NOT NULL after populating
ALTER TABLE leads ALTER COLUMN account_id SET NOT NULL;
```

### Step 2: Fix API Endpoints to Use Current User

**Pattern to apply to all API endpoints:**

```javascript
import { getSupabaseUser, getSupabaseAdmin } from "@/lib/supabase";

export async function GET(req) {
  try {
    // 1. Get current user
    const user = await getSupabaseUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 2. Get user's account
    const supabase = getSupabaseAdmin();
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // 3. Query with account filter
    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .eq("account_id", account.id);
      // ✅ NOW only returns this user's leads

    if (error) throw error;
    return NextResponse.json(leads);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

### Step 3: Endpoints to Fix

These endpoints need the account filtering applied:

1. `/api/leads` - Get all leads for account ✅ CRITICAL
2. `/api/leads/[id]/*` - All lead detail endpoints
3. `/api/properties` - Get properties for account
4. `/api/apartments` - Get apartments for account
5. `/api/demo/*` - Demo endpoints (for testing)

---

## ✅ Checklist for Account Separation

- [ ] Create migration to add `account_id` to leads table
- [ ] Apply migration in Supabase
- [ ] Fix `/api/leads` endpoint (add user authentication + account filtering)
- [ ] Fix `/api/leads/[id]/matches` endpoint
- [ ] Fix `/api/leads/[id]/properties` endpoint
- [ ] Update `/api/leads/[id]/send` to check account ownership
- [ ] Fix `/api/properties` endpoint
- [ ] Update login flow to ensure user has an account record
- [ ] Test multi-user scenario with separate dashboards
- [ ] Test that User A cannot see User B's leads/properties

---

## 🧪 Testing Multi-Account Setup

Once implemented:

```bash
# Test 1: Login as User A
# - See User A's leads only

# Test 2: Open another browser / incognito
# - Login as User B
# - See User B's leads only (NOT User A's)
# - Create a new lead
# - Verify it appears only in User B's dashboard

# Test 3: Try to access User A's lead via direct API
# GET /api/leads/user-a-lead-id
# - Should return 403 Forbidden (not 200)
```

---

## 📁 Key Files to Review

- `src/app/api/leads/route.js` - *Main leads endpoint (NEEDS FIX)*
- `src/app/dashboard/page.js` - Dashboard component
- `src/lib/supabase.js` - Authentication helpers
- `supabase/migrate-add-properties.sql` - Current accounts table structure
- `src/app/login/page.js` - Login flow (may need to create account)

---

## 🚀 Next Actions

1. **Right now:** Run tests using existing setup
2. **Today:** Create the account_id migration
3. **This week:** Fix the API endpoints one by one
4. **Then:** Test full multi-account scenario

Ready to proceed? Let me know which step you'd like me to implement first!
