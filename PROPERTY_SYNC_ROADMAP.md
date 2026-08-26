# Property Sync System - Implementation Roadmap

## 📋 Pre-Deployment Checklist

### Database Layer
- [ ] Run migration file: `supabase/migrate-add-property-sync.sql`
- [ ] Verify 5 new tables created
- [ ] Verify `source_url` column added to properties
- [ ] Verify indexes created for performance
- [ ] Backup existing data

### Code Deployment
- [ ] Verify all library files present:
  - [ ] `src/lib/propertyExtractor.js`
  - [ ] `src/lib/propertyComparator.js`
  - [ ] `src/lib/propertyUpdater.js`
  - [ ] `src/lib/propertySync.js`
  - [ ] `src/lib/propertySyncCron.js`
  - [ ] `src/lib/propertysyncOptimization.js`
- [ ] Verify API routes:
  - [ ] `src/app/api/properties/sync/route.js`
  - [ ] `src/app/api/properties/review-queue/[[...path]]/route.js`
- [ ] Verify Netlify function:
  - [ ] `netlify/functions/sync-properties.js`
- [ ] Verify netlify.toml has scheduled_functions config
- [ ] Run `npm run build` - no errors
- [ ] Run `npm run lint` - passes

### Data Preparation
- [ ] Add `source_url` to all properties you want synced
- [ ] Validate URL format: starts with https://
- [ ] Test URLs are accessible (ping them)
- [ ] Ensure URLs return proper HTML (not error pages)

### Configuration
- [ ] Initialize `property_sync_config` for each account
- [ ] Set `sync_enabled = true`
- [ ] Choose `sync_frequency` (daily recommended)
- [ ] Tune `price_change_threshold_percent` (20% default)
- [ ] Set `batch_size` (10 default)
- [ ] Set `max_requests_per_minute` (30 default)

### Testing
- [ ] Test single property sync
- [ ] Check sync logs created
- [ ] Verify no data corruption
- [ ] Test review queue
- [ ] Test approve/reject flow
- [ ] Monitor for 5 syncs (24h)

### Monitoring Setup
- [ ] Set up error alerts (optional)
- [ ] Configure sync success monitoring
- [ ] Set up review queue alerts (if > 20 pending)
- [ ] Configure cost tracking
- [ ] Set up dashboard (optional)

### Team Training
- [ ] Train Lorenzo on review process
- [ ] Show how to view sync logs
- [ ] Explain safety rules
- [ ] Document escalation process

---

## 🗺️ Phase-by-Phase Implementation

### Phase 1: Foundation (Day 1)
**Time: 2-3 hours**

```bash
# 1. Run database migration
# In Supabase SQL Editor:
# Copy entire migrate-add-property-sync.sql
# Click "Run"

# 2. Deploy code
npm run build
npm run start
# or: netlify deploy

# 3. Initialize config
# SQL:
INSERT INTO property_sync_config (account_id, sync_enabled)
SELECT id, true FROM accounts;
```

**Deliverable**: System is deployed, tables exist

---

### Phase 2: Data Setup (Day 1-2)
**Time: 1-2 hours**

```bash
# 1. Add source_url to properties
# Option A: Manual SQL
UPDATE properties 
SET source_url = 'https://example.com/property/123'
WHERE id = 'prop-id';

# Option B: Bulk import
# Upload CSV with id, source_url columns

# Option C: From apartments
UPDATE properties p
SET source_url = a.url
FROM apartments a
WHERE p.apartment_id = a.id
AND p.source_url IS NULL;

# 2. Verify URLs
SELECT COUNT(*) as total,
       COUNT(source_url) as with_url,
       COUNT(CASE WHEN source_url IS NULL THEN 1 END) as missing
FROM properties
WHERE account_id = 'your-account-id';
```

**Deliverable**: All properties have source_url

---

### Phase 3: Testing (Day 2-3)
**Time: 2-3 hours**

