-- ============================================================
-- Foster & Keys — Add URLs to existing apartments
-- Run in Supabase SQL Editor AFTER migrate-add-url-acceptance.sql
-- ============================================================

-- Houston Metro
UPDATE apartments SET url = 'https://www.countryclubmesquite.com/floor-plans' WHERE slug = 'country-club-apartments';
UPDATE apartments SET url = 'https://www.sunsetshadows-apartments.com/check-availability-apply/' WHERE slug = 'sunset-shadows';
UPDATE apartments SET url = 'https://www.castlewood-apartments.com/floor-plans/' WHERE slug = 'castlewood';
UPDATE apartments SET url = 'https://www.estates-springbranch.com/floor-plans/' WHERE slug = 'estates-at-spring-branch';
UPDATE apartments SET url = 'https://www.greenarborapts.com/Floor-plans.aspx' WHERE slug = 'green-arbor';
UPDATE apartments SET url = 'https://www.campbellgrove.com/floorplans/' WHERE slug = 'campbell-grove';
UPDATE apartments SET url = 'https://www.bellavidaliving.com/floorplans/' WHERE slug = 'bella-vida';
UPDATE apartments SET url = 'https://hooperhill.com/floorplans/' WHERE slug = 'heritage-at-hooper-hall';
UPDATE apartments SET url = 'https://www.driscollplaceapts.com/floor-plans' WHERE slug = 'driscoll-place';
UPDATE apartments SET url = 'https://www.summitatchampions.com/floorplans' WHERE slug = 'summit-at-champions';
UPDATE apartments SET url = 'https://www.thepinesatwoodcreek.com/' WHERE slug = 'the-pines-at-woodcreek';
UPDATE apartments SET url = 'https://verandaatcenterfield.com/floorplans/' WHERE slug = 'the-veranda-at-centerpoint';
UPDATE apartments SET url = 'https://www.abbeyresidential.com/apartments/tx/conroe/interstate-45-north/floor-plans' WHERE slug = 'the-abby-at-conroe';
UPDATE apartments SET url = 'https://www.cypresslakeapartments.com/floorplans/' WHERE slug = 'cypress-lake';
UPDATE apartments SET url = 'https://www.landmarkgrandchampionapts.com/floorplans/' WHERE slug = 'landmark-at-grand-champion';
UPDATE apartments SET url = 'https://www.edgewateratklein.com/apartments/tx/spring/floor-plans' WHERE slug = 'edgewater-at-klein-east';
UPDATE apartments SET url = 'https://www.liveatthepreston.com/apartments/tx/spring/floor-plans' WHERE slug = 'the-preston';
UPDATE apartments SET url = 'https://www.abbeyresidential.com/apartments/tx/houston/briar-forest/floor-plans' WHERE slug = 'the-abby-at-briargrove';
UPDATE apartments SET url = 'https://www.montabellaapartments.com/floorplans/' WHERE slug = 'montabella-at-oak-forest';
UPDATE apartments SET url = 'https://www.theestatesatwestchase.com/floorplans/' WHERE slug = 'estates-at-westchase';
UPDATE apartments SET url = 'https://www.thelakeviewapartments.com/floorplans/' WHERE slug = 'lakeview';
UPDATE apartments SET url = 'https://www.abbeyresidential.com/apartments/tx/houston/memorial/' WHERE slug = 'the-abby-at-memorial';
UPDATE apartments SET url = 'https://www.sedonasquare.com/floorplans' WHERE slug = 'sedona-square';
UPDATE apartments SET url = 'https://www.villaserenacommunities.com/serena-woods/gallery' WHERE slug = 'serena-woods';

-- DFW Metro
UPDATE apartments SET url = 'https://www.abstractdesigndistrict.com/' WHERE slug = 'abstract-at-district-design';
UPDATE apartments SET url = 'https://www.skylinetrinity.com/' WHERE slug = 'skyline-trinity';
UPDATE apartments SET url = 'https://www.southsideflatsapts.com/floorplans' WHERE slug = 'southside-flats';
UPDATE apartments SET url = 'https://www.pikewest.com/' WHERE slug = 'pike-west-commerce';
UPDATE apartments SET url = 'https://www.equityapartments.com/dallas/west-dallas/westerly-apartments' WHERE slug = 'westerly-apartments';
UPDATE apartments SET url = 'https://www.avantmarketcenter.com/availableunits' WHERE slug = 'avant-of-market-center';
UPDATE apartments SET url = 'https://www.gramercyonthepark.com/floorplans' WHERE slug = 'gramercy-on-the-park';
UPDATE apartments SET url = 'https://arrivewestend.com/' WHERE slug = 'arrive-at-west-end';

-- Verify
SELECT slug, name, url FROM apartments ORDER BY metro_area, name;
