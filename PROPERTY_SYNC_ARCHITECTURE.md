# Property Sync System - Architecture Diagrams & Data Models

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROPERTY SYNC SYSTEM                         │
│               Backend-Controlled Deterministic Pipeline          │
└─────────────────────────────────────────────────────────────────┘

                    TRIGGER POINTS
                    ┌──────────────┐
                    │ Scheduled    │
                    │ Daily 2 AM   │
                    │ (Netlify    │
                    │ Function)   │
                    └──────┬───────┘
                           │
                    ┌──────┴──────────────────┐
                    │ Manual API Call         │
                    │ (Admin Dashboard)       │
                    └──────┬──────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │   PROPERTY SYNC CRON JOB RUNNER      │
        │   (propertySyncCron.js)              │
        │                                      │
        │  1. Get accounts due for sync        │
        │  2. Iterate each account             │
        │  3. Process retry queue              │
        │  4. Run full sync batch              │
        │  5. Update next_sync_at              │
        └──────────────┬───────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │   SYNC BATCH ORCHESTRATOR            │
        │   (propertySync.js)                  │
        │                                      │
        │  Creates property_sync_jobs record   │
        │  Fetches properties needing sync     │
        │  Processes in batches (default: 10)  │
        │  Updates job metrics                  │
        └──────────────┬───────────────────────┘
                       │
      ┌────────────────┼─────────────────┐
      │                │                 │
      ▼                ▼                 ▼
    Property 1      Property 2      Property N
      │                │                 │
      └────────────────┼─────────────────┘
                       │
         (500ms delay between each)
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │    PROCESS PROPERTY SYNC             │
        │    (propertySync.js)                 │
        └──────────────┬───────────────────────┘
                       │
        ┌──────────────┴────────────────────────────┐
        │                                           │
        ▼                                           ▼
    STEP 1:                                   STEP 2:
    FETCH HTML                                EXTRACT DATA
    (Fetch from URL)                          (OpenAI API)
    │                                         │
    ├─ Validate URL                          ├─ Structured extraction
    ├─ Set timeout 30s                       ├─ Schema validation
    ├─ Check status code                     ├─ Null handling
    ├─ Truncate to 15KB                      ├─ Type coercion
    │                                         ├─ Array normalization
    │ Log: fetch_error if fails              │
    │ Log: fetched_html if success          │ Log: extraction_error if fails
    │                                         │ Log: extracted_data if success
    │                                         │
    │ (1000ms OpenAI delay)                  │
    │                                         │
    └──────────────┬─────────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────────────┐
    │      STEP 3: COMPARE DATA            │
    │      (propertyComparator.js)         │
    │                                      │
    │  ├─ Compare field by field           │
    │  ├─ Check for critical changes       │
    │  ├─ Apply safety rules               │
    │  └─ Generate diff object             │
    │                                      │
    │  Comparison Result:                  │
    │  {                                   │
    │    should_update: boolean,           │
    │    needs_review: boolean,            │
    │    diff: [changes],                  │
    │    reasons: [flags]                  │
    │  }                                   │
    └──────────────┬───────────────────────┘
                   │
        ┌──────────┴──────────┬────────────┬──────────┐
        │                     │            │          │
        ▼                     ▼            ▼          ▼
    NO CHANGE            CAN UPDATE     REVIEW      ERROR
    │                     │             │           │
    action:              action:        action:     action:
    "ignored"            "updated"      "review     "error"
    │                     │             pending"    │
    ├─ Log diff          ├─ Write to     │          ├─ Log error
    ├─ No changes         │   properties ├─ Create   │ ├─ fetch_error
    │ applied            │   table       │   queue   │ ├─ extract_error
    │                    ├─ Log update   │   entry   │ └─ update_error
    │                    ├─ Write to     │          │
    │                    │   sync_log    │ Log: requ│
    │                    │              │ ires_revi│
    │                    │ Log: changed  │ ew flag  │
    │                    │  applied      │          │
    │                    │              │ Property │
    │                    │              │ status:  │
    │                    │              │ unchanged│
    │                    │              │          │
    └────────────────────┴────────────────┴──────────┘
                       │
                       ▼
    ┌──────────────────────────────────────┐
    │  STEP 4: PROCESS SYNC RESULT         │
    │  (propertyUpdater.js)                │
    │                                      │
    │  ├─ Create property_sync_logs entry  │
    │  ├─ If review needed:                │
    │  │  └─ Create property_review_queue  │
    │  ├─ If safe update:                  │
    │  │  └─ Update properties table       │
    │  └─ Log result                       │
    └──────────────┬───────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────────────┐
    │   SYNC COMPLETE FOR PROPERTY         │
    │                                      │
    │  Metrics updated:                    │
    │  ├─ processed_count++                │
    │  ├─ updated_count++ (if updated)     │
    │  ├─ review_count++ (if flagged)      │
    │  └─ failed_count++ (if error)        │
    └──────────────┬───────────────────────┘
                   │
        (Batch complete when all done)
                   │
                   ▼
    ┌──────────────────────────────────────┐
    │   UPDATE SYNC JOB STATUS             │
    │                                      │
    │  property_sync_jobs.status =         │
    │    "completed"                       │
    │                                      │
    │  Final metrics:                      │
    │  ├─ processed_count                  │
    │  ├─ updated_count                    │
    │  ├─ review_count                     │
    │  ├─ failed_count                     │
    │  └─ completed_at timestamp           │
    └──────────────┬───────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────────────┐
    │   SYNC JOB COMPLETE                  │
    │                                      │
    │  Log available via:                  │
    │  ├─ /api/properties/sync?jobId=...   │
    │  ├─ property_sync_jobs table         │
    │  └─ property_sync_logs table         │
    │                                      │
    │  Review queue available via:         │
    │  ├─ /api/properties/review-queue     │
    │  └─ property_review_queue table      │
    └──────────────────────────────────────┘