```bash
# 1. Test single property sync
curl -X POST http://localhost:3000/api/properties/sync \
  -H "Content-Type: application/json" \
  -d '{"propertyIds": ["prop-uuid"], "batchSize": 1}'

# 2. Check results
SELECT * FROM property_sync_logs 
WHERE property_id = 'prop-uuid'
ORDER BY synced_at DESC
LIMIT 1;

# 3. Test with 10 properties
curl -X POST http://localhost:3000/api/properties/sync \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 10}'

# 4. Monitor review queue
SELECT * FROM property_review_queue
WHERE review_status = 'pending';

# 5. Test approval/rejection
curl -X POST http://localhost:3000/api/properties/review-queue/{id}/approve \
  -H "Content-Type: application/json" \
  -d '{"notes": "Approved"}'
```

**Deliverable**: System working, no errors

---

### Phase 4: Tuning (Day 3-4)
**Time: 1-2 hours**

```bash
# 1. Analyze first sync results
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN action_taken = 'updated' THEN 1 ELSE 0 END) as updated,
  SUM(CASE WHEN action_taken = 'review_pending' THEN 1 ELSE 0 END) as pending_review,
  SUM(CASE WHEN action_taken = 'ignored' THEN 1 ELSE 0 END) as ignored,
  SUM(CASE WHEN action_taken = 'error' THEN 1 ELSE 0 END) as errors
FROM property_sync_logs;

# 2. Adjust thresholds if needed
-- If too many in review queue:
UPDATE property_sync_config
SET price_change_threshold_percent = 30
WHERE account_id = 'your-account-id';

-- If too many ignored:
UPDATE property_sync_config
SET price_change_threshold_percent = 15
WHERE account_id = 'your-account-id';

# 3. Optimize batch size based on errors
-- If errors due to rate limiting:
UPDATE property_sync_config
SET batch_size = 5, max_requests_per_minute = 20
WHERE account_id = 'your-account-id';

-- If things are working well:
UPDATE property_sync_config
SET batch_size = 20, max_requests_per_minute = 50
WHERE account_id = 'your-account-id';
```

**Deliverable**: System tuned for your market

---

### Phase 5: Production Go-Live (Day 5)
**Time: 1 hour**

```bash
# 1. Final verification
npm run build  # Ensure no errors
npm run start  # Test locally

# 2. Deploy to production
netlify deploy  # or your deployment method

# 3. Enable scheduled function
# Already configured in netlify.toml
# Runs daily at 2 AM UTC automatically

# 4. Verify cron scheduled
# Check Netlify dashboard for scheduled functions

# 5. Set up monitoring
# Optional: Configure alerts in Supabase
# Optional: Set up dashboard for reviewing results daily
```

**Deliverable**: System live with automatic daily syncs

---

### Phase 6: Ongoing Operations (Weekly)
**Time: 30 min per week**

```bash
# Weekly tasks:
# 1. Review pending items
SELECT COUNT(*) FROM property_review_queue 
WHERE review_status = 'pending';

# 2. Approve/reject with notes
# 3. Check sync success rate
SELECT 
  DATE(synced_at) as date,
  COUNT(*) as total,
  SUM(CASE WHEN action_taken = 'error' THEN 1 ELSE 0 END) as errors,
  ROUND(100.0 * (COUNT(*) - SUM(CASE WHEN action_taken = 'error' THEN 1 ELSE 0 END)) / COUNT(*), 1) as success_rate
FROM property_sync_logs
WHERE synced_at > NOW() - '7 days'::interval
GROUP BY DATE(synced_at)
ORDER BY date DESC;

# 4. Monitor costs (monthly)
SELECT 
  COUNT(*) as total_syncs,
  (COUNT(*) * 5000 * 0.15 / 1000000.0) as est_input_cost,
  (COUNT(*) * 500 * 0.6 / 1000000.0) as est_output_cost
FROM property_sync_logs
WHERE synced_at > NOW() - '30 days'::interval;
```

**Deliverable**: Healthy ongoing operation

---

## 🚨 Troubleshooting During Implementation

### Issue: Migration fails
**Solution**: 
1. Check syntax (run in Supabase editor directly)
2. Ensure you have admin access
3. Check for existing table/column names

### Issue: API routes return 404
**Solution**:
1. Verify file paths are correct
2. Check `next build` succeeds
3. Clear `.next` folder and rebuild

