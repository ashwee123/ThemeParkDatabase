USE newthemepark;

START TRANSACTION;

-- Ensure visitor park exists
INSERT INTO visitor_park (ParkName, LocationText, OpeningTime, ClosingTime, MapImageUrl, IsActive)
SELECT 'Nightmare Nexus Main Park', 'Downtown Theme District', '09:00:00', '22:00:00', '/assets/map-main-park.svg', 1
WHERE NOT EXISTS (SELECT 1 FROM visitor_park WHERE ParkName = 'Nightmare Nexus Main Park');

-- Area definitions from visitor portal content plan
INSERT INTO area (AreaID, AreaName) VALUES
  (0, 'Entrance'),
  (1, 'Uncanny Valley'),
  (2, 'Bloodmoon Village'),
  (3, 'Space Station X'),
  (4, 'Camp Blackwood'),
  (5, 'Dead End District'),
  (6, 'Isolation Ward')
AS new
ON DUPLICATE KEY UPDATE
  AreaName = new.AreaName;

SET @ParkID = (SELECT ParkID FROM visitor_park WHERE ParkName = 'Nightmare Nexus Main Park' LIMIT 1);

-- Attractions (ID range 1000+ reserved for visitor portal content)
INSERT INTO attraction (AttractionID, AttractionName, AttractionType, AreaID, Status, QueueCount, SeverityLevel) VALUES
  (1000, 'Broadcast Hijack', 'Show', 1, 'Open', 20, 'None'),
  (1001, 'Escape the Backrooms', 'Ride', 1, 'Open', 45, 'None'),
  (1002, 'Alternate Invasion', 'Ride', 1, 'Open', 35, 'None'),
  (1003, 'Looping Day', 'Show', 1, 'Open', 25, 'Low'),
  (1004, 'Smile Protocol', 'Show', 1, 'Open', 30, 'Low'),

  (1100, 'Harvest Festival', 'Show', 2, 'Open', 25, 'None'),
  (1101, 'Pastor John''s Sermon', 'Show', 2, 'Open', 30, 'None'),
  (1102, 'The Offering', 'Ride', 2, 'Open', 40, 'Low'),
  (1103, 'Forest of Whispers', 'Ride', 2, 'Open', 38, 'Low'),

  (1200, 'AI Override', 'Ride', 3, 'Open', 42, 'Low'),
  (1201, 'The Last Transmission', 'Show', 3, 'Open', 22, 'None'),
  (1202, 'Containment Breach', 'Ride', 3, 'Open', 50, 'Low'),
  (1203, 'Zero-Gravity Situation', 'Ride', 3, 'Open', 48, 'Low'),

  (1300, 'Watchtower Drop', 'Ride', 4, 'Open', 46, 'Low'),
  (1301, 'Cryptid Hunt', 'Ride', 4, 'Open', 44, 'Low'),
  (1302, 'Trail Tour', 'Ride', 4, 'Open', 28, 'None'),
  (1303, 'Lake Terror', 'Ride', 4, 'Open', 36, 'Low'),
  (1304, 'Camper Safety Orientation', 'Show', 4, 'Open', 16, 'None'),

  (1400, 'Psych Ward Tour', 'Ride', 5, 'Open', 39, 'Low'),
  (1401, 'Midnight Stalker', 'Ride', 5, 'Open', 41, 'Low'),
  (1402, 'Final Girl: The Chase', 'Ride', 5, 'Open', 43, 'Low'),
  (1403, 'Execution Alley', 'Show', 5, 'Open', 27, 'None'),
  (1404, 'Body Count', 'Show', 5, 'Open', 24, 'None'),

  (1500, 'Outbreak: Day Zero', 'Ride', 6, 'Open', 52, 'Low'),
  (1501, 'Evacuation Protocol', 'Ride', 6, 'Open', 47, 'Low'),
  (1502, 'Emergency Broadcast Live', 'Show', 6, 'Open', 19, 'None'),
  (1503, 'Containment Collapse', 'Ride', 6, 'Open', 49, 'Low'),
  (1504, 'Last Stand Barricade', 'Ride', 6, 'Open', 45, 'Low')
