# Property Sync System - Quick Testing Guide

## ⚡ Start Testing in 5 Minutes

### Setup

```bash
# 1. Make sure you're in the project directory
cd /home/turnermanxi/Documents/fosterandkeys

# 2. Install dependencies (if not already done)
npm install

# 3. (Optional) Set OpenAI key for extraction testing
export OPENAI_API_KEY=sk-your-key-here
```

---

## 🧪 Test #1: Verify Imports (No Dependencies)

**What it tests**: All library files can be imported without errors

```bash
node -e "
import('./src/lib/propertySync.test.js').then(m => m.testImports());
"
```

**Expected Output**:
```
✓ propertyExtractor.js
✓ propertyComparator.js
✓ propertyUpdater.js
✓ propertySync.js
✓ propertySyncCron.js
✓ propertysyncOptimization.js

✅ All imports successful!
```

---

## 🧪 Test #2: Test Comparison Logic

**What it tests**: Compare extracted vs existing data, detect changes, apply safety rules

```bash
node -e "
import('./src/lib/propertySync.test.js').then(m => m.testComparison());
"
```

**Expected Output**:
```
Comparison Result:
{
  "should_update": true,
  "needs_review": false,
  "diff": [
    {
      "field": "price_min",
      "old_value": 1500,
      "new_value": 1600,
      "changed": true
    },
    {
      "field": "price_max",
      "old_value": 2500,
      "new_value": 2600,
      "changed": true
    }
  ],
  "reasons": [],
  "changedFields": ["price_min", "price_max"],
  "nullFieldsCount": 0
}

✅ Changes detected: price_min, price_max
```

---

## 🧪 Test #3: Test Data Validation

**What it tests**: Handling of nulls, type conversion, array normalization

```bash
node -e "
import('./src/lib/propertySync.test.js').then(m => m.testValidation());
"
```

**Expected Output**:
```
Test 1: Handling null values
Input with nulls: { property_name: 'Test Property', address: null, city: 'Houston', price_min: null, price_max: 2000 }
✓ Should be handled safely

Test 2: Type conversion
String inputs: { bedrooms: '2', bathrooms: '1.5', sqft: '900' }
✓ Should convert to numbers

Test 3: Array handling
Array with null: [ 'Pool', 'Gym', null, 'Parking' ]
✓ Should filter nulls

✅ Validation tests complete
```

---

## 🧪 Test #4: Test Cost Calculator

**What it tests**: Cost estimation for batches and actual usage

```bash
node -e "
import('./src/lib/propertySync.test.js').then(m => m.testCostCalculator());
"
```

**Expected Output**:
```
Cost Estimate (100 properties):
{
  propertyCount: 100,
  estimatedInputTokens: 500000,
  estimatedOutputTokens: 50000,
  inputCost: '0.0750',
  outputCost: '0.0300',
  totalCost: '0.1050',
  costPerProperty: '0.0011'
}

Actual Cost (500k input tokens, 50k output):
{
  inputTokens: 500000,
  outputTokens: 50000,
  inputCost: '0.0750',
  outputCost: '0.0300',
  totalCost: '0.1050'
}

✅ Cost calculator working
```

---

## 🧪 Test #5: Test Rate Limiter

**What it tests**: Rate limiter prevents API floods

```bash
node -e "
import('./src/lib/propertySync.test.js').then(m => m.testRateLimiter());
"
```

**Expected Output**:
```
Making 5 requests with 3 req/s limit...
✓ Request 1 at 2024-04-22T14:30:00.000Z
✓ Request 2 at 2024-04-22T14:30:00.100Z
✓ Request 3 at 2024-04-22T14:30:00.200Z
✓ Request 4 at 2024-04-22T14:30:01.050Z
✓ Request 5 at 2024-04-22T14:30:01.150Z

✅ Rate limiter working
```

---

## 🧪 Test #6: Test OpenAI Extraction (Requires API Key)

**What it tests**: Actual extraction from HTML using OpenAI

