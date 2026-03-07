-- seed.sql
-- Cleaned + deduped from your pasted list
-- Schema: apartments (one row per property) + units (multiple rows per property)
-- Postgres-friendly (Supabase)

BEGIN;

-- ---------- APARTMENTS (DEDUPED) ----------
INSERT INTO apartments
(slug, name, metro_area, city, deposit_min, deposit_max, app_fee, admin_fee, income_multiplier, lease_min_months, lease_max_months, specials, notes, url, accepts_broken_lease, accepts_bankruptcy, accepts_eviction)
VALUES
-- Houston Metro
('country-club-apartments', 'Country Club Apartments', 'HOUSTON_METRO', NULL, 150, NULL, 75, 175, 3.00, 6, 12, NULL, 'Additional covered parking available: $25/month.', 'https://www.countryclubmesquite.com/floor-plans', NULL, NULL, NULL),
('falltree', 'Falltree', 'HOUSTON_METRO', NULL, 250, NULL, 50, 50, 2.50, 12, 12, '1 month free w/12+ mo', NULL, NULL, NULL, NULL, NULL),
('sunset-shadows', 'Sunset Shadows', 'HOUSTON_METRO', NULL, 200, NULL, 45, 150, 3.00, 6, 13, NULL, 'Washer & Dryer connections.', 'https://www.sunsetshadows-apartments.com/check-availability-apply/', NULL, NULL, NULL),
('castlewood', 'Castlewood', 'HOUSTON_METRO', NULL, 200, NULL, 55, 150, 3.00, 6, 13, NULL, 'On-site laundry.', 'https://www.castlewood-apartments.com/floor-plans/', NULL, NULL, NULL),
('estates-at-spring-branch', 'Estates at Spring Branch', 'HOUSTON_METRO', NULL, 200, NULL, 55, 150, 3.00, 6, 13, NULL, 'On-site laundry.', 'https://www.estates-springbranch.com/floor-plans/', NULL, NULL, NULL),
('green-arbor', 'Green Arbor', 'HOUSTON_METRO', NULL, 220, 482, 65, 150, 3.00, 12, 13, NULL, 'Washer & Dryer connections.', 'https://www.greenarborapts.com/Floor-plans.aspx', NULL, NULL, NULL),
('campbell-grove', 'Campbell Grove', 'HOUSTON_METRO', NULL, 0, NULL, 100, NULL, 3.00, 6, 15, NULL, NULL, 'https://www.campbellgrove.com/floorplans/', NULL, NULL, NULL),
('bella-vida', 'Bella Vida', 'HOUSTON_METRO', NULL, 200, NULL, 99, 99, 3.00, 12, 18, '$49 1st month''s rent', NULL, 'https://www.bellavidaliving.com/floorplans/', NULL, NULL, NULL),
('heritage-at-hooper-hall', 'Heritage At Hooper Hall', 'HOUSTON_METRO', NULL, 250, NULL, 65, 100, 3.00, 3, 15, '2 months free rent if move in by 02/25', 'Move-in-by date year not provided.', 'https://hooperhill.com/floorplans/', NULL, NULL, NULL),
('driscoll-place', 'Driscoll Place', 'HOUSTON_METRO', NULL, 0, NULL, 65, 100, 3.00, 3, 15, 'Up to 2 months free. Reduced app/admin fees if apply within 24 hours of touring (restrictions apply).', NULL, 'https://www.driscollplaceapts.com/floor-plans', NULL, NULL, NULL),
('summit-at-champions', 'Summit At Champions', 'HOUSTON_METRO', NULL, 150, 200, 60, 150, 3.00, 6, 15, NULL, NULL, 'https://www.summitatchampions.com/floorplans', NULL, NULL, NULL),
('the-pines-at-woodcreek', 'The Pines At Woodcreek', 'HOUSTON_METRO', NULL, 250, NULL, 65, 100, 3.00, 3, 15, '2 months free rent if move in by 02/14', 'Move-in-by date year not provided.', 'https://www.thepinesatwoodcreek.com/', NULL, NULL, NULL),
('the-veranda-at-centerpoint', 'The Veranda at Centerpoint', 'HOUSTON_METRO', NULL, 175, NULL, 75, 150, 3.00, 3, 15, '1 mo free w/12+ mo', NULL, 'https://verandaatcenterfield.com/floorplans/', NULL, NULL, NULL),
('the-abby-at-conroe', 'The Abby At Conroe', 'HOUSTON_METRO', 'Conroe', 175, NULL, 50, 150, 3.00, 6, 12, NULL, NULL, 'https://www.abbeyresidential.com/apartments/tx/conroe/interstate-45-north/floor-plans', NULL, NULL, NULL),
('cypress-lake', 'Cypress Lake', 'HOUSTON_METRO', NULL, NULL, NULL, 50, 150, 2.50, 3, 12, '$99 Move-in', 'Deposit listed as "credit" (stored as NULL).', 'https://www.cypresslakeapartments.com/floorplans/', NULL, NULL, NULL),
('landmark-at-grand-champion', 'Landmark at Grand Champion', 'HOUSTON_METRO', NULL, 200, NULL, 60, 75, 3.00, 6, 12, '8 weeks free', NULL, 'https://www.landmarkgrandchampionapts.com/floorplans/', NULL, NULL, NULL),
('edgewater-at-klein-east', 'Edgewater at Klein-East', 'HOUSTON_METRO', NULL, 188, NULL, 60, 200, 3.00, 2, 14, NULL, NULL, 'https://www.edgewateratklein.com/apartments/tx/spring/floor-plans', NULL, NULL, NULL),
('the-preston', 'The Preston', 'HOUSTON_METRO', NULL, 350, NULL, 60, 150, 2.50, 6, 15, 'Up to 8 weeks free', NULL, 'https://www.liveatthepreston.com/apartments/tx/spring/floor-plans', NULL, NULL, NULL),
('the-abby-at-briargrove', 'The Abby at Briargrove', 'HOUSTON_METRO', NULL, 200, NULL, 60, 150, 3.00, 6, 18, NULL, 'Washer & Dryer connections.', 'https://www.abbeyresidential.com/apartments/tx/houston/briar-forest/floor-plans', NULL, NULL, NULL),
('montabella-at-oak-forest', 'Montabella at Oak Forest', 'HOUSTON_METRO', NULL, 250, NULL, 50, 150, 3.00, 12, 13, '1 mo free w/12+ mo', NULL, 'https://www.montabellaapartments.com/floorplans/', NULL, NULL, NULL),
('estates-at-westchase', 'Estates at Westchase', 'HOUSTON_METRO', NULL, 250, NULL, 50, 150, 3.00, 12, 13, '1 mo free w/12+ mo', NULL, 'https://www.theestatesatwestchase.com/floorplans/', NULL, NULL, NULL),
('lakeview', 'Lakeview', 'HOUSTON_METRO', NULL, 175, 350, 75, NULL, 3.00, 6, 13, NULL, 'Admin fee not provided. Washer & Dryer in-unit.', 'https://www.thelakeviewapartments.com/floorplans/', NULL, NULL, NULL),
('the-abby-at-memorial', 'The Abby at Memorial', 'HOUSTON_METRO', NULL, 200, NULL, 60, 150, 3.00, 6, 18, NULL, 'Washer & Dryer connections.', 'https://www.abbeyresidential.com/apartments/tx/houston/memorial/', NULL, NULL, NULL),
('sedona-square', 'Sedona Square', 'HOUSTON_METRO', NULL, 500, NULL, 50, 200, 2.50, 3, 15, '$500 off 2nd mo w/12+ mo', NULL, 'https://www.sedonasquare.com/floorplans', NULL, NULL, NULL),
('serena-woods', 'Serena Woods', 'HOUSTON_METRO', NULL, 150, NULL, 50, 75, 3.00, 3, 14, '$500 off 2nd mo w/12+ mo', 'Sqft looked like a typo in your paste (12058). Stored as-is below with a note.', 'https://www.villaserenacommunities.com/serena-woods/gallery', NULL, NULL, NULL),