```

---

## Database Table Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                         PROPERTIES                          │
│  (Existing table - enhanced with source_url)               │
├─────────────────────────────────────────────────────────────┤
│ PK: id (UUID)                                               │
│ FK: account_id                                              │
│                                                             │
│ Data fields: name, address, price_min, price_max, etc.   │
│ NEW: source_url (TEXT) - URL to fetch for refresh         │
│ Timestamps: created_at, updated_at                         │
└────────────────┬────────────────────┬────────────────────┬──┘
                 │                    │                    │
                 │ 1:N                │ 1:N                │ 1:N
                 ▼                    ▼                    ▼
    ┌───────────────────┐  ┌────────────────────┐  ┌──────────────┐
    │ property_sync_    │  │ property_review_   │  │ property_    │
    │ logs              │  │ queue              │  │ sync_queue   │
    ├───────────────────┤  ├────────────────────┤  ├──────────────┤
    │ id (PK)           │  │ id (PK)            │  │ id (PK)      │
    │ property_id (FK)  │  │ property_id (FK)   │  │ property_id  │
    │ sync_job_id (FK)  │  │ sync_log_id (FK)   │  │ (FK)         │
    │                   │  │                    │  │              │
    │ source_url        │  │ proposed_changes   │  │ status       │
    │ fetched_html      │  │ diff               │  │ priority     │
    │ extracted_data    │  │ review_status      │  │ attempt_     │
    │ diff_result       │  │ reviewed_by (FK)   │  │ count        │
    │ action_taken      │  │ reviewed_at        │  │ max_         │
    │ changes_applied   │  │ review_notes       │  │ attempts     │
    │ needs_review      │  │ created_at         │  │              │
    │ review_reason     │  │ expires_at         │  │ last_attempt │
    │ synced_at         │  └────────────────────┘  │              │
    └───────────────────┘                          └──────────────┘
            ▲
            │ 1:N Many logs per job
            │
    ┌───────┴──────────────────────────┐
    │ property_sync_jobs               │
    ├──────────────────────────────────┤
    │ id (PK)                          │
    │ account_id (FK)                  │
    │ started_at                       │
    │ completed_at                     │
    │ total_properties                 │
    │ processed_count                  │
    │ updated_count                    │
    │ review_count                     │
    │ failed_count                     │
    │ status (in_progress|completed)   │
    │ error_message                    │
    └───────┬──────────────────────────┘
            │ 1:N Many jobs per account
            │
    ┌───────┴──────────────────────────┐
    │ accounts (existing)              │
    ├──────────────────────────────────┤
    │ id (PK)                          │
    │ user_id (FK)                     │
    │ email                            │
    │ name                             │
    │ created_at                       │
    └───────┬──────────────────────────┘
            │ 1:1 One config per account
            │
    ┌───────┴──────────────────────────┐
    │ property_sync_config             │
    ├──────────────────────────────────┤
    │ id (PK)                          │
    │ account_id (FK UNIQUE)           │
    │ sync_enabled                     │
    │ sync_frequency                   │
    │ last_sync_at                     │
    │ next_sync_at                     │
    │ price_change_threshold_percent   │
    │ max_null_threshold               │
    │ batch_size                       │
    │ max_requests_per_minute          │
    │ retry_attempts                   │
    │ auto_approve_minor_changes       │
    │ created_at, updated_at           │
    └──────────────────────────────────┘
```