⚠️ **Requires**: `OPENAI_API_KEY` environment variable

```bash
# First, set your API key
export OPENAI_API_KEY=sk-your-actual-key-here

# Then run the test
node -e "
import('./src/lib/propertySync.test.js').then(m => m.testExtraction());
"
```

**Expected Output**:
```
Sending test HTML to OpenAI...

✅ Extraction successful!

Extracted Data:
{
  "property_name": "Sunset Apartments",
  "address": "123 Main St",
  "city": "Houston",
  "state": "TX",
  "zip": "77001",
  "price_min": 1600,
  "price_max": 2600,
  "bedrooms": 2,
  "bathrooms": 1.5,
  "sqft": 900,
  "pet_friendly": true,
  "accepts_evictions": false,
  "accepts_broken_leases": true,
  "amenities": ["Pool", "Gym", "Parking", "Courtyard"]
}
```

---

## 🧪 Test #7: Run All Tests at Once

**What it tests**: Everything in one go

```bash
export OPENAI_API_KEY=sk-your-key-here  # Optional but recommended
node -e "
import('./src/lib/propertySync.test.js').then(m => m.runAllTests());
"
```

---

## 📝 Create a Test Script

For easier testing, create `test-property-sync.js`:

```javascript
#!/usr/bin/env node

import('./src/lib/propertySync.test.js').then(m => {
  m.runAllTests();
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
```

Make it executable:
```bash
chmod +x test-property-sync.js
node test-property-sync.js
```

---

## 🧪 Manual API Testing

Once the dev server is running, test the API endpoints:

### Test Sync Endpoint (Manual)

```bash
# Start dev server first
npm run dev

# In another terminal, trigger a test sync:
curl -X POST http://localhost:3000/api/properties/sync \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_AUTH_COOKIE" \
  -d '{
    "propertyIds": ["test-property-id"],
    "batchSize": 1
  }'
```

### Expected Response:
```json
{
  "success": true,
  "jobId": "job-uuid-here",
  "stats": {
    "total": 1,
    "successful": 0,
    "updated": 0,
    "reviewed": 0,
    "ignored": 1,
    "failed": 0
  }
}
```

---

## 🚀 Complete Testing Checklist

Run these in order:

- [ ] Test 1: Imports
- [ ] Test 2: Comparison
- [ ] Test 3: Validation
- [ ] Test 4: Cost Calculator
- [ ] Test 5: Rate Limiter
- [ ] Test 6: OpenAI Extraction (with API key)
- [ ] Test 7: Run All Tests

Then for integration:

- [ ] Start dev server: `npm run dev`
- [ ] Test API routes in separate terminal
- [ ] Check logs for errors
- [ ] Verify no TypeScript/build errors

---

## 🔍 Debugging

### If imports fail:
```bash
node -e "
try {
  require('./src/lib/propertyExtractor.js');
  console.log('✓ Found');
} catch(e) {
  console.error('✗ Error:', e.message);
}
"
```

### If OpenAI extraction fails:
```bash
# Check your API key is set
echo $OPENAI_API_KEY

# Verify it starts with 'sk-'
# If empty, set it: export OPENAI_API_KEY=sk-...
```

### If cost calculator fails:
```bash
node -e "
const opt = require('./src/lib/propertysyncOptimization.js');
console.log(opt.CostCalculator.estimateBatchCost(10));
"
```

---

## 💡 Testing Tips

1. **Start with imports** - Fastest way to catch syntax errors
2. **Then test comparison** - Core business logic
3. **Test extraction** only if you have OpenAI key
4. **Check rate limiter** - Critical for production
5. **Run full suite** when ready to verify everything

---

## ✅ Testing = Ready

Once all tests pass:
- ✅ Code is syntactically correct
- ✅ Core logic works
- ✅ Safety rules are applied
- ✅ APIs would work
- ✅ Ready for actual property sync testing

---

**Next**: Once tests pass, follow `PROPERTY_SYNC_SETUP.md` to test with real data

Let's go! 🚀