AS new
ON DUPLICATE KEY UPDATE
  AttractionName = new.AttractionName,
  AttractionType = new.AttractionType,
  AreaID = new.AreaID,
  Status = new.Status,
  QueueCount = new.QueueCount,
  SeverityLevel = new.SeverityLevel;

-- Attraction details for visitor portal
INSERT INTO visitor_attraction_detail
  (AttractionID, ParkID, Description, HeightRequirementCm, DurationMinutes, ThrillLevel, LocationHint)
VALUES
  (1000, @ParkID, 'A hacked signal takes over every screen in the district.', 0, 12, 'Medium', 'Uncanny Valley Main Plaza'),
  (1001, @ParkID, 'Navigate endless liminal corridors and find the exit.', 120, 9, 'High', 'Uncanny Valley East Wing'),
  (1002, @ParkID, 'Reality fractures as alternate selves invade the city.', 115, 8, 'High', 'Uncanny Valley Transit Tunnel'),
  (1003, @ParkID, 'A day that keeps repeating with increasingly eerie changes.', 0, 10, 'Medium', 'Uncanny Valley Theater'),
  (1004, @ParkID, 'A smiling protocol keeps escalating beyond control.', 0, 11, 'Medium', 'Uncanny Valley Broadcast Hall'),

  (1100, @ParkID, 'A cheerful festival with rituals hidden in plain sight.', 0, 14, 'Medium', 'Bloodmoon Village Square'),
  (1101, @ParkID, 'An unsettling sermon where the audience becomes involved.', 0, 13, 'Medium', 'Bloodmoon Chapel'),
  (1102, @ParkID, 'Witness a midnight offering deep in the ceremonial grounds.', 120, 8, 'High', 'Bloodmoon Inner Circle'),
  (1103, @ParkID, 'A torch-lit trek where whispers follow every step.', 110, 10, 'High', 'Bloodmoon Forest Path'),

  (1200, @ParkID, 'A rogue AI takes command of life support systems.', 120, 8, 'High', 'Space Station Core'),
  (1201, @ParkID, 'The final distress call from a doomed mission.', 0, 12, 'Medium', 'Comms Deck'),
  (1202, @ParkID, 'Containment fails and the creature escapes.', 125, 9, 'Extreme', 'Bio-Lab Sector'),
  (1203, @ParkID, 'Simulated zero gravity with catastrophic malfunctions.', 120, 7, 'High', 'Orbital Ring'),

  (1300, @ParkID, 'A vertical drop from the ranger watchtower.', 130, 2, 'Extreme', 'Camp Ridge'),
  (1301, @ParkID, 'A nighttime hunt for creatures in dense forest.', 120, 9, 'High', 'Blackwood Trailhead'),
  (1302, @ParkID, 'A scenic tour that turns into a survival route.', 100, 11, 'Medium', 'North Trail Loop'),
  (1303, @ParkID, 'A peaceful lake ride interrupted by unknown movement.', 110, 8, 'High', 'Blackwood Lakefront'),
  (1304, @ParkID, 'Camp orientation with emergency drills gone wrong.', 0, 10, 'Low', 'Camp Assembly Hall'),

  (1400, @ParkID, 'A guided walk through a ward with no clear exit.', 115, 8, 'High', 'Dead End Clinic'),
  (1401, @ParkID, 'Stay hidden while a killer roams the block.', 120, 9, 'High', 'Midnight Avenue'),
  (1402, @ParkID, 'A chase sequence where you must keep moving.', 120, 7, 'Extreme', 'Final Street'),
  (1403, @ParkID, 'A live action alley performance with dangerous twists.', 0, 11, 'Medium', 'Execution Alley Stage'),
  (1404, @ParkID, 'A rapidly escalating slasher count-down experience.', 0, 10, 'Medium', 'District Courtyard'),

  (1500, @ParkID, 'Patient zero escapes and the ward falls.', 120, 8, 'High', 'Isolation Block A'),
  (1501, @ParkID, 'Attempt evacuation while systems collapse.', 120, 9, 'High', 'Emergency Corridor'),
  (1502, @ParkID, 'Live updates from a crumbling command center.', 0, 10, 'Medium', 'Broadcast Room'),
  (1503, @ParkID, 'Containment barriers fail one by one.', 125, 8, 'Extreme', 'Biohazard Gate'),
  (1504, @ParkID, 'Defend the final barricade against waves of infected.', 120, 9, 'High', 'Ward Perimeter')
