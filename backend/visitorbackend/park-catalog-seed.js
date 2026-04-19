/**
 * Seeds theme-park areas, retail shops/items, and visitor_dining_option venues + MenuItemsJSON
 * so the visitor portal and retail transaction views align with the park map.
 * Safe to run repeatedly (idempotent inserts).
 */

const AREAS = [
  [200, "Entrance"],
  [201, "Uncanny Valley"],
  [202, "Bloodmoon Village"],
  [203, "Space Station X"],
  [204, "Camp Blackwood"],
  [205, "Dead End District"],
  [206, "Isolation Ward"],
];

/** { areaId, shopName, items: [ [itemName, buyPrice, sellPrice], ... ] } */
const RETAIL_SHOPS = [
  { areaId: 200, shop: "Online tickets", items: [["Digital admission add-on", 2.0, 12.99]] },
  { areaId: 200, shop: "Ticket kiosk", items: [["Printed map & lanyard bundle", 2.0, 8.99]] },
  { areaId: 200, shop: "Park Essentials Outfitters", items: [["Compact rain poncho", 2.0, 14.99]] },
  { areaId: 200, shop: "Photo Processing Center", items: [["Digital ride photo package", 2.0, 19.99]] },
  { areaId: 201, shop: "Replica Doll Works", items: [["Porcelain keepsake doll", 5.0, 34.99]] },
  { areaId: 201, shop: "Memory Lane Antiques", items: [["Curio box — small", 4.0, 24.99]] },
  { areaId: 201, shop: "Familiar Faces Portrait Studio", items: [["Portrait session voucher", 3.0, 29.99]] },
  { areaId: 202, shop: "Ritual Relics and Charms", items: [["Blessed charm bracelet", 3.0, 18.99]] },
  { areaId: 202, shop: "Cursed Crafts Market", items: [["Hand-carved talisman", 4.0, 22.99]] },
  { areaId: 202, shop: "The Apothecary", items: [["Herbal tincture sampler", 3.5, 16.49]] },
  { areaId: 203, shop: "Supply Depot", items: [["Mission patch set", 2.5, 12.49]] },
  { areaId: 203, shop: "Tech Exchange", items: [["USB survival multitool", 3.0, 17.99]] },
  { areaId: 203, shop: "Black Box Recovery", items: [["Classified dossier notebook", 2.0, 11.99]] },
  { areaId: 204, shop: "Joe's Trading Post", items: [["Trail mix barrel", 2.0, 9.99]] },
  { areaId: 204, shop: "Camp Essentials", items: [["LED headlamp", 3.0, 15.99]] },
  { areaId: 204, shop: "Campfire Crafts", items: [["Friendship bracelet kit", 1.5, 7.99]] },
  { areaId: 205, shop: "Blackout Records & Apparel", items: [["Vintage horror vinyl", 6.0, 28.99]] },
  { areaId: 205, shop: "Evidence Lockup", items: [["Case file prop replica", 4.0, 21.99]] },
  { areaId: 205, shop: "Back Alley Goods", items: [["Mystery grab bag", 2.5, 13.49]] },
  { areaId: 206, shop: "Apocalypse Outfitters", items: [["Hazmat hoodie", 8.0, 44.99]] },
  { areaId: 206, shop: "Black Market Meds", items: [["First-aid novelty tin", 2.0, 10.99]] },
  { areaId: 206, shop: "Biohazard Supply Co.", items: [["Respirator-style mask (costume)", 3.0, 16.99]] },
];