---

## Data Flow: Complete Example

```
SCENARIO: Property "Sunset Apartments" sync at 2 AM

┌─ CRON TRIGGER ──────────────────────────────────────────────┐
│ Time: 2024-04-22 02:00:00 UTC                               │
│ Trigger: Netlify scheduled function                         │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─ STEP 1: GET ACCOUNTS DUE FOR SYNC ─────────────────────────┐
│ Query: property_sync_config WHERE                           │
│   sync_enabled = true AND                                   │
│   next_sync_at <= NOW()                                     │
│                                                             │
│ Result: 5 accounts found                                    │
│                                                             │
│ For each account:                                           │
│   - Get all properties with source_url                      │
│   - Check sync_frequency (daily, weekly)                    │
│   - Load sync_config (batch_size, thresholds)              │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─ STEP 2: START SYNC JOB ────────────────────────────────────┐
│ INSERT INTO property_sync_jobs:                             │
│   id: "job-001"                                             │
│   account_id: "acct-001"                                    │
│   status: "in_progress"                                     │
│   started_at: 2024-04-22 02:00:00                          │
│   total_properties: 45                                      │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─ STEP 3: PROCESS BATCH (First 10) ──────────────────────────┐
│                                                             │
│ Property 1: Sunset Apartments                              │
│   source_url: "https://sunsetapts.com/listings/123"       │
│   existing: {                                              │
│     name: "Sunset Apartments",                             │
│     price_min: 1500,                                       │
│     price_max: 2500,                                       │
│     bedrooms: 2,                                           │
│     updated_at: "2024-04-15 10:30:00"                     │
│   }                                                         │
│                                                             │
│   ┌─ A. FETCH (500ms delay)                               │
│   │   fetch("https://sunsetapts.com/...")                 │
│   │   ├─ Timeout: 30s                                     │
│   │   ├─ Status: 200 OK                                   │
│   │   └─ HTML: <html>...15000 bytes...</html>            │
│   │                                                       │
│   │   ✓ Log: fetched_html                                │
│   │                                                       │
│   │ (1000ms OpenAI delay)                                │
│   │                                                       │
│   │   ┌─ B. EXTRACT (OpenAI)                             │
│   │   │   System: "Extract property data"                │
│   │   │   User: "HTML: <html>..."                        │
│   │   │   Model: gpt-4o-mini                             │
│   │   │                                                   │
│   │   │   Response:                                       │
│   │   │   {                                               │
│   │   │     "property_name": "Sunset Apartments",        │
│   │   │     "price_min": 1600,    ← CHANGED!           │
│   │   │     "price_max": 2500,                           │
│   │   │     "bedrooms": 2,        ← No change            │
│   │   │     "bathrooms": 1.5,     ← No change            │
│   │   │     "amenities": [...]                           │
│   │   │   }                                               │
│   │   │                                                   │
│   │   │   ✓ Log: extracted_data                         │
│   │   │                                                   │
│   │   └─ C. COMPARE                                     │
│   │       Input:                                          │
│   │         extracted: {price_min: 1600, ...}           │
│   │         existing: {price_min: 1500, ...}            │
│   │       Logic:                                          │
│   │         1500 → 1600 = +100 = 6.7% change             │
│   │         Threshold: 20%                               │
│   │         ✓ SAFE (below threshold)                     │
│   │                                                       │
│   │       Comparison Result:                              │
│   │       {                                               │
│   │         should_update: true,                          │
│   │         needs_review: false,                          │
│   │         changedFields: ["price_min"],                │
│   │         diff: [                                       │
│   │           {                                           │
│   │             field: "price_min",                       │
│   │             old_value: 1500,                          │
│   │             new_value: 1600,                          │
│   │             changed: true                             │
│   │           }                                           │
│   │         ]                                             │
│   │       }                                               │
│   │                                                       │
│   │       ✓ Log: diff_result                            │
│   │                                                       │
│   │   D. UPDATE PROPERTY                                │
│   │       UPDATE properties SET                           │
│   │         price_min = 1600,                             │
│   │         updated_at = NOW()                            │
│   │       WHERE id = 'prop-001'                           │
│   │                                                       │
│   │       ✓ Update: property_sync_logs                  │
│   │        action_taken: "updated"                        │
│   │        changes_applied: {price_min: 1600}            │
│   │                                                       │
│   │   E. COMPLETE                                        │
│   │       action: "updated"                               │
│   │       durationMs: 2340                               │
│   │                                                       │
│   └─ Result: PROPERTY UPDATED ✓                          │
│                                                             │
│ (Repeat for remaining 9 properties in batch)               │
│                                                             │
│ Batch Results:                                              │
│   - 7 properties updated                                    │
│   - 2 waiting for review                                    │
│   - 1 error (network timeout)                              │
│                                                             │
│   ✓ Update job metrics:                                     │
│   processed_count: 10                                       │
│   updated_count: 7                                          │
│   review_count: 2                                           │
│   failed_count: 1                                           │
│                                                             │
│ (Continue with batches 2-5...)                             │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─ STEP 4: JOB COMPLETE ──────────────────────────────────────┐
│ UPDATE property_sync_jobs SET                              │
│   status: "completed",                                      │
│   completed_at: 2024-04-22 02:18:00,                      │
│   processed_count: 45,                                      │
│   updated_count: 28,                                        │
│   review_count: 12,                                         │
│   failed_count: 5                                           │
│                                                             │
│ Final Stats:                                                │
│   Duration: 18 minutes                                      │
│   Success Rate: 88.9% (40/45)                              │
│   Updates Applied: 28                                       │
│   Pending Review: 12                                        │
│   Errors: 5                                                 │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─ STEP 5: NEXT SYNC SCHEDULED ───────────────────────────────┐
│ UPDATE property_sync_config SET                            │
│   last_sync_at: 2024-04-22 02:18:00,                      │
│   next_sync_at: 2024-04-23 02:00:00   (24h later)        │
│                                                             │
│ Updated property_sync_logs entries available:              │
│   SELECT * FROM property_sync_logs                          │
│   WHERE sync_job_id = 'job-001'                            │
│   → 45 log entries (one per property)                      │
│                                                             │
│ Review queue entries created:                              │
│   SELECT * FROM property_review_queue                       │
│   WHERE review_status = 'pending' AND                       │
│   created_at >= '2024-04-22 02:00:00'                     │
│   → 12 items waiting for Lorenzo to review                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Safety Rules Decision Tree

```
EXTRACTED DATA vs EXISTING RECORD
            ↓
        COMPARE
            ↓
    ┌───────┴──────────┐
    ▼                  ▼
