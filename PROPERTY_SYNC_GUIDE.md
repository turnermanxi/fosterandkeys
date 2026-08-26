# Property Sync System - Architecture & Implementation Guide

## 🏗️ System Architecture

The automated property refresh system is a **backend-controlled, deterministic pipeline** that keeps listings up to date from source URLs. The LLM is used ONLY for data normalization, not for autonomous decision-making.

### Design Principles
- ✅ **Backend-Controlled**: All decisions made by deterministic logic
- ✅ **No Autonomous Agents**: LLM is a parser/normalizer only
- ✅ **Scalable**: Handles large property datasets with batching
- ✅ **Debuggable**: Full audit trail and logging
- ✅ **Safe**: Review queue for uncertain updates
- ✅ **Cost-Optimized**: Smart batching, caching, rate limiting

---

## 📊 Data Flow

```
Properties with source_url
        ↓
Fetch HTML from URL (rate limited)
        ↓
Extract structured data via OpenAI
        ↓
Compare with existing record
        ↓
Evaluate safety rules
        ↓
┌─────────┬─────────┬──────────┐
↓         ↓         ↓          ↓
Update  Ignore  Review Queue  Error
(Auto)          (Manual)
```

---

## 🔧 Core Components

### 1. **propertyExtractor.js**
Parses HTML and extracts structured property data using OpenAI.

```javascript
extractPropertyDataFromHTML(htmlContent, sourceUrl, existingProperty)
// Returns: extracted fields (normalized)
```

**Key Features:**
- Input validation and truncation (prevents token overflow)
- Strict schema enforcement
- Null value handling
- Batch extraction with rate limiting

---

### 2. **propertyComparator.js**
Compares extracted data with existing database records.

```javascript
comparePropertyData(extracted, existing, config)
// Returns: {
//   should_update: boolean,
//   needs_review: boolean,
//   diff: [{field, old_value, new_value}],
//   reasons: ["reason1", "reason2"]
// }
```

**Safety Rules (Trigger Review):**
- **Price changes > 20%** (configurable threshold)
- **Address changes** (any modification)
- **Property name changes** (if string similarity < 70%)
- **Too many null values** (> 30% of fields)

**Comparison Logic:**
- Values only considered equal if truly identical
- Handles numeric precision (±0.01)
- Array and JSONB comparison
- Trim whitespace on strings

---

### 3. **propertyUpdater.js**
Applies updates and manages the review queue.

```javascript
// Auto-update (safe changes only)
await processSyncResult({
  supabaseClient, accountId, propertyId,
  extracted, existing, comparison,
  htmlContent, sourceUrl, syncJobId
})

// Manual approval/rejection
await approveReviewQueueItem({supabaseClient, accountId, reviewQueueId, ...})
await rejectReviewQueueItem({supabaseClient, accountId, reviewQueueId, ...})
```

**Actions:**
- `updated`: Changed applied directly
- `review_pending`: Waits for manual approval
- `ignored`: No changes detected
- `error`: Fetch/extract/update failure

---

### 4. **propertySync.js**
Main pipeline orchestrator coordinating all components.

```javascript
runPropertySyncBatch({
  supabaseClient, accountId,
  propertyIds,  // optional
  batchSize = 10,
  excludeFailures = true
})
// Returns: full job result with metrics
```

**Pipeline Steps:**
1. Fetch HTML (with timeout, status checks)
2. Extract data via OpenAI
3. Compare with database
4. Process result (update/ignore/review)
5. Log every action

**Rate Limiting:**
- 500ms delay between requests (configurable)
- OpenAI batch delay: 1000ms
- Prevents overwhelming sources or hitting API limits

---

### 5. **propertySyncCron.js**
Scheduled job runner for automatic syncs.

```javascript
runPropertySyncCronJob(event)
// Runs daily (default), processes all accounts due for sync
```

**Handles:**
- Multi-account processing
- Retry queue for failed syncs
- Error recovery
- Job status tracking
- Next sync scheduling

---

### 6. **propertysyncOptimization.js**
Performance and cost optimization utilities.

**Features:**
- Smart property selection (only sync stale listings)
- Cache layer for extracted data
- Rate limiter with slot booking
- Batch size calculator
- Cost estimator for OpenAI

---

## 📋 Database Schema

### New Tables

#### `property_sync_jobs`
Tracks sync batch operations
- `id`, `account_id`, `status`, `started_at`, `completed_at`
- `total_properties`, `processed_count`, `updated_count`, `review_count`, `failed_count`

