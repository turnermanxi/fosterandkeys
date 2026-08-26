# CSV Import Guide for Properties

This guide explains how to import properties into the Foster & Keys dashboard from a CSV (Comma-Separated Values) file.

## Quick Start

1. Click the **📁 Import CSV** button in the Properties tab
2. Download the template CSV file to see the exact column format
3. Fill in your property data matching the column names exactly
4. Select your file and click **Import Properties**
5. Review the preview before importing

## Important: Column Names Must Match Exactly

**Column names are CASE SENSITIVE**. They must match exactly as shown below. A column named "Address" (with capital A) will not work - it must be "address" (lowercase).

## Required Columns

These columns MUST be present in your CSV file:

| Column Name | Data Type | Example | Notes |
|------------|-----------|---------|-------|
| `address` | Text | 123 Main Street | Street address (required) |
| `city` | Text | Houston | City name (required) |

## Optional Columns

All other columns are optional. If you don't have data for a column, you can either:
- Leave it blank in the CSV
- Omit the column entirely from your CSV file

| Column Name | Data Type | Example | Notes |
|------------|-----------|---------|-------|
| `state` | Text | TX | State abbreviation. Defaults to "TX" if omitted |
| `zip` | Text | 77001 | ZIP code |
| `property_name` | Text | Park Avenue Lofts | Name/display name for property |
| `price_min` | Number | 1500 | Minimum rent/price |
| `price_max` | Number | 2500 | Maximum rent/price |
| `bedrooms` | Number | 2 | Number of bedrooms |
| `bathrooms` | Number | 2 | Number of bathrooms (can be decimal: 1.5) |
| `sqft` | Number | 950 | Square footage |
| `property_type` | Text | apartment | Can be: apartment, house, condo, townhome |
| `pet_friendly` | Boolean | true | Accepts pets: true, false, yes, no, 1, 0 |
| `accepts_evictions` | Boolean | false | Accepts people with evictions |
| `accepts_broken_leases` | Boolean | false | Accepts people with broken leases |
| `accepts_low_credit` | Boolean | true | Accepts people with low credit scores |
| `accepts_itin` | Boolean | true | Accepts ITIN instead of SSN |
| `accepts_second_chance` | Boolean | true | Second chance/housing program |
| `admin_fee` | Number | 150 | Administrative fee amount |
| `app_fee` | Number | 50 | Application fee amount |
| `deposit_info` | Text | 1 month's rent | Deposit requirements |
| `contact_name` | Text | John Doe | Property manager/contact name |
| `contact_phone` | Text | 713-555-1234 | Contact phone number |
| `contact_email` | Text | john@apt.com | Contact email address |
| `website` | Text | https://parkavenueapts.com | Property website URL |
| `notes` | Text | Recently renovated | Any additional notes |

## Boolean Columns

For columns like `pet_friendly`, `accepts_evictions`, etc., use any of these values:

**For TRUE:**
- `true` (recommended)
- `yes`
- `1`
- `y`

**For FALSE:**
- `false` (recommended)
- `no`
- `0`
- `n`

**For EMPTY/NULL:**
- Leave the cell blank

## CSV Format Example

Here's a properly formatted CSV with a few properties:

```csv
address,city,state,zip,property_name,price_min,price_max,bedrooms,bathrooms,sqft,property_type,pet_friendly,accepts_evictions,accepts_broken_leases,accepts_low_credit,accepts_itin,accepts_second_chance,admin_fee,app_fee,deposit_info,contact_name,contact_phone,contact_email,website,notes
123 Main Street,Houston,TX,77001,Park Avenue Lofts,1500,2500,2,2,950,apartment,true,false,false,true,true,true,150,50,1 month's rent,John Doe,713-555-1234,john@apt.com,https://parkavenueapts.com,Recently renovated
456 Oak Avenue,Dallas,TX,75201,Riverside Complex,2000,3000,3,2,1200,apartment,false,true,true,false,false,true,200,75,1.5 month's rent,Jane Smith,214-555-5678,jane@riverside.com,https://riversidecomplex.com,Pool and gym
789 Elm Road,Austin,TX,78702,,1800,2200,2,1,,house,yes,no,no,yes,yes,no,100,25,,Mike Johnson,512-555-9876,mike@property.com,,
```

## Common Issues & Solutions

### Issue: "CSV must include 'address' and 'city' columns"

**Cause:** The CSV file is missing the `address` or `city` column, or they are spelled differently.

**Solution:** Make sure your CSV file has headers named exactly:
- `address` (not "Address", "ADDR", "street", etc.)
- `city` (not "City", "town", "location", etc.)

### Issue: Column names not recognized

**Cause:** Column names don't match exactly (case matters!)

**Solution:** Check for these common mistakes:
- `Address` should be `address`
- `Price Min` should be `price_min`
- `Phone Number` should be `contact_phone`

### Issue: Data being imported incorrectly

**Cause:** Column names might be misspelled or use spaces instead of underscores

**Solution:** Compare your column names letter-by-letter with the list above

### Issue: Some properties not imported / Duplicates flagged

**Cause:** The system detected potential duplicates (same address, city, or similar)

**Solution:** 
- Review the duplicates shown in the import results
- Correct any duplicate entries in your source data
- You can re-import after fixing

## Tips for Best Results

1. **Use the Template:** Download the CSV template from the import dialog - it has all columns in the correct format
2. **Validate Before Importing:** The system will show you a preview of the first 5 rows before importing
3. **Required Fields Only:** At minimum, you MUST have `address` and `city` - everything else is optional
4. **No Extra Columns:** Unknown columns will be ignored (won't cause errors, just unused)
5. **Dealing with Quotes:** If your data contains commas, wrap the value in quotes:
   - `"123 Main Street, Suite 200"` (correct)
   - `123 Main Street, Suite 200` (will break the CSV)

## File Format Requirements

- **File Type:** .csv only (plain text CSV format)
- **Encoding:** UTF-8 (standard text encoding)
- **Headers:** First row must contain column names
- **Minimum:** At least 2 columns (address, city) and 1+ data rows

## Getting Help

If you encounter issues:
1. Check the validation message - it will tell you which row has a problem
2. Look at the column list above to ensure exact spelling
3. Download the template and compare your format
4. Test with the example CSV provided in the template

## Keyboard Shortcuts in CSV Editor

When creating/editing your CSV file:
- Most spreadsheet programs can save as CSV format
- Excel: File → Save As → CSV (Comma delimited) (.csv)
- Google Sheets: File → Download → Comma-separated values (.csv)
