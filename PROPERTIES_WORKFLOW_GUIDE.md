# Properties Workflow Guide

## Overview

The properties system allows Lorenzo to:
1. **Manage properties** in a centralized Properties dashboard
2. **Link properties to leads** - Select which properties to share with each customer
3. **Send properties with lead responses** - Properties are included in the PDF/email sent to customers
4. **Track property performance** - See which properties are sent to which leads

## How the System Works

### Part 1: Adding Properties

**Option A: Manual Entry**
1. Go to **Dashboard → Properties tab**
2. Click **+ Add Property**
3. Fill in property details:
   - Address (required)
   - City (required)
   - State (default: TX)
   - Rent/Price range
   - Beds/Baths
   - Acceptance criteria (pet-friendly, eviction history, etc.)
   - Contact information
   - Website URL
   - Custom notes and tags
4. Click Save

**Option B: CSV Import**
1. Go to **Dashboard → Properties tab**
2. Click **📁 Import CSV**
3. Download the template or prepare a spreadsheet with exact column names
4. Select your CSV file
5. Review the preview
6. Click "Import Properties"

**Column names MUST match exactly** - See CSV_IMPORT_GUIDE.md for details

### Part 2: Using Properties with Leads

When viewing a lead in the Leads dashboard:

1. **Open lead detail** - Click on the lead to view details
2. **Go to Properties tab** - Click the **🏠 Properties** tab
3. **Select properties to share** - Check the boxes for properties you want to send to this customer
4. **Search/Filter** - Use the search box to find specific properties by address or city
5. **Click Save Selection** - This saves which properties go with this lead

### Part 3: Sending Leads with Properties

1. **Prepare the lead** - Add AI summary, review matches
2. **Select properties** - Go to the Properties tab and select which properties to include
3. **Click "Send to Client"** - This:
   - Records the selected properties for this lead
   - Sends the results email to the customer
   - Stores the send date/time
   - Makes properties available in the customer portal

### Part 4: Customer Receives Properties

When the customer clicks the link in their email:
- They see all matched apartments (from the lead_matches)
- They see all properties Lorenzo selected (from lead_property_selections)
- They can leave feedback on which properties interest them

## Key Features

### Dynamic Updates
- **When you add a new property** to the Properties dashboard, it instantly appears as an option for all leads
- **Sales history** - All property selections are tracked in the `lead_property_selections` table
- **No need to re-add** - Properties persist across multiple leads

### Property Selection Management
- **Search** - Filter properties by address, city, or name
- **Favorite marking** - Star properties you recommend often (shows in list)
- **Bulk selection** - Select multiple properties for a single lead
- **Count display** - See how many properties are selected (e.g., "🏠 Properties (3)")

### Tracking & Reporting
Properties sent to leads are tracked in `property_sends` table with:
- Which property was sent
- Which lead it was sent to
- What email it was sent to
- When it was sent

## Database Schema

### Key Tables

**properties**
- id, account_id, property_name, address, city, state, zip
- price_min, price_max, bedrooms, bathrooms, sqft
- pet_friendly, accepts_evictions, accepts_broken_leases, accepts_low_credit, accepts_itin, accepts_second_chance
- admin_fee, app_fee, deposit_info
- contact_name, contact_phone, contact_email, website
- is_favorite, is_archived, created_at, updated_at

**lead_property_selections** (Lead-Property link)
- lead_id, property_id, account_id, selected_at
- Tracks which properties Lorenzo chooses to send with each lead
- One row per selected property per lead

**property_sends** (Audit trail)
- property_id, lead_id, account_id, sent_to_email, sent_at
- Records when properties are actually sent to customers
- Populated when "Send to Client" button is clicked

## Workflow Examples

### Example 1: Multiple new leads, same properties
1. Add 5 properties to Properties dashboard (💾 Save)
2. Process Lead #1 - go to Properties tab, select all 5 properties, save
3. Process Lead #2 - go to Properties tab, those same 5 properties appear. Select any you want (could be different subset)
4. Add new property → Instantly available for Lead #3's Properties tab

### Example 2: Property gets updated
1. Lead comes in, select 3 properties to send
2. You realize one property has new contact info
3. Open Properties tab, edit the property details
4. The change is reflected immediately for all leads

### Example 3: Adding properties after lead intake
1. Customer comes in via intake form (no properties sent yet)
2. Lorenzo adds properties to Properties dashboard the next week
3. Goes back to that lead
4. All new properties available in Properties tab
5. Selects some and sends updated recommendations

## API Endpoints (For Developers)

### Get all properties for lead
```
GET /api/leads/[id]/properties
Response: { properties: [...], selectedCount: N }
```

### Update property selections
```
POST /api/leads/[id]/properties
Body: { propertyIds: ["id1", "id2", ...] }
```

### Property CRUD
```
GET /api/properties?search=Houston&limit=50
POST /api/properties (create)
PATCH /api/properties/[id] (update)
DELETE /api/properties/[id] (archive/delete)
```

## Troubleshooting

### "No properties available yet" message
**Problem:** Properties tab shows this message in lead detail
**Solution:** 
1. Go to Properties dashboard
2. Click "+ Add Property" to add your first property
3. OR use "📁 Import CSV" to bulk import properties
4. Refresh the lead detail page

### Properties not showing in Properties dashboard
**Problem:** Properties tab on dashboard shows "No properties yet"
**Possible causes:**
- No properties have been added yet
- Migrations haven't been run (ask developer to run migrate-add-properties.sql and migrate-add-lead-properties.sql)
- Properties are archived (check filters)

**Solution:**
1. Add properties manually, or
2. Import from CSV, or
3. Contact developer to run database migrations

### Selected properties not saved
**Problem:** Selected properties in lead Properties tab don't persist
**Solution:**
1. Make sure to click "Save Selection" button
2. Check browser console for errors (F12 → Console tab)
3. Verify you have proper account/authentication

### Properties not appearing in customer email
**Problem:** Customer doesn't see selected properties in their results portal
**Solution:**
1. Make sure properties were selected in the Properties tab
2. Make sure "Save Selection" was clicked
3. Make sure "Send to Client" was clicked (this triggers property_sends records)
4. Properties are only visible in portal after send is complete

## Quick Reference

| Action | Location | Steps |
|--------|----------|-------|
| **Add property** | Properties tab → + Add Property | Fill form → Save |
| **Import properties** | Properties tab → 📁 Import CSV | Select file → Preview → Import |
| **Select for lead** | Lead detail → Properties tab | Check boxes → Save Selection |
| **Edit property** | Properties tab → Click property → Edit | Modify → Update |
| **Delete property** | Properties tab → Select → Archive | Confirm |
| **Send with lead** | Lead detail → Properties tab → Back to main → Send | Save selections → Send to Client |
| **View sent properties** | Reports section (coming soon) | Filter by date/lead |

## Notes for Lorenzo

✅ **Properties persist** - Once added, they're available for all future leads
✅ **No required fields** - Only address + city are required
✅ **Flexible tags** - Add custom tags for easy filtering
✅ **Favorites work** - Star (⭐) your go-to properties for quick reference
✅ **Bulk import** - CSV import saves time for large property lists
✅ **Changes are instant** - Edit a property and changes appear everywhere immediately
