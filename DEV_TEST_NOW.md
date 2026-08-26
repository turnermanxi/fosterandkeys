# 🎉 Property Sync - DevMode Testing (Super Simple)

## Start Testing in Dev Mode - 30 Seconds

```bash
# Terminal 1: Start the dev server
cd /home/turnermanxi/Documents/fosterandkeys
npm run dev

# Terminal 2: Visit the test page
# Open your browser to:
http://localhost:3000/demo/sync
```

**That's it!** You'll see a test page with buttons. Click them to test the system. ✅

---

## What You'll See

### Test 1: Comparison Logic
Click the button and see:
- Mock property data
- Extracted data (with price change)
- Comparison results showing:
  - ✅ Changed fields detected
  - ✅ Safety rules applied
  - ✅ Update decision made

### Test 2: Cost & Utilities  
Click the button and see:
- Cost estimate for 100 properties: **$0.105** (~$0.001/property)
- Cost per property breakdown
- Rate limiter status: **Ready ✅**

---

## How It Works

While you're running `npm run dev`:

**Browser** → Page at `/demo/sync`
     ↓
**Click Test Buttons** → Calls API routes
     ↓
**API Routes** at `/api/demo/*` → Run the sync logic
     ↓
**Mock Data** → Flows through comparison engine
     ↓
**Results** → Displayed in browser instantly

No database needed. No authentication needed. Just pure logic testing.

---

## Files That Make This Work

Check these while testing:
- **Frontend**: `src/app/demo/sync/page.js` - The UI with test buttons
- **API**: `src/app/api/demo/sync-test/route.js` - Tests comparison logic
- **API**: `src/app/api/demo/utilities/route.js` - Tests cost calculator
- **Logic**: `src/lib/propertyComparator.js` - The actual comparison logic

---

## What Gets Tested

✅ **Comparison Logic**
- Property A has price_min: $1500
- Property B (extracted) has price_min: $1600
- System detects 6.7% change
- Compares to 20% threshold
- Decision: **Safe to update** (auto-approve)

✅ **Cost Calculator**
- 100 properties = **$0.10/sync**
- 1000 properties = **$1.00/sync**
- Track your actual costs

✅ **Rate Limiter**
- Prevents API floods
- 30 requests per minute max
- Automatically throttles

---

## 🔍 See It Live

The test page shows:
```
Mock Property: Sunset Apartments
Price Change: $1500 → $1600 (6.7%)
Changed Fields: price_min, price_max
Should Update: ✅ Yes
Needs Review: ❌ No

Full Diff:
[
  { field: "price_min", old: 1500, new: 1600 },
  { field: "price_max", old: 2500, new: 2600 }
]
```

---

## ✨ That's All!

No build needed. No deployment. No database. Just:

```bash
npm run dev
# Visit: http://localhost:3000/demo/sync
# Click buttons
# See it work ✅
```

Done! 🎉

---

## Questions?

Q: Do I need a database?
A: No! Tests use mock data only.

Q: Do I need to authenticate?
A: No! Demo endpoint is open.

Q: Can I modify the test data?
A: Yes! Edit `src/app/demo/sync/page.js` and `src/app/api/demo/*.js`

Q: What about real property syncing?
A: Follow `PROPERTY_SYNC_SETUP.md` once you're ready to use real data.

---

**Ready? Run `npm run dev` and visit `/demo/sync`** 🚀