#### `property_sync_logs`
Detailed log of every property sync
- `property_id`, `sync_job_id`, `action_taken` (updated|ignored|review_pending|error)
- `source_url`, `fetched_html`, `extracted_data`, `diff_result`
- `needs_review`, `review_reason`, `changes_applied`
- `synced_at`, `updated_at`

#### `property_review_queue`
Manual approval/rejection queue
- `property_id`, `proposed_changes`, `diff`
- `review_status` (pending|approved|rejected)
- `reviewed_by`, `reviewed_at`, `review_notes`
- `expires_at` (auto-cleanup after 7 days)

#### `property_sync_config`
Per-account sync configuration
- `account_id`, `sync_enabled`, `sync_frequency` (daily|weekly|manual)
- `price_change_threshold_percent`, `max_null_threshold`
- `batch_size`, `max_requests_per_minute`, `retry_attempts`
- `last_sync_at`, `next_sync_at`

#### `property_sync_queue`
Retry queue for failed syncs
- `property_id`, `status` (pending|processing|completed|failed)
- `attempt_count`, `max_attempts`, `error_message`

**New Column:**
- `properties.source_url` - URL to fetch for this property

---

## 🚀 How to Use

### 1. **Set Up Database**

```bash
# Run migration in Supabase SQL editor
# File: supabase/migrate-add-property-sync.sql
```

### 2. **Add source_url to Properties**

```sql
UPDATE properties SET source_url = 'https://example.com/listing/123' 
WHERE id = 'property-id';
```

### 3. **Configure Sync Settings**

```sql
INSERT INTO property_sync_config (account_id, sync_enabled, sync_frequency)
VALUES ('account-id', true, 'daily');
```

### 4. **Manual Sync Trigger**

```javascript
// Frontend API call
const response = await fetch('/api/properties/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    propertyIds: ['prop-1', 'prop-2'], // optional
    batchSize: 10  // optional
  })
});

const result = await response.json();
// result.jobId can be used to track status
```

### 5. **Get Sync Status**

```javascript
const status = await fetch(
  `/api/properties/sync?jobId=${jobId}`
).then(r => r.json());

// Returns job details and logs
```

### 6. **Review Queue Management**

```javascript
// Get pending reviews
const reviews = await fetch(
  '/api/properties/review-queue?status=pending'
).then(r => r.json());

// Approve
await fetch('/api/properties/review-queue/{id}/approve', {
  method: 'POST',
  body: JSON.stringify({ notes: 'Looks good' })
});

// Reject
await fetch('/api/properties/review-queue/{id}/reject', {
  method: 'POST',
  body: JSON.stringify({ notes: 'Price too high' })
});
```

### 7. **Automatic Scheduled Sync** (Netlify)

The system includes a Netlify Function that runs on schedule:
- File: `netlify/functions/sync-properties.js`
- Schedule: `0 2 * * *` (2 AM UTC daily)
- Configure in `netlify.toml`:

```toml
[functions]
  directory = "netlify/functions"

[[scheduled_functions]]
  path = "sync-properties"
  cron = "0 2 * * *"
```

---

## ⚙️ Configuration

### Sync Frequency Options

```javascript
{
  sync_enabled: true,
  sync_frequency: 'daily',           // or 'weekly', 'manual'
  
  // Safety thresholds
  price_change_threshold_percent: 20, // Flag if > 20% change
  max_null_threshold: 0.30,          // Flag if > 30% fields null
  
  // Performance
  batch_size: 10,                    // Properties per batch
  max_requests_per_minute: 30,       // Rate limit
  retry_attempts: 3,                 // Failed property retries
  
  // Review settings
  auto_approve_minor_changes: false  // Manual approval required
}
```

### Cost Optimization

Use the `CostCalculator` to estimate costs:

```javascript
import { CostCalculator } from '@/lib/propertysyncOptimization';

// Estimate cost for 100 properties
const estimate = CostCalculator.estimateBatchCost(100);
// Returns: {
//   totalCost: "0.5842",
//   costPerProperty: "0.0058",
//   ...
// }
```

---

## 📊 Monitoring & Debugging

### View Sync Logs

```javascript
// All syncs for a property
const { data: logs } = await supabaseClient
  .from('property_sync_logs')
  .select('*')
  .eq('property_id', propertyId)
  .order('synced_at', { ascending: false });
```

### Check Job Status