### Issue: OpenAI extraction fails
**Solution**:
1. Verify `OPENAI_API_KEY` is set
2. Check API key is valid
3. Check usage limits not exceeded
4. Test with `curl -H "Authorization: Bearer $KEY"`

### Issue: No properties syncing
**Solution**:
1. Check `sync_enabled = true`
2. Verify `source_url` is set
3. Check `next_sync_at` is in past
4. Verify `sync_frequency` matches expected

### Issue: Review queue growing too fast
**Solution**:
1. Increase `price_change_threshold_percent`
2. Check extraction quality
3. Verify URLs return actual listings

---

## 💰 Cost Estimation

### OpenAI API Costs
- Input: ~5,000 tokens per property @ $0.15/1M = $0.00075
- Output: ~500 tokens per property @ $0.6/1M = $0.0003
- **Per sync: ~$0.001 per property**

### Examples
- 100 properties, daily: $0.10 × 30 = **$3/month**
- 500 properties, daily: $0.50 × 30 = **$15/month**
- 1000 properties, daily: $1.00 × 30 = **$30/month**

### Cost Optimization
- Reduce frequency: daily → weekly saves 86%
- Smaller batches: Less concurrent API calls
- Cache enabled: Skip unchanged URLs
- Selective syncing: Only active listings

---

## 📊 Success Metrics

By end of Phase 5, you should see:

| Metric | Target | Monitor |
|--------|--------|---------|
| Sync Success | > 95% | `property_sync_logs.action_taken` |
| Review Rate | 5-10% | Items in `property_review_queue` |
| Update Rate | 2-5% | Records with `action_taken = 'updated'` |
| Error Rate | < 5% | Check `action_taken = 'error'` |
| Avg Duration | < 5 min | Job `completed_at - started_at` |
| Cost/property | $0.001-0.002 | OpenAI API usage |

---

## 🎯 Post-Launch Monitoring

### Daily
- [ ] Cron job ran (check Netlify logs)
- [ ] No critical errors
- [ ] Review queue < 20 items

### Weekly
- [ ] Success rate > 95%
- [ ] Approve/reject pending reviews
- [ ] Check for patterns in flagged items

### Monthly
- [ ] Review cost vs budget
- [ ] Analyze extraction quality
- [ ] Adjust thresholds if needed

---

## 📞 Support Contacts

For issues:
1. Check **PROPERTY_SYNC_GUIDE.md** for architecture
2. Check **PROPERTY_SYNC_SETUP.md** for troubleshooting
3. Review logs in `property_sync_logs` table
4. Check OpenAI API status

---

## ✅ Launch Readiness Checklist

Before flipping the switch:

- [ ] Database migration applied ✓
- [ ] All code deployed ✓
- [ ] source_url added to properties ✓
- [ ] Single property sync test successful ✓
- [ ] 10-property batch test successful ✓
- [ ] Review queue works ✓
- [ ] Approve/reject works ✓
- [ ] Thresholds tuned ✓
- [ ] Team trained ✓
- [ ] Monitoring ready ✓
- [ ] Cost estimate acceptable ✓

**Once all boxes checked: READY FOR PRODUCTION** 🚀

---

## 📞 Quick Reference Commands

### Database Queries
```sql
-- Check sync status
SELECT * FROM property_sync_jobs ORDER BY started_at DESC LIMIT 5;

-- View recent logs
SELECT * FROM property_sync_logs ORDER BY synced_at DESC LIMIT 20;

-- Check pending reviews
SELECT * FROM property_review_queue WHERE review_status = 'pending';

-- Success rate today
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN action_taken = 'error' THEN 1 ELSE 0 END) as errors
FROM property_sync_logs
WHERE DATE(synced_at) = CURRENT_DATE;
```

### API Calls
```bash
# Trigger sync
curl -X POST http://localhost:3000/api/properties/sync \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 10}'

# Get status
curl "http://localhost:3000/api/properties/sync?jobId=JOB_ID"

# Get reviews
curl "http://localhost:3000/api/properties/review-queue"

# Approve
curl -X POST "http://localhost:3000/api/properties/review-queue/REVIEW_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"notes": "OK"}'
```

---

**Everything is built and ready. Follow this roadmap for smooth deployment!** 🎉
