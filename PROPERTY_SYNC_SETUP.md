# Property Sync System - Quick Setup Guide

## Phase 1: Database Setup (15 minutes)

### 1. Run Migration
In Supabase SQL Editor, run the migration file:
```
supabase/migrate-add-property-sync.sql
```

This creates:
- ✅ `property_sync_jobs` - Batch job tracking
- ✅ `property_sync_logs` - Detailed sync history
- ✅ `property_review_queue` - Manual approval queue
- ✅ `property_sync_config` - Per-account settings
- ✅ `property_sync_queue` - Retry queue
- ✅ `source_url` column in properties table

### 2. Initialize Sync Config
For each account that should have auto-sync:

```sql
INSERT INTO property_sync_config (
  account_id, 
  sync_enabled, 
  sync_frequency,
  price_change_threshold_percent,
  max_null_threshold,
  batch_size
)
SELECT 
  a.id,
  true,
  'daily',
  20,
  0.30,
  10
FROM accounts a
WHERE a.user_id IN (
  -- Your user IDs here
);
```

---

## Phase 2: Add source_url to Properties

Option A: **Manual SQL**
```sql
UPDATE properties 
SET source_url = 'https://example.com/property/123' 
WHERE id = 'property-uuid';
```

Option B: **Bulk Import**
Upload CSV with `id` and `source_url` columns, import via properties admin UI

Option C: **From existing apartment data**
```sql
UPDATE properties p
SET source_url = a.url
FROM apartments a
WHERE p.apartment_id = a.id
AND p.source_url IS NULL
AND a.url IS NOT NULL;
```

---

## Phase 3: Deploy Updated Code

### 1. Add Library Files
Already created:
- ✅ `src/lib/propertyExtractor.js` - OpenAI integration
- ✅ `src/lib/propertyComparator.js` - Diff engine
- ✅ `src/lib/propertyUpdater.js` - Update logic
- ✅ `src/lib/propertySync.js` - Main orchestrator
- ✅ `src/lib/propertySyncCron.js` - Scheduled job
- ✅ `src/lib/propertysyncOptimization.js` - Optimization & caching

### 2. Add API Routes
Already created:
- ✅ `src/app/api/properties/sync/route.js` - Trigger sync & get status
- ✅ `src/app/api/properties/review-queue/[[...path]]/route.js` - Review management

### 3. Add Netlify Function
Already created:
- ✅ `netlify/functions/sync-properties.js` - Scheduled daily job

### 4. Update netlify.toml
Already updated:
```toml
[functions]
  directory = "netlify/functions"

[[scheduled_functions]]
  path = "sync-properties"
  cron = "0 2 * * *"  # Daily at 2 AM UTC
```

### 5. Test Deployment
```bash
npm run build
npm run start
# Or: netlify deploy
```

---

## Phase 4: Initial Testing

### Test 1: Manual Sync (Single Property)

```bash
curl -X POST http://localhost:3000/api/properties/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "propertyIds": ["specific-property-uuid"],
    "batchSize": 1
  }'
```

Response:
```json
{
  "success": true,
  "jobId": "sync-job-uuid",
  "stats": {
    "total": 1,
    "successful": 1,
    "updated": 0,
    "reviewed": 0,
    "ignored": 1,
    "failed": 0
  }
}
```

### Test 2: Check Sync Logs

```sql
SELECT 
  p.property_name,
  l.action_taken,
  l.diff_result,
  l.synced_at
FROM property_sync_logs l
JOIN properties p ON l.property_id = p.id
ORDER BY l.synced_at DESC
LIMIT 10;
```

### Test 3: Review Queue

```bash
curl http://localhost:3000/api/properties/review-queue?status=pending \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Phase 5: Configuration Tuning

### Adjust Price Threshold (Market-Dependent)

```sql
-- Less sensitive (30% change needed to flag)
UPDATE property_sync_config 
SET price_change_threshold_percent = 30
WHERE account_id = 'your-account-id';

-- More sensitive (10% change flags)
UPDATE property_sync_config 
SET price_change_threshold_percent = 10
WHERE account_id = 'your-account-id';
```

### Adjust Batch Size (Based on Rate Limits)

```sql
-- Slower, more reliable
UPDATE property_sync_config 
SET batch_size = 5, max_requests_per_minute = 20
WHERE account_id = 'your-account-id';

-- Faster, if source/API can handle it
UPDATE property_sync_config 
SET batch_size = 20, max_requests_per_minute = 50
WHERE account_id = 'your-account-id';
```

### Change Sync Frequency

```sql
-- Daily (default)
UPDATE property_sync_config 
SET sync_frequency = 'daily'
WHERE account_id = 'your-account-id';

