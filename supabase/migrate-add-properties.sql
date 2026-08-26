-- ============================================================
-- Properties Management Feature
-- Migration: Add ALL properties-related tables
-- ============================================================

-- 1. Accounts/Agents Table (for multi-account support)
CREATE TABLE IF NOT EXISTS accounts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  name        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Main Properties Table
CREATE TABLE IF NOT EXISTS properties (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id         UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  
  -- Source type
  source             TEXT NOT NULL CHECK (source IN ('apartment_data', 'manual', 'csv_import'))
                     DEFAULT 'manual',
  
  -- Optional reference to existing apartment (for imported properties)
  apartment_id       BIGINT REFERENCES apartments(id) ON DELETE SET NULL,
  
  -- Basic info
  property_name      TEXT,
  address            TEXT NOT NULL,
  city               TEXT NOT NULL,
  state              TEXT DEFAULT 'TX',
  zip                TEXT,
  lat                NUMERIC(10,8),
  lng                NUMERIC(11,8),
  
  -- Pricing
  price_min          NUMERIC(12,2),
  price_max          NUMERIC(12,2),
  
  -- Physical details
  bedrooms           INT,
  bathrooms          NUMERIC(3,1),
  sqft               INT,
  property_type      TEXT,
  
  -- Acceptance criteria (renters, buyers)
  pet_friendly       BOOLEAN,
  accepts_evictions  BOOLEAN,
  accepts_broken_leases BOOLEAN,
  accepts_low_credit BOOLEAN,
  accepts_itin       BOOLEAN,
  accepts_second_chance BOOLEAN,
  
  -- Fees & costs
  admin_fee          NUMERIC(10,2),
  app_fee            NUMERIC(10,2),
  deposit_info       TEXT,
  
  -- Additional data (flexible JSON)
  amenities          JSONB,
  notes              TEXT,
  
  -- Contact info
  contact_name       TEXT,
  contact_phone      TEXT,
  contact_email      TEXT,
  website            TEXT,
  
  -- Status
  is_active          BOOLEAN DEFAULT TRUE,
  is_favorite        BOOLEAN DEFAULT FALSE,
  is_archived        BOOLEAN DEFAULT FALSE,
  archived_at        TIMESTAMPTZ,
  
  -- Audit
  created_by         UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Property Tags (flexible labeling)
CREATE TABLE IF NOT EXISTS property_tags (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tag         TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, tag)
);

-- 4. Property Notes (audit trail & comments)
CREATE TABLE IF NOT EXISTS property_notes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  note        TEXT NOT NULL,
  created_by  UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Email Templates (reusable templates for reports)
CREATE TABLE IF NOT EXISTS email_templates (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  is_default  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Property Sends (track emails sent to leads)
CREATE TABLE IF NOT EXISTS property_sends (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  template_id   UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  email_snapshot TEXT,
  sent_to_email TEXT,
  sent_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Potential Duplicates (soft flagging)
CREATE TABLE IF NOT EXISTS potential_duplicates (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  similar_to_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reason        TEXT NOT NULL,
  confidence    INT DEFAULT 50,
  status        TEXT DEFAULT 'flagged',
  merged_into   UUID REFERENCES properties(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, similar_to_id)
);

-- ============================================================
-- INDEXES for Performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_properties_account 
  ON properties(account_id);

CREATE INDEX IF NOT EXISTS idx_properties_active 
  ON properties(account_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_properties_favorite 
  ON properties(account_id, is_favorite) WHERE is_favorite = true;

CREATE INDEX IF NOT EXISTS idx_properties_archived 
  ON properties(account_id, is_archived);

CREATE INDEX IF NOT EXISTS idx_properties_source 
  ON properties(account_id, source);

CREATE INDEX IF NOT EXISTS idx_properties_city 
  ON properties(account_id, city);

CREATE INDEX IF NOT EXISTS idx_properties_address 
  ON properties(account_id, address);

CREATE INDEX IF NOT EXISTS idx_property_tags_property 
  ON property_tags(property_id);

CREATE INDEX IF NOT EXISTS idx_property_tags_tag 
  ON property_tags(account_id, tag);

CREATE INDEX IF NOT EXISTS idx_property_notes_property 
  ON property_notes(property_id);

CREATE INDEX IF NOT EXISTS idx_property_sends_property 
  ON property_sends(property_id);

CREATE INDEX IF NOT EXISTS idx_property_sends_lead 
  ON property_sends(lead_id);

CREATE INDEX IF NOT EXISTS idx_property_sends_sent_at 
  ON property_sends(sent_at);

CREATE INDEX IF NOT EXISTS idx_email_templates_account 
  ON email_templates(account_id);

CREATE INDEX IF NOT EXISTS idx_potential_duplicates_account 
  ON potential_duplicates(account_id, status);

CREATE INDEX IF NOT EXISTS idx_potential_dupes_property 
  ON potential_duplicates(property_id);