AS new
ON DUPLICATE KEY UPDATE
  ParkID = new.ParkID,
  Description = new.Description,
  HeightRequirementCm = new.HeightRequirementCm,
  DurationMinutes = new.DurationMinutes,
  ThrillLevel = new.ThrillLevel,
  LocationHint = new.LocationHint;

-- Dining options
INSERT INTO visitor_dining_option (AreaID, ParkID, DiningName, CuisineType, MenuSummary, IsActive) VALUES
  (1, @ParkID, 'Artificial Appetite Cafe', 'Fusion', 'Synthetic shakes, glitch fries, and uncanny pastries.', 1),
  (1, @ParkID, 'Perfect Family Diner', 'Classic Diner', 'Meatloaf specials, TV tray platters, and pie.', 1),
  (1, @ParkID, 'The TV Dinner Lounge', 'Comfort Food', 'Microwave nostalgia meals and neon desserts.', 1),

  (2, @ParkID, 'Great Feast Hall', 'Banquet', 'Family platters, roasted meats, and harvest sides.', 1),
  (2, @ParkID, 'Crimson Tavern', 'Pub Grill', 'Red stew, smoked skewers, and berry tonics.', 1),
  (2, @ParkID, 'Witch''s Brew Stand', 'Beverages', 'Herbal teas, spiced ciders, and potion sodas.', 1),

  (3, @ParkID, 'Orbit Mess Hall', 'Space Rations', 'Protein packs, noodles, and station bowls.', 1),
  (3, @ParkID, 'The Airlock Lounge', 'Tapas', 'Small plates and cosmic mocktails.', 1),
  (3, @ParkID, 'Cryo Cafe', 'Coffee & Desserts', 'Cold brew, frozen bites, and ice cream pods.', 1),

  (4, @ParkID, 'Dockside Grill', 'BBQ', 'Lake fish, grilled corn, and campfire burgers.', 1),
  (4, @ParkID, 'Smores Stand', 'Snacks', 'Smore kits, cocoa, and toasted marshmallows.', 1),
  (4, @ParkID, 'Blackwood Lunch Hall', 'Family Meals', 'Hearty trays, soups, and ranger lunch boxes.', 1),

  (5, @ParkID, 'Freddy Fazbears Pizzaria', 'Pizza', 'Stone-baked slices, wings, and arcade drinks.', 1),
  (5, @ParkID, 'Billy''s Butcher Shop', 'Smokehouse', 'Carved meats, sandwiches, and fries.', 1),
  (5, @ParkID, 'Midnight Snack Shack', 'Fast Bites', 'Late-night snacks and loaded nachos.', 1),

  (6, @ParkID, 'Ration Station', 'Survival Meals', 'Ration bowls, protein bars, and hydration packs.', 1),
  (6, @ParkID, 'Contamination Cafe', 'Experimental', 'Irradiated-themed pastries and hot meals.', 1),
  (6, @ParkID, 'Field Medic Kitchen', 'Healthy Meals', 'Broths, wraps, and recovery drinks.', 1)
AS new
ON DUPLICATE KEY UPDATE
  AreaID = new.AreaID,
  ParkID = new.ParkID,
  CuisineType = new.CuisineType,
  MenuSummary = new.MenuSummary,
  IsActive = new.IsActive;

