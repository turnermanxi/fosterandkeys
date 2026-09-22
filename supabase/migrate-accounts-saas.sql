-- ============================================================
-- SaaS Accounts Fields
-- Migration: Add status, role, and slug to accounts for the
-- self-serve signup -> manual approval -> onboarding flow.
-- ============================================================

-- Step 1: Account lifecycle status
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
  CHECK (status IN ('pending', 'active', 'suspended'));

-- Step 2: Role within the tenant (owner = the signing user). Reserved for
-- future team-member support; every account currently has exactly one user.
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'owner'
  CHECK (role IN ('owner', 'admin', 'member'));

-- Step 3: Unique slug used for public intake URL (/in/:slug) and embeds
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Step 4: Onboarding progress (JSONB bookmark so the wizard can resume)
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS onboarding JSONB DEFAULT '{}';

-- Step 5: Branding for hosted forms / results pages
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}';

-- Step 6: Backfill status for existing accounts so the app immediately works
UPDATE accounts
SET status = 'active', role = 'owner'
WHERE status IS NULL OR status = '';

-- Step 7: Generate slugs for any account missing one.
-- Slugs are derived from the account name, made URL-safe, and uniquified.
UPDATE accounts a
SET slug = (
  SELECT LOWER(
    REGEXP_REPLACE(
      COALESCE(NULLIF(a.name, ''), 'account'),
      '[^a-z0-9]+', '-', 'gi'
    )
  ) || '-' || SUBSTRING(a.id::text, 1, 8)
)
WHERE a.slug IS NULL OR a.slug = '';

-- Step 8: Enforce uniqueness (safety check — should never collide due to the
-- id suffix above, but in case two rows end up identical fix them here)
UPDATE accounts a
SET slug = a.slug || '-' || SUBSTRING(a.id::text, 1, 8)
WHERE a.slug IN (
  SELECT slug FROM accounts GROUP BY slug HAVING COUNT(*) > 1
);

-- Step 9: Indexes
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_slug ON accounts(slug);

-- Step 10: Summary
SELECT
  COUNT(*) as total_accounts,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN slug IS NOT NULL THEN 1 END) as with_slug
FROM accounts;