-- Dallas-Fort Worth Metro
('maverick-oak-lawn', 'Maverick Oak Lawn', 'DFW_METRO', NULL, 150, NULL, 75, 175, 3.00, 6, 12, NULL, 'Additional covered parking available: $25/month.', NULL, NULL, NULL, NULL),
('abstract-at-district-design', 'Abstract at District Design', 'DFW_METRO', NULL, 150, 750, 85, 200, 2.00, 2, 15, '$1000 off 1st month', NULL, 'https://www.abstractdesigndistrict.com/', NULL, NULL, NULL),
('skyline-trinity', 'Skyline Trinity', 'DFW_METRO', NULL, 500, NULL, 75, 200, 3.00, 6, 15, NULL, NULL, 'https://www.skylinetrinity.com/', NULL, NULL, NULL),
('southside-flats', 'Southside Flats', 'DFW_METRO', NULL, 500, NULL, 75, 200, 3.00, 6, 15, '$6 weeks free', NULL, 'https://www.southsideflatsapts.com/floorplans', NULL, NULL, NULL),
('pike-west-commerce', 'Pike West Commerce', 'DFW_METRO', NULL, 400, NULL, 75, 150, 3.00, 6, 15, '$6 weeks free if move in by 01/23', 'Move-in-by date year not provided.', 'https://www.pikewest.com/', NULL, NULL, NULL),
('westerly-apartments', 'Westerly Apartments', 'DFW_METRO', NULL, 400, NULL, 75, 150, 3.00, 6, 15, NULL, NULL, 'https://www.equityapartments.com/dallas/west-dallas/westerly-apartments', NULL, NULL, NULL),
('avant-of-market-center', 'Avant of Market Center', 'DFW_METRO', NULL, 150, NULL, 75, 150, 2.50, 6, 14, '1 mo free (12-14 mo) + waived app/admin upon approval; $1000 gift card if you lease by 2026-01-20', NULL, 'https://www.avantmarketcenter.com/availableunits', NULL, NULL, NULL),
('vue-live-oak', 'Vue Live Oak', 'DFW_METRO', NULL, 150, NULL, 85, 200, 3.00, 4, 16, NULL, 'Notes: "Avail Today"; "25 min from University via 105 bus, 10 min driving".', NULL, NULL, NULL, NULL),
('gramercy-on-the-park', 'Gramercy On The Park', 'DFW_METRO', NULL, 99, NULL, 85, 175, 3.00, 6, 15, '4-10 wks free w/12+ mo', NULL, 'https://www.gramercyonthepark.com/floorplans', NULL, NULL, NULL),
('arrive-at-west-end', 'Arrive at West End', 'DFW_METRO', NULL, 150, NULL, 50, 150, 3.00, 2, 18, '1 month free w/12+ mo', NULL, 'https://arrivewestend.com/', NULL, NULL, NULL)
ON CONFLICT (slug) DO NOTHING;

