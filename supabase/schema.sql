-- ============================================================
-- Foster & Keys — Supabase Schema
-- Run this in the Supabase SQL Editor to create all tables.
-- ============================================================

-- Drop old tables (order matters because of foreign keys)
DROP TABLE IF EXISTS lead_matches CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS units CASCADE;
DROP TABLE IF EXISTS apartments CASCADE;

-- 1. Apartments (each property complex / community)
CREATE TABLE IF NOT EXISTS apartments (
  id                BIGSERIAL PRIMARY KEY,
  slug              TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  metro_area        TEXT NOT NULL CHECK (metro_area IN ('HOUSTON_METRO','DFW_METRO','UNKNOWN')),
  city              TEXT,
  deposit_min       NUMERIC(10,2),
  deposit_max       NUMERIC(10,2),
  app_fee           NUMERIC(10,2),
  admin_fee         NUMERIC(10,2),
  income_multiplier NUMERIC(4,2),
  lease_min_months  INT,
  lease_max_months  INT,
  specials            TEXT,
  notes               TEXT,
  url                 TEXT,                -- listing or property website link
  accepts_broken_lease BOOLEAN DEFAULT NULL, -- NULL = unknown
  accepts_bankruptcy   BOOLEAN DEFAULT NULL,
  accepts_eviction     BOOLEAN DEFAULT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Units (individual floor plans / units within an apartment)
CREATE TABLE IF NOT EXISTS units (
  id               BIGSERIAL PRIMARY KEY,
  apartment_id     BIGINT NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  floorplan        TEXT,
  unit_number      TEXT,
  bedrooms         INT,
  bathrooms        NUMERIC(3,1),
  sqft_min         INT,
  sqft_max         INT,
  rent_min         NUMERIC(10,2),
  rent_max         NUMERIC(10,2),
  available_date   DATE,
  lease_months     INT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Leads (each form submission / email becomes a lead)
CREATE TABLE IF NOT EXISTS leads (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name         TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  budget_min        NUMERIC(10,2),     -- monthly rent min
  budget_max        NUMERIC(10,2),     -- monthly rent max
  desired_location  TEXT,              -- metro area or city
  bedrooms          INT,
  bathrooms         NUMERIC(3,1),
  move_in_timeline  TEXT,
  notes             TEXT,
  raw_email         TEXT,              -- original email body (for audit / re-parsing)
  ai_summary        TEXT,              -- OpenAI-generated match summary
  status            TEXT DEFAULT 'new',   -- new | reviewed | sent
  results_token     TEXT UNIQUE,          -- unique token for client results link
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- 4. Lead <-> Unit match scores
CREATE TABLE IF NOT EXISTS lead_matches (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id      UUID REFERENCES leads(id) ON DELETE CASCADE,
  unit_id      BIGINT REFERENCES units(id) ON DELETE CASCADE,
  apartment_id BIGINT REFERENCES apartments(id) ON DELETE CASCADE,
  score        INT NOT NULL DEFAULT 0,      -- 0-100
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lead_id, unit_id)
);

-- Indexes for fast look-ups
CREATE INDEX IF NOT EXISTS idx_lead_matches_lead   ON lead_matches(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_matches_unit   ON lead_matches(unit_id);
CREATE INDEX IF NOT EXISTS idx_lead_matches_apt    ON lead_matches(apartment_id);
CREATE INDEX IF NOT EXISTS idx_leads_token         ON leads(results_token);
CREATE INDEX IF NOT EXISTS idx_units_apartment     ON units(apartment_id);