/** { areaId, name, cuisine?, menu: [ [dishName, price], ... ] } */
const DINING_VENUES = [
  {
    areaId: 201,
    name: "Artificial Appetite Cafe",
    cuisine: "Contemporary",
    menu: [
      ["Symmetry Burger", 13.99],
      ["Repeated Ravioli Plate", 12.49],
      ["Synthetic Steak Cut", 18.99],
    ],
  },
  {
    areaId: 201,
    name: "Perfect Family Diner",
    cuisine: "Family comfort",
    menu: [
      ["Rotating Chef's Plate", 16.99],
      ["Family Feast Basket", 22.99],
      ["Slice of 'Normal' Pie", 6.49],
    ],
  },
  {
    areaId: 201,
    name: "The TV Dinner Lounge",
    cuisine: "Retro lounge",
    menu: [
      ["Fried Chicken TV Dinner", 11.49],
      ["Mac & Cheese Combo Tray", 10.49],
    ],
  },
  {
    areaId: 202,
    name: "Great Feast Hall",
    cuisine: "Banquet",
    menu: [
      ["Roasted Beast Feast", 19.99],
      ["Feast of the Chosen (Sampler)", 18.49],
      ["Sacrificial Lamb Plate", 16.99],
    ],
  },
  { areaId: 202, name: "Crimson Tavern", cuisine: "Pub", menu: [["Dark Harvest Plate", 13.99]] },
  {
    areaId: 202,
    name: "Witch's Brew Stand",
    cuisine: "Beverages",
    menu: [
      ["Mystery Brew", 4.99],
      ["Potion Flight (Sampler)", 6.99],
    ],
  },
  {
    areaId: 203,
    name: "Orbit Mess Hall",
    cuisine: "Galactic fare",
    menu: [
      ["Space Station Burger", 13.49],
      ["Zero-G Taco Plate", 12.49],
      ["Galaxy Sampler Tray", 13.99],
    ],
  },
  {
    areaId: 203,
    name: "The Airlock Lounge",
    cuisine: "Lounge",
    menu: [
      ["Black Hole Cocktail", 8.99],
      ["Airlock Sliders", 6.99],
    ],
  },
  { areaId: 203, name: "Cryo Cafe", cuisine: "Dessert", menu: [["Cryo Ice Cream Sphere", 5.49]] },
  {
    areaId: 204,
    name: "Dockside Grill",
    cuisine: "Grill",
    menu: [
      ["Grilled Fish Basket", 13.49],
      ["Dockside BBQ Plate", 14.99],
    ],
  },
  {
    areaId: 204,
    name: "Smores Stand",
    cuisine: "Treats",
    menu: [
      ["Classic Chocolate S'more", 4.49],
      ["S'mores Party Platter", 9.99],
    ],
  },
  {
    areaId: 204,
    name: "Blackwood Lunch Hall",
    cuisine: "Cafeteria",
    menu: [
      ["Camp Hot Lunch Tray", 11.99],
      ["Trail Mix Bar Cup", 5.49],
    ],
  },
  {
    areaId: 205,
    name: "Freddy Fazbears Pizzaria",
    cuisine: "Pizza",
    menu: [
      ["Classic Cheese Pizza", 10.49],
      ["Pepperoni Pizza", 11.49],
      ["Fazbear Special Pizza", 13.99],
    ],
  },
  {
    areaId: 205,
    name: "Billy's Butcher Shop",
    cuisine: "Smokehouse",
    menu: [
      ["Meat Lover's Platter", 16.99],
      ["Red Sauce Special Drink", 4.29],
    ],
  },
  {
    areaId: 205,
    name: "Midnight Snack Shack",
    cuisine: "Late night",
    menu: [
      ["After Hours Deal", 6.99],
      ["Last Call Special", 9.49],
    ],
  },
  {
    areaId: 206,
    name: "Ration Station",
    cuisine: "Rations",
    menu: [
      ["Canned Chili", 5.49],
      ["Protein Ration Pack", 6.49],
    ],
  },
  {
    areaId: 206,
    name: "Contamination Cafe",
    cuisine: "Cafe",
    menu: [
      ["Pickled Veggie Cup", 2.99],
      ["Mutant Mac & Cheese", 6.99],
      ["Pandemic Pizza Slice", 5.49],
      ["Quarantine Quesadilla", 7.49],
      ["Radioactive Lemonade", 3.99],
    ],
  },
  {
    areaId: 206,
    name: "Field Medic Kitchen",
    cuisine: "Comfort",
    menu: [
      ["Medic Chicken Soup", 6.49],
      ["Restorative Combo", 8.99],
    ],
  },
];

async function ensureMenuItemsJsonColumn(pool) {
  try {
    await pool.execute(`ALTER TABLE visitor_dining_option ADD COLUMN MenuItemsJSON TEXT NULL`);
  } catch (e) {
    const m = String(e && e.message);
    if (!m.includes("Duplicate column") && !m.includes("check that column/key exists")) throw e;
  }
}

async function seedParkCatalog(pool) {
  await ensureMenuItemsJsonColumn(pool);

  for (const [id, name] of AREAS) {
    await pool.execute(
      `INSERT INTO area (AreaID, AreaName) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE AreaName = VALUES(AreaName)`,
      [id, name]
    );
  }

  const [parks] = await pool.execute(`SELECT MIN(ParkID) AS pid FROM visitor_park WHERE IsActive = 1`);
  const parkId = parks[0] && parks[0].pid != null ? parks[0].pid : null;

  for (const row of RETAIL_SHOPS) {
    await pool.execute(
      `INSERT INTO retailplace (RetailName, AreaID)
       SELECT ?, ? FROM DUAL
       WHERE NOT EXISTS (SELECT 1 FROM retailplace WHERE RetailName = ?)`,
      [row.shop, row.areaId, row.shop]
    );
    const [rp] = await pool.execute(`SELECT RetailID FROM retailplace WHERE RetailName = ? LIMIT 1`, [row.shop]);
    const retailId = rp[0] && rp[0].RetailID;
    if (!retailId) continue;
    for (const [itemName, buyP, sellP] of row.items) {
      await pool.execute(
        `INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
         SELECT ?, ?, ?, NULL, 80, 10, 1, ? FROM DUAL
         WHERE NOT EXISTS (
           SELECT 1 FROM retailitem i WHERE i.RetailID = ? AND i.ItemName = ?
         )`,
        [itemName, buyP, sellP, retailId, retailId, itemName]
      );
    }
  }

  for (const v of DINING_VENUES) {
    const menuJson = JSON.stringify(v.menu.map(([name, price]) => ({ name, price })));
    const [exists] = await pool.execute(
      `SELECT 1 AS ok FROM visitor_dining_option d2 WHERE d2.DiningName = ? AND d2.AreaID <=> ? LIMIT 1`,
      [v.name, v.areaId]
    );
    if (exists.length) continue;
    await pool.execute(
      `INSERT INTO visitor_dining_option (AreaID, ParkID, DiningName, CuisineType, MenuSummary, MenuItemsJSON, IsActive)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [v.areaId, parkId, v.name, v.cuisine || null, `Menu for ${v.name}`, menuJson]
    );
  }
}

module.exports = { seedParkCatalog };