-- ---------- UNITS ----------
-- Helper: insert units by looking up apartment_id via slug

-- Country Club Apartments
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, NULL, '4106', 2, 2.0, 1048, 1048, NULL, NULL, DATE '2025-09-27', 13, 'Additional covered parking $25/mo.'
FROM apartments WHERE slug = 'country-club-apartments';

-- Maverick Oak Lawn
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, NULL, '4106', 2, 2.0, 1048, 1048, NULL, NULL, DATE '2025-09-27', 13, 'Additional covered parking $25/mo.'
FROM apartments WHERE slug = 'maverick-oak-lawn';

-- Falltree
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, 'Studio', NULL, 0, 1.0, 500, 500, 1030, 1030, NULL, NULL, 'Available now'
FROM apartments WHERE slug = 'falltree';

INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, '1 Bed', NULL, 1, 1.0, 566, 566, 1070, 1070, DATE '2025-08-15', NULL, NULL
FROM apartments WHERE slug = 'falltree';

INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, '1 Bed', NULL, 1, 1.0, 713, 713, 1140, 1140, DATE '2025-08-29', NULL, NULL
FROM apartments WHERE slug = 'falltree';

-- Sunset Shadows
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, 'C-2-D', NULL, 3, 2.0, 1272, 1272, 1358, 1358, NULL, 12, 'Available now; Washer & Dryer connections'
FROM apartments WHERE slug = 'sunset-shadows';

