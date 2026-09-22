-- ============================================================
-- Live schema fix — Foster & Keys intake form (2026-09-22)
-- Run this in the Supabase SQL Editor for project
--   lopeltbpgndchqnqhhpl.supabase.co
--
-- Why: the deployed database is missing the multi-tenant columns
-- that the live code queries. The webhook fails with:
--   "column apartments.account_id does not exist"
-- which is why form submissions never reach the leads dashboard.
--
-- Idempotent: safe to run more than once.
-- ============================================================
-- STEP 1 (REQUIRED) — apartments account isolation
-- ============================================================
ALTER TABLE apartments
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_apartments_account_id ON apartments(account_id);
CREATE INDEX IF NOT EXISTS idx_apartments_account_city ON apartments(account_id, city);
CREATE INDEX IF NOT EXISTS idx_apartments_account_metro ON apartments(account_id, metro_area);

-- Backfill existing apartments to Lorenzo's account (the only account),
-- with a safe fallback to the oldest account if the id ever changes.
UPDATE apartments
SET account_id = (
  SELECT id FROM accounts
  WHERE id = '47ef6045-186c-4635-9fa5-3bef67b33a10'
  LIMIT 1
)
WHERE account_id IS NULL
  AND EXISTS (SELECT 1 FROM accounts WHERE id = '47ef6045-186c-4635-9fa5-3bef67b33a10');

UPDATE apartments
SET account_id = (
  SELECT id FROM accounts ORDER BY created_at ASC, id ASC LIMIT 1
)
WHERE account_id IS NULL;

-- ============================================================
-- STEP 2 (recommended) — SaaS account fields (status/slug/role)
-- Required once tenants are exposed via x-account-slug headers,
-- and by hosted forms at /in/:slug.
-- ============================================================
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
  CHECK (status IN ('pending', 'active', 'suspended'));

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'owner'
  CHECK (role IN ('owner', 'admin', 'member'));

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS slug TEXT;

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS onboarding JSONB DEFAULT '{}';

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}';

UPDATE accounts
SET status = 'active', role = 'owner'
WHERE status IS NULL OR status = '';

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

CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_slug ON accounts(slug);

-- ============================================================
-- STEP 3 (recommended) — per-account intake forms config
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_forms (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,
  name          TEXT DEFAULT 'Lead Intake',
  branding      JSONB DEFAULT '{}',
  webhook_secret TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_lead_forms_account ON lead_forms(account_id);
CREATE INDEX IF NOT EXISTS idx_lead_forms_slug ON lead_forms(slug);

INSERT INTO lead_forms (account_id, slug, name)
SELECT id, slug, 'Lead Intake'
FROM accounts
WHERE NOT EXISTS (
  SELECT 1 FROM lead_forms f WHERE f.account_id = accounts.id
);

-- ============================================================
-- STEP 4 (recommended) — per-account Gmail connections
-- ============================================================
CREATE TABLE IF NOT EXISTS gmail_configs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id    UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  gmail_user    TEXT,
  app_password  TEXT,
  folder        TEXT DEFAULT 'INBOX',
  subject_filter TEXT DEFAULT '',
  is_active     BOOLEAN DEFAULT FALSE,
  last_polled_at TIMESTAMPTZ,
  last_poll_error TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gmail_configs_account ON gmail_configs(account_id);
CREATE INDEX IF NOT EXISTS idx_gmail_configs_active ON gmail_configs(is_active) WHERE is_active = true;

-- ============================================================
-- STEP 5 — verify: each summary query should return rows
-- ============================================================
SELECT
  'apartments' AS table_name,
  COUNT(*) AS total,
  COUNT(CASE WHEN account_id IS NOT NULL THEN 1 END) AS with_account_id,
  COUNT(CASE WHEN account_id IS NULL THEN 1 END) AS without_account_id
FROM apartments;