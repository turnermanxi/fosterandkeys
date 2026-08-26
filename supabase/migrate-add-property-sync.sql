-- ============================================================
-- Property Sync System
-- Migration: Add automatic property refresh infrastructure
-- ============================================================

-- 1. Add source_url to properties table (if not exists)
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS source_url TEXT;

-- 2. Sync Job Status Tracking
CREATE TABLE IF NOT EXISTS property_sync_jobs (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  started_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  total_properties  INT DEFAULT 0,
  processed_count   INT DEFAULT 0,
  updated_count     INT DEFAULT 0,
  review_count      INT DEFAULT 0,
  failed_count      INT DEFAULT 0,
  status            TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  error_message     TEXT
);

-- 3. Property Sync Logs (detailed history of each property sync)
CREATE TABLE IF NOT EXISTS property_sync_logs (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  property_id       UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  sync_job_id       UUID REFERENCES property_sync_jobs(id) ON DELETE SET NULL,
  
  -- Raw data from source
  source_url        TEXT,
  fetched_html      TEXT,
  fetch_error       TEXT,
  
  -- Extracted data
  extracted_data    JSONB,
  extraction_error  TEXT,
  
  -- Comparison result
  diff_result       JSONB,  -- { field_name, old_value, new_value, changed: boolean }
  needs_review      BOOLEAN DEFAULT FALSE,
  review_reason     TEXT,
  
  -- Action taken
  action_taken      TEXT CHECK (action_taken IN ('updated', 'ignored', 'review_pending', 'error')),
  changes_applied   JSONB,  -- { field: new_value, ... }
  
  -- Timestamps
  synced_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Property Review Queue (for manual approval/rejection)
CREATE TABLE IF NOT EXISTS property_review_queue (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  property_id       UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  sync_log_id       UUID REFERENCES property_sync_logs(id) ON DELETE CASCADE,
  
  -- New data waiting review
  proposed_changes  JSONB NOT NULL,  -- { field: new_value, ... }
  diff              JSONB,  -- Full diff details
  
  -- Review info
  review_status     TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_by       UUID REFERENCES accounts(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  review_notes      TEXT,
  
  -- Tracking
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  expires_at        TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- 5. Property Sync Config (per-account configuration)
CREATE TABLE IF NOT EXISTS property_sync_config (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id        UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  
  -- Sync settings
  sync_enabled      BOOLEAN DEFAULT TRUE,
  sync_frequency    TEXT DEFAULT 'daily' CHECK (sync_frequency IN ('daily', 'weekly', 'manual')),
  last_sync_at      TIMESTAMPTZ,
  next_sync_at      TIMESTAMPTZ,
  
  -- Safety thresholds
  price_change_threshold_percent NUMERIC(5,2) DEFAULT 20,  -- Flag price changes > 20%
  max_null_threshold NUMERIC(3,2) DEFAULT 0.30,  -- Flag if > 30% of fields become null
  
  -- Performance settings
  batch_size        INT DEFAULT 10,
  max_requests_per_minute INT DEFAULT 30,
  retry_attempts    INT DEFAULT 3,
  
  -- Review settings
  auto_approve_minor_changes BOOLEAN DEFAULT FALSE,
  
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Sync Request Queue (for retry logic and rate limiting)
CREATE TABLE IF NOT EXISTS property_sync_queue (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  property_id       UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority          INT DEFAULT 0,
  
  attempt_count     INT DEFAULT 0,
  max_attempts      INT DEFAULT 3,
  last_attempt_at   TIMESTAMPTZ,
  error_message     TEXT,
  
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(property_id, status)
);

-- ============================================================
-- INDEXES for Performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_property_sync_logs_account
  ON property_sync_logs(account_id);

CREATE INDEX IF NOT EXISTS idx_property_sync_logs_property
  ON property_sync_logs(property_id);

CREATE INDEX IF NOT EXISTS idx_property_sync_logs_job
  ON property_sync_logs(sync_job_id);

CREATE INDEX IF NOT EXISTS idx_property_sync_logs_synced_at
  ON property_sync_logs(synced_at);

CREATE INDEX IF NOT EXISTS idx_property_review_queue_account
  ON property_review_queue(account_id);

CREATE INDEX IF NOT EXISTS idx_property_review_queue_status
  ON property_review_queue(review_status) WHERE review_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_property_review_queue_expires
  ON property_review_queue(expires_at);

CREATE INDEX IF NOT EXISTS idx_property_sync_config_account
  ON property_sync_config(account_id);

CREATE INDEX IF NOT EXISTS idx_property_sync_queue_account_status
  ON property_sync_queue(account_id, status);

CREATE INDEX IF NOT EXISTS idx_property_sync_queue_priority
  ON property_sync_queue(priority DESC, created_at);

CREATE INDEX IF NOT EXISTS idx_property_sync_jobs_account
  ON property_sync_jobs(account_id);

CREATE INDEX IF NOT EXISTS idx_property_sync_jobs_created
  ON property_sync_jobs(account_id, started_at DESC);