-- Castlewood
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, 'H', NULL, 3, 2.0, 1375, 1375, NULL, NULL, NULL, 12, 'Available now; On-site laundry'
FROM apartments WHERE slug = 'castlewood';

-- Estates at Spring Branch
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, NULL, NULL, 3, 2.0, 1344, 1344, 1165, 1165, NULL, 12, 'Available now; On-site laundry'
FROM apartments WHERE slug = 'estates-at-spring-branch';

-- Green Arbor
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, NULL, NULL, 3, 2.0, 1041, 1041, 1329, 1329, NULL, 12, 'Available now; Washer & Dryer connections'
FROM apartments WHERE slug = 'green-arbor';

-- Campbell Grove
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, NULL, '12', 3, 2.0, 1300, 1300, 1299, 1299, NULL, 13, 'Available now; Washer & Dryer connections'
FROM apartments WHERE slug = 'campbell-grove';

-- Bella Vida
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, NULL, NULL, 1, 1.0, 683, 683, 749, 749, NULL, 12, 'Available now'
FROM apartments WHERE slug = 'bella-vida';

-- Heritage At Hooper Hall
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, NULL, NULL, 1, 1.0, 683, 683, 890, 890, NULL, 12, 'Available now'
FROM apartments WHERE slug = 'heritage-at-hooper-hall';

-- Driscoll Place
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, 'Merlot', NULL, 1, 1.0, 643, 643, 780, 780, NULL, 12, 'Available now'
FROM apartments WHERE slug = 'driscoll-place';

-- Summit At Champions
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, NULL, NULL, 1, 1.0, 656, 656, 849, 849, NULL, 12, 'Available now'
FROM apartments WHERE slug = 'summit-at-champions';

-- The Pines At Woodcreek
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, NULL, NULL, 1, 1.0, 683, 683, 890, 890, NULL, 12, 'Available now'
FROM apartments WHERE slug = 'the-pines-at-woodcreek';

-- The Veranda at Centerpoint
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, NULL, '1621', 1, 1.0, 688, 688, 890, 890, NULL, 15, 'Available now'
FROM apartments WHERE slug = 'the-veranda-at-centerpoint';

-- The Abby At Conroe
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, NULL, NULL, 1, 1.0, 643, 643, 819, 835, NULL, 12, 'Available now'
FROM apartments WHERE slug = 'the-abby-at-conroe';

-- Cypress Lake
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, 'A3', NULL, 3, 2.0, 1184, 1184, 1544, 1544, NULL, 12, 'Available now'
FROM apartments WHERE slug = 'cypress-lake';

-- Landmark at Grand Champion
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, NULL, NULL, 2, 2.0, 1312, 1312, 1699, 1699, NULL, 12, 'Available now'
FROM apartments WHERE slug = 'landmark-at-grand-champion';

-- Edgewater at Klein-East
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, NULL, NULL, 3, 2.0, 1139, 1139, 1564, 1564, NULL, 12, 'Available now'
FROM apartments WHERE slug = 'edgewater-at-klein-east';

-- The Preston
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, NULL, NULL, 3, 2.0, 1330, 1330, 1715, 1715, NULL, 12, 'Available now'
FROM apartments WHERE slug = 'the-preston';

-- The Abby at Briargrove (two floorplans)
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, 'C-1', NULL, 3, 2.0, 1069, 1069, 1165, 1165, NULL, NULL, 'Available now; Washer & Dryer connections'
FROM apartments WHERE slug = 'the-abby-at-briargrove';

INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, 'C-2', NULL, 3, 2.0, 1227, 1227, 1299, 1299, NULL, NULL, 'Available now; Washer & Dryer connections'
FROM apartments WHERE slug = 'the-abby-at-briargrove';

