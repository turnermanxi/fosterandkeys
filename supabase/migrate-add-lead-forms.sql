-- ============================================================
-- Lead Intake Forms
-- Migration: Account-scoped intake forms powering three channels:
--   1. Hosted page at /in/:slug
--   2. Embeddable iframe at /embed/:slug
--   3. Google Forms / external webhook pointing to /api/webhook/forms/:slug
-- Fixed lead fields are defined in app code; this stores the cosmetic
-- configuration (branding) plus per-account webhook secret for channel 3.
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_forms (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,
  name          TEXT DEFAULT 'Lead Intake',
  branding      JSONB DEFAULT '{}',   -- { logo_url, primary_color, headline, subheadline, success_message }
  webhook_secret TEXT,                -- shared secret for Google Forms / external webhook channel
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_lead_forms_account ON lead_forms(account_id);
CREATE INDEX IF NOT EXISTS idx_lead_forms_slug ON lead_forms(slug);

-- Backfill a default form for every existing account so tenants instantly
-- have a working hosted page. Slug matches the account slug.
INSERT INTO lead_forms (account_id, slug, name)
SELECT id, slug, 'Lead Intake'
FROM accounts
WHERE NOT EXISTS (
  SELECT 1 FROM lead_forms f WHERE f.account_id = accounts.id
);

-- Summary
SELECT
  COUNT(*) as total_forms,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_forms,
  COUNT(CASE WHEN webhook_secret IS NOT NULL THEN 1 END) as with_webhook_secret
FROM lead_forms;