-- Weekly (less API cost)
UPDATE property_sync_config 
SET sync_frequency = 'weekly'
WHERE account_id = 'your-account-id';

-- Manual only
UPDATE property_sync_config 
SET sync_enabled = false
WHERE account_id = 'your-account-id';
```

---

## Phase 6: Production Checklist

Before going live:

- [ ] Database migration applied
- [ ] `source_url` added to all properties
- [ ] `property_sync_config` initialized for accounts
- [ ] All new code deployed
- [ ] Manual test (single property) succeeded
- [ ] Reviewed sample of sync logs
- [ ] Checked that review queue works
- [ ] Price threshold tuned for market
- [ ] Batch size optimized for rate limits
- [ ] Team trained on review process
- [ ] Error notifications set up (optional)
- [ ] Cost tracking configured

---

## Monitoring & Maintenance

### Daily (Automated)
- ✅ System runs automatically at 2 AM UTC
- ✅ Processes all enabled accounts
- ✅ Logs all activity

### Weekly (Manual)
- [ ] Review new items in `property_review_queue`
- [ ] Approve/reject with notes
- [ ] Check sync success rate target (95%+)

### Monthly (Analysis)
- [ ] Review cost via `CostCalculator`
- [ ] Identify frequent review reasons
- [ ] Adjust thresholds if needed
- [ ] Check for stuck/failed properties

---

## Common Issues & Fixes

### Issue: "No properties due for sync"
**Cause**: `next_sync_at` in future, or `sync_enabled = false`
**Fix**: 
```sql
UPDATE property_sync_config 
SET next_sync_at = NOW()
WHERE account_id = 'your-account-id';
```

### Issue: Review queue growing too fast
**Cause**: Price threshold too low
**Fix**: Increase `price_change_threshold_percent`
```sql
UPDATE property_sync_config 
SET price_change_threshold_percent = 30
WHERE account_id = 'your-account-id';
```

### Issue: Syncs failing for all properties
**Cause**: OpenAI API key, network, or invalid URLs
**Fix**: 
1. Check OpenAI key in environment
2. Check URL format: `source_url` should be valid HTTP(S)
3. View error logs: Check `property_sync_logs` for `fetch_error`

### Issue: Updates not being applied
**Cause**: Changes flagged for review or no actual changes detected
**Fix**: Check `property_sync_logs.action_taken` and `needs_review`

---

## Sample Frontend Component (Optional)

```jsx
// Quick management dashboard
import { useState, useEffect } from 'react';

export default function PropertySyncDashboard() {
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [reviews, setReviews] = useState([]);

  const triggerSync = async () => {
    const res = await fetch('/api/properties/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchSize: 10 })
    });
    const result = await res.json();
    setJobId(result.jobId);
  };

  const fetchStatus = async () => {
    if (!jobId) return;
    const res = await fetch(`/api/properties/sync?jobId=${jobId}`);
    const result = await res.json();
    setStatus(result.job);
  };

  const fetchReviews = async () => {
    const res = await fetch('/api/properties/review-queue?status=pending');
    const result = await res.json();
    setReviews(result.items);
  };

  useEffect(() => {
    if (jobId) {
      const interval = setInterval(fetchStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [jobId]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Property Sync</h1>
      
      <button 
        onClick={triggerSync}
        className="btn btn-primary mb-4"
      >
        Trigger Sync
      </button>

      {status && (
        <div className="card mb-4">
          <h2 className="font-bold">Job Status</h2>
          <p>Processed: {status.processed_count}/{status.total_properties}</p>
          <p>Updated: {status.updated_count}</p>
          <p>Review: {status.review_count}</p>
        </div>
      )}

      <button onClick={fetchReviews} className="btn btn-secondary mb-4">
        Load Reviews ({reviews.length})
      </button>

      <div className="space-y-2">
        {reviews.map(review => (
          <div key={review.id} className="card p-4">
            <p>{review.properties.property_name}</p>
            <details>
              <summary>Changes</summary>
              <pre className="text-sm">{JSON.stringify(review.diff, null, 2)}</pre>
            </details>
            <div className="flex gap-2 mt-2">
              <button className="btn btn-sm btn-success">Approve</button>
              <button className="btn btn-sm btn-error">Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Support & Questions

- **Sync not triggering?** Check `property_sync_config.sync_enabled` and `next_sync_at`
- **Review queue full?** Check sync logs for patterns in flagged changes
- **Cost concerns?** Use `CostCalculator.estimateBatchCost()` to estimate impact
- **Need manual sync?** Call `/api/properties/sync` with specific property IDs

✨ System is ready to deploy!