```javascript
const { data: job } = await supabaseClient
  .from('property_sync_jobs')
  .select('*')
  .eq('id', syncJobId)
  .single();

// Shows: total_properties, processed_count, updated_count, failed_count
```

### Review Queue Pending Items

```javascript
const { data: pending } = await supabaseClient
  .from('property_review_queue')
  .select('*')
  .eq('review_status', 'pending')
  .order('created_at', { ascending: true });
```

---

## 🔒 Safety Features

### Data Validation
- ✅ Null value protection (not applied unless explicit)
- ✅ Type checking and coercion
- ✅ String trimming
- ✅ Numeric precision handling

### Update Safety
- ✅ Only changed fields updated
- ✅ Required fields protected
- ✅ Critical field changes flagged
- ✅ Price change thresholds
- ✅ Address change handling

### Audit Trail
- ✅ Every sync logged with full details
- ✅ `diff_result` captures exact changes
- ✅ `changes_applied` shows what was written
- ✅ `review_reason` explains flagged items
- ✅ Manual approvals tracked with reviewer ID

---

## ❌ Error Handling

**Fetch Errors**
- Invalid URL, timeout, HTTP errors logged
- Property status stays unchanged
- Retry queued for next sync cycle

**Extraction Errors**
- OpenAI failures logged with error message
- HTML stored for manual inspection
- Retry later (max 3 attempts)

**Comparison Errors**
- Logged but rare (data validation prevents most)
- Property flagged for review if uncertain

**Update Errors**
- Database constraint violations logged
- Changes not applied, property unchanged
- Manual review recommended

---

## 💡 Best Practices

### Before Production
1. ✅ Add `source_url` to all properties you want synced
2. ✅ Set `sync_enabled = true` in config
3. ✅ Test with a small batch first
4. ✅ Adjust `price_change_threshold_percent` for your market
5. ✅ Review first batch of review queue items

### Ongoing Operations
1. 📊 Monitor review queue weekly (check for patterns)
2. 📈 Track sync success rate (aim for 95%+)
3. 💰 Review cost estimates monthly
4. 🔍 Spot-check changed data (random sample)
5. 🚨 Set up alerts for high error rates

### Optimization Tips
1. **Batch Size**: Start with 10, increase if no rate limiting issues
2. **Frequency**: Daily for active listings, weekly for stable
3. **Caching**: Enable for properties with stable URLs
4. **Retry Logic**: 3 attempts is good default, adjust per reliability
5. **Cost**: Use `CostCalculator` to estimate budget impact

---

## 🚨 Important Notes

### This is NOT an Autonomous Agent
- ✅ Backend logic controls all decisions
- ✅ LLM only parses/normalizes data
- ✅ No self-directed actions
- ✅ No autonomous approval of updates
- ✅ Human review for uncertain changes

### Data Integrity
- Timestamps are set by server (not client/LLM)
- Updates only affect specified fields
- Old values preserved in logs
- Rollback possible via `changes_applied` log
- Schema remains strict (no new fields added)

### Rate Limiting
- Respects source website limits (user-agent delays)
- OpenAI rate limit aware (batched)
- Configurable requests per minute
- Automatic retry with backoff

---

## 📝 Troubleshooting

### Syncs Failing for All Properties
- Check `source_url` format (must be valid URL)
- Check OpenAI API key and rate limits
- Check network connectivity
- Review error logs in `property_sync_logs`

### Review Queue Growing Too Fast
- Increase `price_change_threshold_percent`
- Increase `max_null_threshold`
- Check if extracted data is noisy
- Manually reject patterns to reduce noise

### High OpenAI Costs
- Reduce `batch_size` or `sync_frequency`
- Enable caching in optimization layer
- Use `CostCalculator` to estimate per-property cost
- Consider weekly instead of daily for stable listings

### Properties Not Updating
- Verify comparison logic (check `diff_result`)
- Verify `should_update` is true
- Check for `needs_review = true` (manual approval needed)
- Review database update permissions

---

## 📚 Code Examples

### Manual Sync Trigger
See: [/api/properties/sync/route.js](src/app/api/properties/sync/route.js)

### Review Queue Review
See: [/api/properties/review-queue/route.js](src/app/api/properties/review-queue/[[...path]]/route.js)

### Extraction Schema
See: [propertyExtractor.js](src/lib/propertyExtractor.js#L8-L50)

### Safety Rules
See: [propertyComparator.js](src/lib/propertyComparator.js#L20-L30)

---

This system provides complete property refresh automation while maintaining full backend control and auditability. ✨