NO CHANGES        CHANGES DETECTED
    │                  │
    └─→ IGNORE      ┌──┴──────────────────────────────┐
                    │                                  │
                    ▼                                  ▼
            CHECK CRITICAL FIELDS        EVALUATE NULL COUNT
                    │                            │
        ┌───────────┼───────────────┐           │
        │           │               │           │
        ▼           ▼               ▼           ▼
      PRICE    ADDRESS        PROPERTY     NULL > 30%
     CHANGE    CHANGED        NAME CHANGE     │
        │          │              │           │
        │          │              │           └─→ FLAG: REVIEW
        │          │              │
        ▼          ▼              ▼
    > 20%?     CHANGED?     < 70% similar?
        │          │              │
       YES        YES             YES
        │          │              │
        └─────┬────┴──────┬───────┘
              │           │
              ▼           ▼
           FLAG:REVIEW   │
                  │      │
                  └──────┴────────────────────┐
                                             │
                                             ▼
                                    AUTO-APPROVE OK?
                                             │
                                   ┌─────────┴────────┐
                                   │                  │
                                   NO                YES
                                   │                  │
                                   ▼                  ▼
                             CREATE REVIEW   → APPLY UPDATE
                             QUEUE ENTRY         (AUTO)
                                   │                  │
                                   └────────┬─────────┘
                                            │
                                            ▼
                                       LOG TO
                                   SYNC_LOGS TABLE
                                  (Action taken)
