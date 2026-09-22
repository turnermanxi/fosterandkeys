-- ============================================================
-- Per-Account Gmail Configuration
-- Migration: Each account connects their own Gmail mailbox for
-- inbound lead emails, replacing the single shared DEFAULT_ACCOUNT_ID.
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

-- Summary
SELECT
  COUNT(*) as total_configs,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_configs
FROM gmail_configs;