-- Shops into retailplace (plus entrance shops)
INSERT INTO retailplace (RetailName, AreaID) VALUES
  ('Online tickets', 0),
  ('Ticket kiosk', 0),
  ('Park Essentials Outfitters', 0),
  ('Photo Processing Center', 0),

  ('Replica Doll Works', 1),
  ('Memory Lane Antiques', 1),
  ('Familiar Faces Portrait Studio', 1),

  ('Ritual Relics and Charms', 2),
  ('Cursed Crafts Market', 2),
  ('The Apothecary', 2),

  ('Supply Depot', 3),
  ('Tech Exchange', 3),
  ('Black Box Recovery', 3),

  ('Joe''s Trading Post', 4),
  ('Camp Essentials', 4),
  ('Campfire Crafts', 4),

  ('Blackout Records & Apparel', 5),
  ('Evidence Lockup', 5),
  ('Back Alley Goods', 5),

  ('Apocalypse Outfitters', 6),
  ('Black Market Meds', 6),
  ('Biohazard Supply Co.', 6)
AS new
ON DUPLICATE KEY UPDATE
  AreaID = new.AreaID;

-- Add one merchandise item for each shop if missing (used by visitor portal merchandise UI)
INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Gate Pass Lanyard', 4.00, 12.00, 9.00, 120, 20, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Online tickets'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Gate Pass Lanyard' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Express Wristband Sleeve', 5.00, 14.00, 11.00, 100, 20, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Ticket kiosk'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Express Wristband Sleeve' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Rain Poncho', 3.00, 10.00, 8.00, 140, 25, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Park Essentials Outfitters'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Rain Poncho' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Ride Photo Frame', 6.00, 18.00, 14.00, 85, 15, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Photo Processing Center'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Ride Photo Frame' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Replica Doll', 12.00, 32.00, 27.00, 60, 10, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Replica Doll Works'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Replica Doll' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Vintage Room Key', 4.00, 15.00, 12.00, 90, 15, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Memory Lane Antiques'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Vintage Room Key' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Portrait Print', 5.00, 20.00, 16.00, 70, 10, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Familiar Faces Portrait Studio'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Portrait Print' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Ritual Charm Bracelet', 7.00, 22.00, 18.00, 95, 12, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Ritual Relics and Charms'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Ritual Charm Bracelet' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Handmade Totem', 8.00, 24.00, 20.00, 80, 12, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Cursed Crafts Market'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Handmade Totem' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Moonroot Elixir', 6.00, 19.00, 15.00, 85, 10, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'The Apothecary'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Moonroot Elixir' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Emergency Space Ration', 5.00, 16.00, 13.00, 100, 15, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Supply Depot'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Emergency Space Ration' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Holo Circuit Patch', 7.00, 21.00, 17.00, 75, 12, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Tech Exchange'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Holo Circuit Patch' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Recovered Flight Recorder Replica', 10.00, 29.00, 24.00, 55, 10, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Black Box Recovery'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Recovered Flight Recorder Replica' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Trail Compass', 4.00, 13.00, 10.00, 110, 15, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Joe''s Trading Post'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Trail Compass' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Waterproof Daypack', 9.00, 28.00, 23.00, 70, 12, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Camp Essentials'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Waterproof Daypack' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Campfire Carving Kit', 5.00, 17.00, 13.00, 90, 12, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Campfire Crafts'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Campfire Carving Kit' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Midnight Tour Tee', 6.00, 20.00, 16.00, 100, 15, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Blackout Records & Apparel'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Midnight Tour Tee' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Evidence Marker Set', 4.00, 14.00, 11.00, 95, 15, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Evidence Lockup'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Evidence Marker Set' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Alley Pass Keychain', 3.00, 11.00, 8.00, 120, 20, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Back Alley Goods'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Alley Pass Keychain' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Survival Utility Vest', 11.00, 33.00, 28.00, 65, 10, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Apocalypse Outfitters'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Survival Utility Vest' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Emergency Med Pack', 8.00, 26.00, 21.00, 70, 10, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Black Market Meds'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Emergency Med Pack' AND ri.RetailID = rp.RetailID);

INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
SELECT 'Biohazard Mask', 7.00, 22.00, 18.00, 85, 12, 1, rp.RetailID
FROM retailplace rp
WHERE rp.RetailName = 'Biohazard Supply Co.'
  AND NOT EXISTS (SELECT 1 FROM retailitem ri WHERE ri.ItemName = 'Biohazard Mask' AND ri.RetailID = rp.RetailID);

COMMIT;