-- Montabella at Oak Forest
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, 'F', NULL, 3, 2.0, 1263, 1263, 1595, 1595, NULL, NULL, 'Available now; Washer & Dryer connections'
FROM apartments WHERE slug = 'montabella-at-oak-forest';

-- Estates at Westchase
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, 'F1', NULL, 3, 2.0, 1152, 1152, 1415, 1415, NULL, NULL, 'Available now; Washer & Dryer connections'
FROM apartments WHERE slug = 'estates-at-westchase';

-- Lakeview
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, 'Fir', NULL, 3, 2.0, 1563, 1563, 1695, 1695, NULL, NULL, 'Available now; Washer & Dryer in-unit'
FROM apartments WHERE slug = 'lakeview';

-- The Abby at Memorial
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, 'C-2', NULL, 3, 2.0, 1227, 1227, 1299, 1299, NULL, NULL, 'Available now; Washer & Dryer connections'
FROM apartments WHERE slug = 'the-abby-at-memorial';

-- Sedona Square
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, 'C1', NULL, 3, 2.0, 1200, 1200, 1469, 1469, NULL, NULL, 'Available now; Washer & Dryer connections'
FROM apartments WHERE slug = 'sedona-square';

-- Serena Woods
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, '0335-C1', NULL, 3, 2.0, 12058, 12058, 1619, 1619, DATE '2026-02-28', NULL, 'Sqft may be a typo in source text; stored as 12058.'
FROM apartments WHERE slug = 'serena-woods';

-- ---- DFW Units ----

-- Abstract at District Design
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, 'A3', NULL, 1, 1.0, 728, 728, 1400, 1400, NULL, 15, 'Available now'
FROM apartments WHERE slug = 'abstract-at-district-design';

-- Skyline Trinity
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, 'A3', NULL, 1, 1.0, 727, 727, 1135, 1135, NULL, 12, 'Available now'
FROM apartments WHERE slug = 'skyline-trinity';

-- Southside Flats
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, 'A3', '1148', 1, 1.0, 826, 826, 1280, 1280, NULL, 12, 'Available now'
FROM apartments WHERE slug = 'southside-flats';

-- Pike West Commerce
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, '1A1 or 1B1', NULL, 1, 1.0, 744, 789, 1272, 1305, NULL, 12, 'Available now'
FROM apartments WHERE slug = 'pike-west-commerce';

-- Westerly Apartments
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, NULL, NULL, 1, 1.0, 750, 750, 1370, 1370, NULL, 12, 'Available now'
FROM apartments WHERE slug = 'westerly-apartments';

-- Avant of Market Center (two units)
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, 'A1', NULL, 1, 1.0, 648, 648, 1196, 1196, NULL, 14, 'Available now'
FROM apartments WHERE slug = 'avant-of-market-center';

INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, 'A3', '2212', 1, 1.0, 685, 685, 1308, 1308, DATE '2026-01-24', 14, 'Available Jan 24 (assumed 2026 based on nearby 2026 promo date)'
FROM apartments WHERE slug = 'avant-of-market-center';

-- Vue Live Oak
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, NULL, '1205', 1, 1.0, 716, 716, 1178, 1178, NULL, NULL, 'Avail Today (date not provided)'
FROM apartments WHERE slug = 'vue-live-oak';

-- Gramercy On The Park
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, 'A3', '2-106', 1, 1.0, 784, 784, 1330, 1330, DATE '2025-08-16', NULL, NULL
FROM apartments WHERE slug = 'gramercy-on-the-park';

-- Arrive at West End
INSERT INTO units
(apartment_id, floorplan, unit_number, bedrooms, bathrooms, sqft_min, sqft_max, rent_min, rent_max, available_date, lease_months, notes)
SELECT id, 'Tyler', NULL, 1, 1.0, 834, 834, 1400, 1400, NULL, NULL, 'Rent "From $1,400"'
FROM apartments WHERE slug = 'arrive-at-west-end';

COMMIT;