```

---

## API Response Examples

### Trigger Sync
```javascript
POST /api/properties/sync
{
  "propertyIds": ["prop-1", "prop-2"],
  "batchSize": 10
}

Response (200):
{
  "success": true,
  "jobId": "job-abc123",
  "propertiesProcessed": 2,
  "stats": {
    "total": 2,
    "successful": 2,
    "updated": 1,
    "reviewed": 1,
    "ignored": 0,
    "failed": 0
  },
  "durationMs": 2500
}
```

### Get Sync Status
```javascript
GET /api/properties/sync?jobId=job-abc123

Response (200):
{
  "success": true,
  "jobId": "job-abc123",
  "job": {
    "id": "job-abc123",
    "account_id": "acct-123",
    "status": "completed",
    "started_at": "2024-04-22T02:00:00Z",
    "completed_at": "2024-04-22T02:05:00Z",
    "total_properties": 45,
    "processed_count": 45,
    "updated_count": 28,
    "review_count": 12,
    "failed_count": 5,
    "error_message": null
  },
  "logs": [
    {
      "id": "log-1",
      "property_id": "prop-1",
      "action_taken": "updated",
      "needs_review": false,
      "synced_at": "2024-04-22T02:00:15Z"
    },
    ...
  ],
  "summary": {
    "duration": 300000,
    "completionPercentage": "100"
  }
}
```

### Get Review Queue
```javascript
GET /api/properties/review-queue?status=pending

Response (200):
{
  "success": true,
  "count": 3,
  "items": [
    {
      "id": "review-1",
      "property_id": "prop-22",
      "proposed_changes": {
        "price_max": 3000
      },
      "diff": {
        "changes": [
          {
            "field": "price_max",
            "old_value": 2800,
            "new_value": 3000,
            "changed": true
          }
        ],
        "summary": ["Price change exceeds 20%: 2800 → 3000"]
      },
      "review_status": "pending",
      "created_at": "2024-04-22T02:05:00Z",
      "properties": {
        "id": "prop-22",
        "property_name": "Sunrise Towers",
        "address": "123 Main St",
        "city": "Houston",
        "price_min": 1500,
        "price_max": 2800
      }
    },
    ...
  ]
}
```

---

This architecture ensures:
✅ Backend control of all logic
✅ No autonomous decisions by LLM
✅ Full audit trail and logging
✅ Safe, reviewable updates
✅ Scalable to large property datasets
✅ Cost-efficient with optimization strategies
