const pool = require("./db");
const { seedParkCatalog } = require("./park-catalog-seed");

/** Retail catalog rows used only so visitor purchases can INSERT into transactionlog (FK to retailitem). */
const VP_RETAIL_PLACE_NAME = "Visitor Portal (online)";
const VP_ITEM_TICKET = "Park ticket (visitor portal)";
const VP_ITEM_DINING = "Dining (visitor portal)";

function toISODate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toISODateUTC(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addCalendarDaysISO(isoDateStr, deltaDays) {
  const s = String(isoDateStr).slice(0, 10);
  const [y, m, d] = s.split("-").map((n) => Number(n));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return toISODateUTC(dt);
}

/** Expiry is stored as a DATE: ticket is valid through the end of that calendar day. */
function computeTicketPurchaseExpiryDate({ TicketPlan, VisitDate, MultiDayCount }) {
  const plan = String(TicketPlan || "");
  if (plan === "SeasonPass") {
    const y = new Date().getFullYear();
    return `${y}-12-31`;
  }
  const visit = VisitDate ? String(VisitDate).slice(0, 10) : "";
  if (!visit) return null;
  if (plan === "SingleDay") return visit;
  if (plan === "MultiDay") {
    const n = Number(MultiDayCount);
    const span = Number.isFinite(n) && n >= 2 ? Math.floor(n) : 2;
    return addCalendarDaysISO(visit, span - 1);
  }
  return visit;
}

function computeIsActiveFromExpiryDate(expiryDateStr) {
  if (!expiryDateStr) return 1;
  const today = toISODate(new Date());
  return String(expiryDateStr) >= today ? 1 : 0;
}

async function ensureVisitorPortalSchema() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS visitor_park (
      ParkID INT NOT NULL AUTO_INCREMENT,
      ParkName VARCHAR(120) NOT NULL UNIQUE,
      LocationText VARCHAR(255) NULL,
      OpeningTime TIME NULL,
      ClosingTime TIME NULL,
      MapImageUrl VARCHAR(255) NULL,
      IsActive TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (ParkID)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS visitor_attraction_detail (
      AttractionID INT NOT NULL,
      ParkID INT NULL,
      Description TEXT NULL,
      HeightRequirementCm INT NULL,
      DurationMinutes INT NULL,
      ThrillLevel ENUM('Low', 'Medium', 'High', 'Extreme') NOT NULL DEFAULT 'Medium',
      LocationHint VARCHAR(150) NULL,
      UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (AttractionID),
      CONSTRAINT fk_vad_attraction FOREIGN KEY (AttractionID) REFERENCES attraction(AttractionID) ON DELETE CASCADE,
      CONSTRAINT fk_vad_park FOREIGN KEY (ParkID) REFERENCES visitor_park(ParkID) ON DELETE SET NULL
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS visitor_special_event (
      EventID INT NOT NULL AUTO_INCREMENT,
      ParkID INT NULL,
      EventName VARCHAR(120) NOT NULL,
      EventDescription TEXT NULL,
      EventDate DATE NOT NULL,
      StartTime TIME NULL,
      EndTime TIME NULL,
      PRIMARY KEY (EventID),
      CONSTRAINT fk_vse_park FOREIGN KEY (ParkID) REFERENCES visitor_park(ParkID) ON DELETE SET NULL
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS visitor_dining_option (
      DiningID INT NOT NULL AUTO_INCREMENT,
      AreaID INT NULL,
      ParkID INT NULL,
      DiningName VARCHAR(120) NOT NULL,
      CuisineType VARCHAR(80) NULL,
      MenuSummary TEXT NULL,
      MenuItemsJSON TEXT NULL,
      IsActive TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (DiningID),
      CONSTRAINT fk_vdo_area FOREIGN KEY (AreaID) REFERENCES area(AreaID) ON DELETE SET NULL,
      CONSTRAINT fk_vdo_park FOREIGN KEY (ParkID) REFERENCES visitor_park(ParkID) ON DELETE SET NULL
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS visitor_promo_code (
      PromoCodeID INT NOT NULL AUTO_INCREMENT,
      Code VARCHAR(32) NOT NULL UNIQUE,
      DiscountType ENUM('Percent', 'Flat') NOT NULL DEFAULT 'Percent',
      DiscountValue DECIMAL(10,2) NOT NULL,
      ActiveFrom DATE NULL,
      ActiveTo DATE NULL,
      IsActive TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (PromoCodeID)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS visitor_order (
      OrderID INT NOT NULL AUTO_INCREMENT,
      VisitorID INT NOT NULL,
      OrderType ENUM('Ticket', 'Dining', 'Merchandise') NOT NULL,
      OrderTotal DECIMAL(10,2) NOT NULL DEFAULT 0,
      DiscountAmount DECIMAL(10,2) NOT NULL DEFAULT 0,
      PromoCodeID INT NULL,
      PaymentMethod VARCHAR(40) NULL,
      PaymentStatus ENUM('Pending', 'Paid', 'Failed', 'Refunded') NOT NULL DEFAULT 'Paid',
      CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (OrderID),
      CONSTRAINT fk_vo_visitor FOREIGN KEY (VisitorID) REFERENCES visitor(VisitorID) ON DELETE CASCADE,
      CONSTRAINT fk_vo_promo FOREIGN KEY (PromoCodeID) REFERENCES visitor_promo_code(PromoCodeID) ON DELETE SET NULL
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS visitor_order_item (
      OrderItemID INT NOT NULL AUTO_INCREMENT,
      OrderID INT NOT NULL,
      ItemType ENUM('Ticket', 'Dining', 'Merchandise') NOT NULL,
      ItemRefID INT NULL,
      ItemName VARCHAR(120) NOT NULL,
      Quantity INT NOT NULL DEFAULT 1,
      UnitPrice DECIMAL(10,2) NOT NULL DEFAULT 0,
      TotalPrice DECIMAL(10,2) NOT NULL DEFAULT 0,
      PRIMARY KEY (OrderItemID),
      CONSTRAINT fk_voi_order FOREIGN KEY (OrderID) REFERENCES visitor_order(OrderID) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS visitor_reservation (
      ReservationID INT NOT NULL AUTO_INCREMENT,
      VisitorID INT NOT NULL,
      ReservationType ENUM('FastPass', 'Ride', 'Dining') NOT NULL,
      AttractionID INT NULL,
      DiningID INT NULL,
      ReservationDate DATE NOT NULL,
      TimeSlot VARCHAR(40) NOT NULL,
      PartySize INT NOT NULL DEFAULT 1,
      Status ENUM('Upcoming', 'Cancelled', 'Completed', 'Rescheduled') NOT NULL DEFAULT 'Upcoming',
      Notes VARCHAR(255) NULL,
      CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (ReservationID),
      CONSTRAINT fk_vr_visitor FOREIGN KEY (VisitorID) REFERENCES visitor(VisitorID) ON DELETE CASCADE,
      CONSTRAINT fk_vr_attraction FOREIGN KEY (AttractionID) REFERENCES attraction(AttractionID) ON DELETE SET NULL,
      CONSTRAINT fk_vr_dining FOREIGN KEY (DiningID) REFERENCES visitor_dining_option(DiningID) ON DELETE SET NULL
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS visitor_itinerary_item (
      ItineraryID INT NOT NULL AUTO_INCREMENT,
      VisitorID INT NOT NULL,
      AttractionID INT NULL,
      ParkID INT NULL,
      PlannedDate DATE NULL,
      ItemType ENUM('Wishlist', 'Itinerary') NOT NULL DEFAULT 'Wishlist',
      Notes VARCHAR(255) NULL,
      CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (ItineraryID),
      CONSTRAINT fk_vii_visitor FOREIGN KEY (VisitorID) REFERENCES visitor(VisitorID) ON DELETE CASCADE,
      CONSTRAINT fk_vii_attraction FOREIGN KEY (AttractionID) REFERENCES attraction(AttractionID) ON DELETE SET NULL,
      CONSTRAINT fk_vii_park FOREIGN KEY (ParkID) REFERENCES visitor_park(ParkID) ON DELETE SET NULL
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS visitor_visit_history (
      VisitHistoryID INT NOT NULL AUTO_INCREMENT,
      VisitorID INT NOT NULL,
      ActivityType VARCHAR(50) NOT NULL,
      ActivitySummary VARCHAR(255) NOT NULL,
      VisitDateTime TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (VisitHistoryID),
      CONSTRAINT fk_vvh_visitor FOREIGN KEY (VisitorID) REFERENCES visitor(VisitorID) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS visitor_feedback_submission (
      FeedbackID INT NOT NULL AUTO_INCREMENT,
      VisitorID INT NOT NULL,
      AttractionID INT NULL,
      Rating INT NULL,
      FeedbackType ENUM('Review', 'Complaint', 'General') NOT NULL DEFAULT 'General',
      Message TEXT NOT NULL,
      CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (FeedbackID),
      CONSTRAINT fk_vfs_visitor FOREIGN KEY (VisitorID) REFERENCES visitor(VisitorID) ON DELETE CASCADE,
      CONSTRAINT fk_vfs_attraction FOREIGN KEY (AttractionID) REFERENCES attraction(AttractionID) ON DELETE SET NULL
    )
  `);

  await pool.execute(`
    INSERT INTO visitor_park (ParkName, LocationText, OpeningTime, ClosingTime, MapImageUrl)
    SELECT 'Nightmare Nexus Main Park', 'Downtown Theme District', '09:00:00', '22:00:00', '/assets/map-main-park.svg'
    WHERE NOT EXISTS (SELECT 1 FROM visitor_park)
  `);

  await pool.execute(`
    INSERT INTO visitor_promo_code (Code, DiscountType, DiscountValue, ActiveFrom, ActiveTo, IsActive)
    SELECT 'WELCOME10', 'Percent', 10, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY), 1
    WHERE NOT EXISTS (SELECT 1 FROM visitor_promo_code WHERE Code = 'WELCOME10')
  `);

  await pool.execute(`
    INSERT INTO visitor_promo_code (Code, DiscountType, DiscountValue, ActiveFrom, ActiveTo, IsActive)
    SELECT 'FAMILY25', 'Flat', 25, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY), 1
    WHERE NOT EXISTS (SELECT 1 FROM visitor_promo_code WHERE Code = 'FAMILY25')
  `);

  await seedParkCatalog(pool);
  await ensureVisitorPortalTransactionPlaceholderItems();
}

/**
 * Creates a retail shop + two non-inventory catalog lines so ticket/dining visitor sales can log to transactionlog.
 * Merchandise uses the real ItemID from retailitem.
 */
async function ensureVisitorPortalTransactionPlaceholderItems() {
  try {
    const [areas] = await pool.execute(`SELECT MIN(AreaID) AS aid FROM area`);
    const areaId = areas[0] && areas[0].aid;
    if (!areaId) return;

    await pool.execute(
      `INSERT INTO retailplace (RetailName, AreaID)
       SELECT ?, ? FROM DUAL
       WHERE NOT EXISTS (SELECT 1 FROM retailplace WHERE RetailName = ?)`,
      [VP_RETAIL_PLACE_NAME, areaId, VP_RETAIL_PLACE_NAME]
    );

    const [rpRows] = await pool.execute(
      `SELECT RetailID FROM retailplace WHERE RetailName = ? LIMIT 1`,
      [VP_RETAIL_PLACE_NAME]
    );
    const retailId = rpRows[0] && rpRows[0].RetailID;
    if (!retailId) return;

    for (const itemName of [VP_ITEM_TICKET, VP_ITEM_DINING]) {
      const [exists] = await pool.execute(`SELECT ItemID FROM retailitem WHERE ItemName = ? LIMIT 1`, [itemName]);
      if (exists[0]) continue;
      await pool.execute(
        `INSERT INTO retailitem (ItemName, BuyPrice, SellPrice, DiscountPrice, Quantity, LowStockThreshold, IsActive, RetailID)
         VALUES (?, 0.01, 0.01, NULL, 999999, 10, 1, ?)`,
        [itemName, retailId]
      );
    }
  } catch (e) {
    console.warn("[visitor] ensureVisitorPortalTransactionPlaceholderItems:", e && e.message);
  }
}

async function getVisitorPortalStubLogItemIds() {
  const [t] = await pool.execute(`SELECT ItemID FROM retailitem WHERE ItemName = ? LIMIT 1`, [VP_ITEM_TICKET]);
  const [d] = await pool.execute(`SELECT ItemID FROM retailitem WHERE ItemName = ? LIMIT 1`, [VP_ITEM_DINING]);
  return {
    ticketItemId: t[0] ? t[0].ItemID : null,
    diningItemId: d[0] ? d[0].ItemID : null,
  };
}

/**
 * Logs a sale to transactionlog for the retail portal (VisitorID set).
 * If your DB has BEFORE INSERT triggers on transactionlog that overwrite Price, amounts may not match visitor totals.
 */
async function logVisitorPurchaseToTransactionLog({
  visitorId,
  itemId,
  quantity,
  unitPrice,
  totalCost,
  useDiscountType,
}) {
  const id = Number(itemId);
  const vid = Number(visitorId);
  if (!Number.isFinite(id) || id < 1 || !Number.isFinite(vid) || vid < 1) return;
  const q = Math.max(1, Math.floor(Number(quantity) || 1));
  const up = Number(Number(unitPrice).toFixed(2));
  const tc = Number(Number(totalCost).toFixed(2));
  if (!Number.isFinite(up) || up < 0 || !Number.isFinite(tc) || tc < 0) return;
  const logType = useDiscountType ? "Discount" : "Normal";
  try {
    await pool.execute(
      `INSERT INTO transactionlog (ItemID, VisitorID, \`Date\`, \`Time\`, Type, Price, Quantity, TotalCost)
       VALUES (?, ?, CURDATE(), CURTIME(), ?, ?, ?, ?)`,
      [id, vid, logType, up, q, tc]
    );
  } catch (e) {
    console.warn("[visitor] transactionlog insert failed:", e && e.message);
  }
}

async function createVisitor({ Name, Phone, Email, PasswordHash, Gender, Age }) {
  const [result] = await pool.execute(
    `INSERT INTO visitor (Name, Phone, Email, PasswordHash, Gender, Age)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [Name, Phone || null, Email, PasswordHash, Gender || null, Age || null]
  );
  return { VisitorID: result.insertId };
}

async function getVisitorByEmail(Email) {
  const [rows] = await pool.execute(`SELECT * FROM visitor WHERE Email = ? LIMIT 1`, [Email]);
  return rows[0] || null;
}

async function getVisitorById(VisitorID) {
  const [rows] = await pool.execute(
    `SELECT VisitorID, Name, Phone, Email, Gender, Age, CreatedAt, IsActive
     FROM visitor WHERE VisitorID = ? LIMIT 1`,
    [VisitorID]
  );
  return rows[0] || null;
}

async function updateVisitorProfile(VisitorID, { Name, Phone, Gender, Age }) {
  const [result] = await pool.execute(
    `UPDATE visitor
     SET Name = ?, Phone = ?, Gender = ?, Age = ?
     WHERE VisitorID = ?`,
    [Name, Phone || null, Gender || null, Age == null ? null : Number(Age), VisitorID]
  );
  return result.affectedRows > 0;
}

async function addVisitHistory(VisitorID, ActivityType, ActivitySummary) {
  await pool.execute(
    `INSERT INTO visitor_visit_history (VisitorID, ActivityType, ActivitySummary) VALUES (?, ?, ?)`,
    [VisitorID, ActivityType, ActivitySummary]
  );
}

async function listVisitHistory(VisitorID) {
  const [rows] = await pool.execute(
    `SELECT VisitHistoryID, ActivityType, ActivitySummary, VisitDateTime
     FROM visitor_visit_history
     WHERE VisitorID = ?
     ORDER BY VisitDateTime DESC, VisitHistoryID DESC`,
    [VisitorID]
  );
  return rows;
}

async function listAreas() {
  const [rows] = await pool.execute(`SELECT AreaID, AreaName FROM area ORDER BY AreaID`);
  return rows;
}

async function listParks() {
  const [rows] = await pool.execute(
    `SELECT ParkID, ParkName, LocationText, OpeningTime, ClosingTime, MapImageUrl
     FROM visitor_park
     WHERE IsActive = 1
     ORDER BY ParkName`
  );
  return rows;
}

const DEFAULT_VISITOR_PARK_DISPLAY = "Nightmare Nexus Main Park";

function hashStringSeed(str) {
  let h = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Curated hover copy aligned with `visitor_portal_area_content_seed` where attractions match. */
const ATTRACTION_HOVER_DETAIL_BY_NAME = {
  "Escape the Backrooms": {
    Description: "Navigate endless liminal corridors and find the exit before the lights fail.",
    HeightRequirementCm: 120,
    DurationMinutes: 9,
    ThrillLevel: "High",
    LocationHint: "Uncanny Valley East Wing",
  },
  "Alternate Invasion": {
    Description: "Reality fractures as alternate selves invade the city.",
    HeightRequirementCm: 115,
    DurationMinutes: 8,
    ThrillLevel: "High",
    LocationHint: "Uncanny Valley Transit Tunnel",
  },
  "The Offering": {
    Description: "Witness a midnight offering deep in the ceremonial grounds.",
    HeightRequirementCm: 120,
    DurationMinutes: 8,
    ThrillLevel: "High",
    LocationHint: "Bloodmoon Inner Circle",
  },
  "Forest of Whispers": {
    Description: "A torch-lit trek where whispers follow every step.",
    HeightRequirementCm: 110,
    DurationMinutes: 10,
    ThrillLevel: "High",
    LocationHint: "Bloodmoon Forest Path",
  },
  "AI Override": {
    Description: "A rogue AI takes command of life support systems—can you regain control?",
    HeightRequirementCm: 120,
    DurationMinutes: 8,
    ThrillLevel: "High",
    LocationHint: "Space Station Core",
  },
  "Containment Breach": {
    Description: "Containment fails and the creature escapes; evacuate through sealed corridors.",
    HeightRequirementCm: 125,
    DurationMinutes: 9,
    ThrillLevel: "Extreme",
    LocationHint: "Bio-Lab Sector",
  },
  "Zero-Gravity Situation": {
    Description: "Simulated zero gravity with catastrophic malfunctions—strap in tight.",
    HeightRequirementCm: 120,
    DurationMinutes: 7,
    ThrillLevel: "High",
    LocationHint: "Orbital Ring",
  },
  "Watchtower Drop": {
    Description: "A vertical drop from the ranger watchtower with blackout moments.",
    HeightRequirementCm: 130,
    DurationMinutes: 2,
    ThrillLevel: "Extreme",
    LocationHint: "Camp Ridge",
  },
  "Cryptid Hunt": {
    Description: "A nighttime hunt for creatures in dense forest—stay with your group.",
    HeightRequirementCm: 120,
    DurationMinutes: 9,
    ThrillLevel: "High",
    LocationHint: "Blackwood Trailhead",
  },
  "Trail Tour": {
    Description: "A scenic tour that turns into a survival route when the trail shifts.",
    HeightRequirementCm: 100,
    DurationMinutes: 11,
    ThrillLevel: "Medium",
    LocationHint: "North Trail Loop",
  },
  "Lake Terror": {
    Description: "A peaceful lake ride interrupted by unknown movement beneath the hull.",
    HeightRequirementCm: 110,
    DurationMinutes: 8,
    ThrillLevel: "High",
    LocationHint: "Blackwood Lakefront",
  },
  "Psych Ward Tour": {
    Description: "A guided walk through a ward with no clear exit and shifting rooms.",
    HeightRequirementCm: 115,
    DurationMinutes: 8,
    ThrillLevel: "High",
    LocationHint: "Dead End Clinic",
  },
  "Midnight Stalker": {
    Description: "Stay hidden while a killer roams the block—silence is survival.",
    HeightRequirementCm: 120,
    DurationMinutes: 9,
    ThrillLevel: "High",
    LocationHint: "Midnight Avenue",
  },
  "Final Girl: The Chase": {
    Description: "A chase sequence where you must keep moving—no standing still.",
    HeightRequirementCm: 120,
    DurationMinutes: 7,
    ThrillLevel: "Extreme",
    LocationHint: "Final Street",
  },
  "Outbreak: Day Zero": {
    Description: "Patient zero escapes and the ward falls—seal the doors or run.",
    HeightRequirementCm: 120,
    DurationMinutes: 8,
    ThrillLevel: "High",
    LocationHint: "Isolation Block A",
  },
  "Evacuation Protocol": {
    Description: "Attempt evacuation while systems collapse around you.",
    HeightRequirementCm: 120,
    DurationMinutes: 9,
    ThrillLevel: "High",
    LocationHint: "Emergency Corridor",
  },
  "Containment Collapse": {
    Description: "Containment barriers fail one by one—reach the exit before lockdown.",
    HeightRequirementCm: 125,
    DurationMinutes: 8,
    ThrillLevel: "Extreme",
    LocationHint: "Biohazard Gate",
  },
  "Last Stand Barricade": {
    Description: "Defend the final barricade against waves of infected.",
    HeightRequirementCm: 120,
    DurationMinutes: 9,
    ThrillLevel: "High",
    LocationHint: "Ward Perimeter",
  },
};

function generatedAttractionFallback(attractionName) {
  const h = hashStringSeed(attractionName);
  const heights = [0, 100, 105, 110, 115, 120, 125, 130];
  const thrills = ["Low", "Medium", "High", "Extreme"];
  return {
    Description: `${attractionName}: a full-sensory horror experience—expect tight spaces, loud audio, and strobe effects.`,
    HeightRequirementCm: heights[h % heights.length],
    DurationMinutes: 6 + (h % 9),
    ThrillLevel: thrills[h % 4],
    LocationHint: "Check the park map at the nearest guest services kiosk.",
  };
}

function enrichAttractionVisitorRow(row) {
  const name = String(row.AttractionName || "");
  const base = ATTRACTION_HOVER_DETAIL_BY_NAME[name] || generatedAttractionFallback(name);
  const rawThrill = row.ThrillLevel || base.ThrillLevel;
  const thrillOk = ["Low", "Medium", "High", "Extreme"].includes(String(rawThrill)) ? String(rawThrill) : base.ThrillLevel;
  const desc =
    row.Description != null && String(row.Description).trim() !== "" ? String(row.Description).trim() : base.Description;
  const height = row.HeightRequirementCm != null ? row.HeightRequirementCm : base.HeightRequirementCm;
  const duration = row.DurationMinutes != null ? row.DurationMinutes : base.DurationMinutes;
  const hint = row.LocationHint != null && String(row.LocationHint).trim() !== "" ? String(row.LocationHint).trim() : base.LocationHint;
  const wait = row.WaitTimeMinutes != null && !Number.isNaN(Number(row.WaitTimeMinutes)) ? row.WaitTimeMinutes : 12 + (hashStringSeed(name) % 55);
  const severity =
    row.SeverityLevel != null && String(row.SeverityLevel).trim() !== ""
      ? row.SeverityLevel
      : ["Mild", "Moderate", "High alert"][hashStringSeed(name) % 3];
  return {
    ...row,
    Description: desc,
    HeightRequirementCm: height,
    DurationMinutes: duration,
    ThrillLevel: thrillOk,
    LocationHint: hint,
    Status: row.Status && String(row.Status).trim() ? row.Status : "Open",
    WaitTimeMinutes: wait,
    SeverityLevel: severity,
    AreaName: row.AreaName && String(row.AreaName).trim() ? row.AreaName : "Park grounds",
    ParkName: row.ParkName && String(row.ParkName).trim() ? row.ParkName : DEFAULT_VISITOR_PARK_DISPLAY,
  };
}

const EVENT_VENUE_HINT_BY_NAME = {
  "Broadcast Hijack": "Uncanny Valley Broadcast Hall",
  "Body Count": "District Courtyard",
  "Camper Safety Orientation": "Camp Assembly Hall",
  "Emergency Broadcast Live": "Broadcast Room",
  "Execution Alley": "Execution Alley Stage",
  "Harvest Festival": "Bloodmoon Village Square",
  "Looping Day": "Uncanny Valley Theater",
  "Pastor John's Sermon": "Bloodmoon Chapel",
  "Smile Protocol": "Uncanny Valley Main Plaza",
  "The Last Transmission": "Comms Deck",
};

function enrichEventVisitorRow(row) {
  const name = String(row.EventName || "Special event");
  const h = hashStringSeed(name);
  const park = row.ParkName && String(row.ParkName).trim() ? row.ParkName : DEFAULT_VISITOR_PARK_DISPLAY;
  const desc =
    row.EventDescription != null && String(row.EventDescription).trim() !== ""
      ? String(row.EventDescription).trim()
      : `${name}: an evening show with practical effects, low visibility sections, and sudden sound cues.`;
  const venue = EVENT_VENUE_HINT_BY_NAME[name] || "Listed venue on your ticket or main amphitheater";
  const start = row.StartTime || "19:00:00";
  const end = row.EndTime || "19:30:00";
  const runtime = 25 + (h % 35);
  return {
    ...row,
    EventDescription: desc,
    ParkName: park,
    EventDate: row.EventDate || toISODate(new Date()),
    StartTime: start,
    EndTime: end,
    RuntimeMinutes: runtime,
    VenueHint: venue,
  };
}

async function listAttractionsWithDetails() {
  /* Rides / non-shows only — rows with AttractionType = 'Show' appear under /api/events instead. */
  const allowedAttractionNames = [
    "Escape the Backrooms",
    "Alternate Invasion",
    "The Offering",
    "Forest of Whispers",
    "AI Override",
    "Containment Breach",
    "Zero-Gravity Situation",
    "Watchtower Drop",
    "Cryptid Hunt",
    "Trail Tour",
    "Lake Terror",
    "Psych Ward Tour",
    "Midnight Stalker",
    "Final Girl: The Chase",
    "Outbreak: Day Zero",
    "Evacuation Protocol",
    "Containment Collapse",
    "Last Stand Barricade",
  ];

  const placeholders = allowedAttractionNames.map(() => "?").join(",");
  const [rows] = await pool.execute(
    `SELECT
        a.AttractionID,
        a.AttractionName,
        a.AttractionType,
        a.Status,
        a.QueueCount AS WaitTimeMinutes,
        a.SeverityLevel,
        ar.AreaName,
        d.Description,
        d.HeightRequirementCm,
        d.DurationMinutes,
        d.ThrillLevel,
        d.LocationHint,
        p.ParkID,
        p.ParkName
     FROM attraction a
     LEFT JOIN area ar ON ar.AreaID = a.AreaID
     LEFT JOIN visitor_attraction_detail d ON d.AttractionID = a.AttractionID
     LEFT JOIN visitor_park p ON p.ParkID = d.ParkID
     WHERE a.AttractionName IN (${placeholders})
       AND a.AttractionType <> 'Show'
     ORDER BY ar.AreaName, a.AttractionName, a.AttractionID`
    ,
    allowedAttractionNames
  );
  return rows.map(enrichAttractionVisitorRow);
}

async function listSpecialEvents() {
  const [manualRows] = await pool.execute(
    `SELECT
        e.EventID,
        e.EventName,
        e.EventDescription,
        e.EventDate,
        e.StartTime,
        e.EndTime,
        p.ParkName
     FROM visitor_special_event e
     LEFT JOIN visitor_park p ON p.ParkID = e.ParkID
     ORDER BY e.EventDate ASC, e.StartTime ASC`
  );

  const allowedShowNames = [
    "Broadcast Hijack",
    "Body Count",
    "Camper Safety Orientation",
    "Emergency Broadcast Live",
    "Execution Alley",
    "Harvest Festival",
    "Looping Day",
    "Pastor John's Sermon",
    "Smile Protocol",
    "The Last Transmission",
  ];
  const placeholders = allowedShowNames.map(() => "?").join(",");
  const [showRows] = await pool.execute(
    `SELECT
        a.AttractionID AS EventID,
        a.AttractionName AS EventName,
        COALESCE(d.Description, CONCAT(a.AttractionName, ' show event')) AS EventDescription,
        CURDATE() AS EventDate,
        '19:00:00' AS StartTime,
        '19:30:00' AS EndTime,
        p.ParkName
     FROM attraction a
     LEFT JOIN visitor_attraction_detail d ON d.AttractionID = a.AttractionID
     LEFT JOIN visitor_park p ON p.ParkID = d.ParkID
     WHERE a.AttractionName IN (${placeholders})
       AND a.AttractionType = 'Show'
     ORDER BY a.AttractionName`,
    allowedShowNames
  );

  return [...manualRows, ...showRows].map(enrichEventVisitorRow);
}

async function listDiningOptions() {
  const [rows] = await pool.execute(
    `SELECT
        d.DiningID,
        d.DiningName,
        d.CuisineType,
        d.MenuSummary,
        d.MenuItemsJSON,
        a.AreaName,
        p.ParkName
     FROM visitor_dining_option d
     LEFT JOIN area a ON a.AreaID = d.AreaID
     LEFT JOIN visitor_park p ON p.ParkID = d.ParkID
     WHERE d.IsActive = 1
     ORDER BY a.AreaID, d.DiningName`
  );
  return rows;
}

async function listMerchandiseOptions() {
  const [rows] = await pool.execute(
    `SELECT
        i.ItemID,
        i.ItemName,
        i.SellPrice,
        i.DiscountPrice,
        i.Quantity,
        rp.RetailName,
        a.AreaName,
        rp.AreaID
     FROM retailitem i
     JOIN retailplace rp ON rp.RetailID = i.RetailID
     LEFT JOIN area a ON a.AreaID = rp.AreaID
     WHERE i.IsActive = 1
     ORDER BY rp.AreaID, rp.RetailName, i.ItemName`
  );
  return rows;
}

async function listTicketsForVisitor(VisitorID, { ticketType, includeInactive } = {}) {
  const where = [`VisitorID = ?`];
  const params = [VisitorID];
  if (ticketType) {
    where.push(`TicketType = ?`);
    params.push(ticketType);
  }
  if (!includeInactive) where.push(`IsActive = 1`);

  const [rows] = await pool.execute(
    `SELECT TicketNumber, TicketType, DiscountFor, Price, IssueDate, ExpiryDate, IsActive
     FROM ticket
     WHERE ${where.join(" AND ")}
     ORDER BY ExpiryDate DESC, TicketNumber DESC`,
    params
  );
  return rows;
}

async function createTicket(VisitorID, { TicketType, DiscountFor, Price, ExpiryDate }) {
  const isActive = computeIsActiveFromExpiryDate(ExpiryDate);
  const [result] = await pool.execute(
    `INSERT INTO ticket (TicketType, DiscountFor, Price, ExpiryDate, VisitorID, IsActive)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [TicketType, DiscountFor, Price, ExpiryDate, VisitorID, isActive]
  );

  // MySQL doesn't always reliably return computed defaults across drivers;
  // fetch the row back so the frontend gets consistent fields.
  const [rows] = await pool.execute(
    `SELECT TicketNumber, TicketType, DiscountFor, Price, IssueDate, ExpiryDate, IsActive
     FROM ticket
     WHERE TicketNumber = ? AND VisitorID = ?`,
    [result.insertId, VisitorID]
  );
  return rows[0] || null;
}

const MEMBERSHIP_PERKS = [
  "Skip lines",
  "Exclusive zones",
  "Priority access",
];

function getTicketBasePrice(category) {
  if (category === "General") return 40;
  // Senior, Veteran, Child all count as discounted tickets.
  return 30;
}

function mapTicketPayload(payload) {
  const plan = String(payload.TicketPlan || "SingleDay");
  const category = String(payload.TicketCategory || "General");
  let TicketType = "Basic";
  let DiscountFor = "None";
  if (category === "Membership" || plan === "SeasonPass") {
    TicketType = "Membership";
  } else if (category === "Senior" || category === "Veteran" || category === "Child") {
    TicketType = "Discount";
    DiscountFor = category;
  }
  const BasePrice = TicketType === "Membership" ? 100 : getTicketBasePrice(category);
  const MembershipPerks = TicketType === "Membership" ? MEMBERSHIP_PERKS : [];
  return { TicketType, DiscountFor, BasePrice, MembershipPerks };
}

async function findPromoCode(code) {
  if (!code) return null;
  const [rows] = await pool.execute(
    `SELECT PromoCodeID, Code, DiscountType, DiscountValue
     FROM visitor_promo_code
     WHERE Code = ? AND IsActive = 1
       AND (ActiveFrom IS NULL OR ActiveFrom <= CURDATE())
       AND (ActiveTo IS NULL OR ActiveTo >= CURDATE())
     LIMIT 1`,
    [String(code).trim().toUpperCase()]
  );
  return rows[0] || null;
}

function applyPromo(total, promo) {
  if (!promo) return { total, discountAmount: 0 };
  const rawTotal = Number(total) || 0;
  let discountAmount = 0;
  if (promo.DiscountType === "Percent") {
    discountAmount = (rawTotal * Number(promo.DiscountValue || 0)) / 100;
  } else {
    discountAmount = Number(promo.DiscountValue || 0);
  }
  if (discountAmount > rawTotal) discountAmount = rawTotal;
  return {
    total: Number((rawTotal - discountAmount).toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
  };
}

async function purchaseTicketForVisitor(
  VisitorID,
  { TicketPlan, TicketCategory, ExpiryDate, PaymentMethod }
) {
  const { TicketType, DiscountFor, BasePrice, MembershipPerks } = mapTicketPayload({
    TicketPlan,
    TicketCategory,
  });
  const total = BasePrice;
  const discountAmount = 0;

  const ticket = await createTicket(VisitorID, { TicketType, DiscountFor, Price: total, ExpiryDate });
  const [orderResult] = await pool.execute(
    `INSERT INTO visitor_order
      (VisitorID, OrderType, OrderTotal, DiscountAmount, PromoCodeID, PaymentMethod, PaymentStatus)
     VALUES (?, 'Ticket', ?, ?, NULL, ?, 'Paid')`,
    [VisitorID, total, discountAmount, PaymentMethod || null]
  );
  await pool.execute(
    `INSERT INTO visitor_order_item
      (OrderID, ItemType, ItemRefID, ItemName, Quantity, UnitPrice, TotalPrice)
     VALUES (?, 'Ticket', ?, ?, 1, ?, ?)`,
    [orderResult.insertId, ticket.TicketNumber, `${TicketPlan} (${TicketCategory})`, BasePrice, total]
  );

  await addVisitHistory(VisitorID, "TicketPurchase", `Purchased ${TicketPlan} ticket (${TicketCategory})`);

  const { ticketItemId } = await getVisitorPortalStubLogItemIds();
  const qty = 1;
  const unit = Number((total / qty).toFixed(2));
  await logVisitorPurchaseToTransactionLog({
    visitorId: VisitorID,
    itemId: ticketItemId,
    quantity: qty,
    unitPrice: unit,
    totalCost: total,
    useDiscountType: discountAmount > 0,
  });

  return {
    ticket,
    orderId: orderResult.insertId,
    appliedPromo: null,
    discountAmount,
    basePrice: BasePrice,
    membershipPerks: MembershipPerks,
  };
}

async function createReservationForVisitor(
  VisitorID,
  { ReservationType, AttractionID, DiningID, ReservationDate, TimeSlot, PartySize, Notes }
) {
  const [result] = await pool.execute(
    `INSERT INTO visitor_reservation
      (VisitorID, ReservationType, AttractionID, DiningID, ReservationDate, TimeSlot, PartySize, Status, Notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Upcoming', ?)`,
    [
      VisitorID,
      ReservationType,
      AttractionID || null,
      DiningID || null,
      ReservationDate,
      TimeSlot,
      Number(PartySize || 1),
      Notes || null,
    ]
  );
  await addVisitHistory(VisitorID, "Reservation", `Booked ${ReservationType} reservation for ${ReservationDate} ${TimeSlot}`);
  return result.insertId;
}

async function listReservationsForVisitor(VisitorID) {
  const [rows] = await pool.execute(
    `SELECT
        r.ReservationID,
        r.ReservationType,
        r.ReservationDate,
        r.TimeSlot,
        r.PartySize,
        r.Status,
        r.Notes,
        a.AttractionName,
        d.DiningName
     FROM visitor_reservation r
     LEFT JOIN attraction a ON a.AttractionID = r.AttractionID
     LEFT JOIN visitor_dining_option d ON d.DiningID = r.DiningID
     WHERE r.VisitorID = ?
     ORDER BY r.ReservationDate ASC, r.TimeSlot ASC`,
    [VisitorID]
  );
  return rows;
}

async function updateReservationForVisitor(VisitorID, ReservationID, patch) {
  const [result] = await pool.execute(
    `UPDATE visitor_reservation
     SET ReservationDate = ?, TimeSlot = ?, PartySize = ?, Status = ?, Notes = ?
     WHERE ReservationID = ? AND VisitorID = ?`,
    [
      patch.ReservationDate,
      patch.TimeSlot,
      Number(patch.PartySize || 1),
      patch.Status,
      patch.Notes || null,
      ReservationID,
      VisitorID,
    ]
  );
  return result.affectedRows > 0;
}

async function createItineraryItem(VisitorID, { AttractionID, ParkID, PlannedDate, ItemType, Notes }) {
  const [result] = await pool.execute(
    `INSERT INTO visitor_itinerary_item
      (VisitorID, AttractionID, ParkID, PlannedDate, ItemType, Notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [VisitorID, AttractionID || null, ParkID || null, PlannedDate || null, ItemType || "Wishlist", Notes || null]
  );
  await addVisitHistory(VisitorID, "Planning", `Added ${ItemType || "Wishlist"} item`);
  return result.insertId;
}

async function listItineraryItems(VisitorID) {
  const [rows] = await pool.execute(
    `SELECT
        i.ItineraryID,
        i.ItemType,
        i.PlannedDate,
        i.Notes,
        a.AttractionName,
        p.ParkName
     FROM visitor_itinerary_item i
     LEFT JOIN attraction a ON a.AttractionID = i.AttractionID
     LEFT JOIN visitor_park p ON p.ParkID = i.ParkID
     WHERE i.VisitorID = ?
     ORDER BY i.CreatedAt DESC`,
    [VisitorID]
  );
  return rows;
}

async function deleteItineraryItem(VisitorID, ItineraryID) {
  const [result] = await pool.execute(
    `DELETE FROM visitor_itinerary_item WHERE ItineraryID = ? AND VisitorID = ?`,
    [ItineraryID, VisitorID]
  );
  return result.affectedRows > 0;
}

async function createFeedbackSubmission(VisitorID, { AttractionID, Rating, FeedbackType, Message }) {
  const r = Number(Rating);
  if (!Number.isInteger(r) || r < 1 || r > 10) {
    const err = new Error("Rating must be an integer from 1 to 10");
    err.code = "INVALID_RATING";
    throw err;
  }
  const type = FeedbackType || "General";
  const msg = String(Message ?? "").trim();
  if (!msg) {
    const err = new Error("Message is required");
    err.code = "MESSAGE_REQUIRED";
    throw err;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO visitor_feedback_submission
        (VisitorID, AttractionID, Rating, FeedbackType, Message)
       VALUES (?, ?, ?, ?, ?)`,
      [VisitorID, AttractionID || null, r, type, msg]
    );
    const feedbackId = result.insertId;

    let areaId = null;
    if (AttractionID) {
      const aid = Number(AttractionID);
      if (Number.isInteger(aid) && aid >= 1) {
        const [ar] = await conn.execute(`SELECT AreaID FROM attraction WHERE AttractionID = ? LIMIT 1`, [aid]);
        areaId = ar[0] ? ar[0].AreaID : null;
      }
    }
    if (areaId == null) {
      const [ar2] = await conn.execute(`SELECT MIN(AreaID) AS aid FROM area`);
      areaId = ar2[0]?.aid ?? null;
    }
    if (areaId == null) {
      const err = new Error("No park area available to record visitor review");
      err.code = "NO_AREA";
      throw err;
    }

    const prefix = type && type !== "General" ? `[${type}] ` : "";
    await conn.execute(
      `INSERT INTO review (VisitorID, AreaID, Feedback, Comment, IsActive)
       VALUES (?, ?, ?, ?, 1)`,
      [VisitorID, areaId, r, prefix + msg]
    );

    await conn.commit();
    await addVisitHistory(VisitorID, "Feedback", `Submitted ${type} feedback (${r}/10)`);
    return feedbackId;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function listFeedbackSubmissions(VisitorID) {
  const [rows] = await pool.execute(
    `SELECT
        f.FeedbackID,
        f.Rating,
        f.FeedbackType,
        f.Message,
        f.CreatedAt,
        a.AttractionName
     FROM visitor_feedback_submission f
     LEFT JOIN attraction a ON a.AttractionID = f.AttractionID
     WHERE f.VisitorID = ?
     ORDER BY f.CreatedAt DESC`,
    [VisitorID]
  );
  return rows;
}

async function createDiningOrder(VisitorID, { DiningID, Quantity, UnitPrice, PromoCode, PaymentMethod }) {
  const totalRaw = Number(Quantity || 1) * Number(UnitPrice || 0);
  const promo = await findPromoCode(PromoCode);
  const { total, discountAmount } = applyPromo(totalRaw, promo);

  const [diningRows] = await pool.execute(
    `SELECT DiningName FROM visitor_dining_option WHERE DiningID = ? LIMIT 1`,
    [DiningID]
  );
  const diningName = diningRows[0] ? diningRows[0].DiningName : "Dining Order";

  const [orderResult] = await pool.execute(
    `INSERT INTO visitor_order
      (VisitorID, OrderType, OrderTotal, DiscountAmount, PromoCodeID, PaymentMethod, PaymentStatus)
     VALUES (?, 'Dining', ?, ?, ?, ?, 'Paid')`,
    [VisitorID, total, discountAmount, promo ? promo.PromoCodeID : null, PaymentMethod || null]
  );

  await pool.execute(
    `INSERT INTO visitor_order_item
      (OrderID, ItemType, ItemRefID, ItemName, Quantity, UnitPrice, TotalPrice)
     VALUES (?, 'Dining', ?, ?, ?, ?, ?)`,
    [orderResult.insertId, DiningID, diningName, Number(Quantity || 1), Number(UnitPrice || 0), total]
  );

  await addVisitHistory(VisitorID, "DiningOrder", `Placed dining order at ${diningName}`);

  const { diningItemId } = await getVisitorPortalStubLogItemIds();
  const qtyD = Math.max(1, Math.floor(Number(Quantity || 1)));
  const unitD = Number((total / qtyD).toFixed(2));
  await logVisitorPurchaseToTransactionLog({
    visitorId: VisitorID,
    itemId: diningItemId,
    quantity: qtyD,
    unitPrice: unitD,
    totalCost: total,
    useDiscountType: discountAmount > 0,
  });

  return orderResult.insertId;
}

async function createMerchOrder(VisitorID, { ItemID, Quantity, PromoCode, PaymentMethod }) {
  const [items] = await pool.execute(
    `SELECT ItemName, COALESCE(DiscountPrice, SellPrice) AS Price
     FROM retailitem
     WHERE ItemID = ? AND IsActive = 1
     LIMIT 1`,
    [ItemID]
  );
  if (!items[0]) return null;

  const unitPrice = Number(items[0].Price || 0);
  const qty = Number(Quantity || 1);
  const totalRaw = unitPrice * qty;
  const promo = await findPromoCode(PromoCode);
  const { total, discountAmount } = applyPromo(totalRaw, promo);

  const [orderResult] = await pool.execute(
    `INSERT INTO visitor_order
      (VisitorID, OrderType, OrderTotal, DiscountAmount, PromoCodeID, PaymentMethod, PaymentStatus)
     VALUES (?, 'Merchandise', ?, ?, ?, ?, 'Paid')`,
    [VisitorID, total, discountAmount, promo ? promo.PromoCodeID : null, PaymentMethod || null]
  );

  await pool.execute(
    `INSERT INTO visitor_order_item
      (OrderID, ItemType, ItemRefID, ItemName, Quantity, UnitPrice, TotalPrice)
     VALUES (?, 'Merchandise', ?, ?, ?, ?, ?)`,
    [orderResult.insertId, ItemID, items[0].ItemName, qty, unitPrice, total]
  );
  await addVisitHistory(VisitorID, "MerchOrder", `Purchased merchandise: ${items[0].ItemName}`);

  const unitM = Number((total / qty).toFixed(2));
  await logVisitorPurchaseToTransactionLog({
    visitorId: VisitorID,
    itemId: ItemID,
    quantity: qty,
    unitPrice: unitM,
    totalCost: total,
    useDiscountType: discountAmount > 0,
  });

  return orderResult.insertId;
}

async function listOrdersForVisitor(VisitorID) {
  const [rows] = await pool.execute(
    `SELECT
        o.OrderID,
        o.OrderType,
        o.OrderTotal,
        o.DiscountAmount,
        o.PaymentMethod,
        o.PaymentStatus,
        o.CreatedAt,
        p.Code AS PromoCode
     FROM visitor_order o
     LEFT JOIN visitor_promo_code p ON p.PromoCodeID = o.PromoCodeID
     WHERE o.VisitorID = ?
     ORDER BY o.CreatedAt DESC, o.OrderID DESC`,
    [VisitorID]
  );
  return rows;
}

async function listOrderItems(OrderID, VisitorID) {
  const [rows] = await pool.execute(
    `SELECT i.OrderItemID, i.ItemType, i.ItemRefID, i.ItemName, i.Quantity, i.UnitPrice, i.TotalPrice
     FROM visitor_order_item i
     JOIN visitor_order o ON o.OrderID = i.OrderID
     WHERE i.OrderID = ? AND o.VisitorID = ?
     ORDER BY i.OrderItemID`,
    [OrderID, VisitorID]
  );
  return rows;
}

async function updateTicketForVisitor(VisitorID, TicketNumber, { TicketType, DiscountFor, Price, ExpiryDate }) {
  // Enforce "active" based on expiry date (no DB triggers).
  const computedIsActive = computeIsActiveFromExpiryDate(ExpiryDate);
  const [result] = await pool.execute(
    `UPDATE ticket
     SET TicketType = ?, DiscountFor = ?, Price = ?, ExpiryDate = ?, IsActive = ?
     WHERE TicketNumber = ? AND VisitorID = ?`,
    [TicketType, DiscountFor, Price, ExpiryDate, computedIsActive, TicketNumber, VisitorID]
  );
  return result.affectedRows > 0;
}

async function deleteTicketForVisitor(VisitorID, TicketNumber) {
  const [result] = await pool.execute(
    `DELETE FROM ticket WHERE TicketNumber = ? AND VisitorID = ?`,
    [TicketNumber, VisitorID]
  );
  return result.affectedRows > 0;
}

async function listReviewsForVisitor(VisitorID, { areaId, minRating, maxRating, includeInactive } = {}) {
  const where = [`r.VisitorID = ?`];
  const params = [VisitorID];

  if (areaId) {
    where.push(`r.AreaID = ?`);
    params.push(areaId);
  }
  if (typeof minRating === "number") {
    where.push(`r.Feedback >= ?`);
    params.push(minRating);
  }
  if (typeof maxRating === "number") {
    where.push(`r.Feedback <= ?`);
    params.push(maxRating);
  }
  if (!includeInactive) where.push(`r.IsActive = 1`);

  const [rows] = await pool.execute(
    `SELECT r.ReviewID,
            r.AreaID,
            a.AreaName,
            r.Feedback,
            r.Comment,
            r.DateSubmitted,
            r.IsActive
     FROM review r
     JOIN area a ON a.AreaID = r.AreaID
     WHERE ${where.join(" AND ")}
     ORDER BY r.DateSubmitted DESC, r.ReviewID DESC`,
    params
  );
  return rows;
}

async function createReview(VisitorID, { AreaID, Feedback, Comment, IsActive }) {
  const [result] = await pool.execute(
    `INSERT INTO review (VisitorID, AreaID, Feedback, Comment, IsActive)
     VALUES (?, ?, ?, ?, ?)`,
    [VisitorID, AreaID, Feedback, Comment || null, IsActive ? 1 : 0]
  );
  const [rows] = await pool.execute(
    `SELECT r.ReviewID,
            r.AreaID,
            a.AreaName,
            r.Feedback,
            r.Comment,
            r.DateSubmitted,
            r.IsActive
     FROM review r
     JOIN area a ON a.AreaID = r.AreaID
     WHERE r.ReviewID = ? AND r.VisitorID = ?`,
    [result.insertId, VisitorID]
  );
  return rows[0] || null;
}

async function updateReviewForVisitor(VisitorID, ReviewID, { AreaID, Feedback, Comment, IsActive }) {
  const [result] = await pool.execute(
    `UPDATE review
     SET AreaID = ?, Feedback = ?, Comment = ?, IsActive = ?
     WHERE ReviewID = ? AND VisitorID = ?`,
    [AreaID, Feedback, Comment || null, IsActive ? 1 : 0, ReviewID, VisitorID]
  );
  return result.affectedRows > 0;
}

async function deleteReviewForVisitor(VisitorID, ReviewID) {
  const [result] = await pool.execute(
    `DELETE FROM review WHERE ReviewID = ? AND VisitorID = ?`,
    [ReviewID, VisitorID]
  );
  return result.affectedRows > 0;
}

async function listChildren(VisitorID) {
  const [rows] = await pool.execute(
    `SELECT ChildID, GuardianID, Name, Age, Gender
     FROM child
     WHERE GuardianID = ?
     ORDER BY ChildID DESC`,
    [VisitorID]
  );
  return rows;
}

async function createChild(VisitorID, { Name, Age, Gender }) {
  const [result] = await pool.execute(
    `INSERT INTO child (GuardianID, Name, Age, Gender)
     VALUES (?, ?, ?, ?)`,
    [VisitorID, Name, Age || null, Gender || null]
  );
  const [rows] = await pool.execute(
    `SELECT ChildID, GuardianID, Name, Age, Gender
     FROM child
     WHERE ChildID = ? AND GuardianID = ?`,
    [result.insertId, VisitorID]
  );
  return rows[0] || null;
}

async function updateChildForVisitor(VisitorID, ChildID, { Name, Age, Gender }) {
  const [result] = await pool.execute(
    `UPDATE child
     SET Name = ?, Age = ?, Gender = ?
     WHERE ChildID = ? AND GuardianID = ?`,
    [Name, Age || null, Gender || null, ChildID, VisitorID]
  );
  return result.affectedRows > 0;
}

async function deleteChildForVisitor(VisitorID, ChildID) {
  const [result] = await pool.execute(
    `DELETE FROM child WHERE ChildID = ? AND GuardianID = ?`,
    [ChildID, VisitorID]
  );
  return result.affectedRows > 0;
}

// =========================
// Queries & Reports (API)
// =========================

async function listExpiredTicketsForVisitor(VisitorID) {
  // Uses a view so your professor can see the “query layer” clearly.
  const [rows] = await pool.execute(
    `SELECT TicketNumber, TicketType, Price, IssueDate, ExpiryDate, IsActive
     FROM v_visitor_expired_tickets
     WHERE VisitorID = ? AND IsExpired = 1
     ORDER BY ExpiryDate DESC, TicketNumber DESC`,
    [VisitorID]
  );
  return rows;
}

async function ticketSalesSummaryForVisitor(VisitorID) {
  const [rows] = await pool.execute(
    `SELECT TicketType,
            COUNT(*) AS TicketCount,
            SUM(Price) AS TotalRevenue,
            AVG(Price) AS AvgPrice
     FROM ticket
     WHERE VisitorID = ? AND IsActive = 1
     GROUP BY TicketType
     ORDER BY TicketType`,
    [VisitorID]
  );
  return rows;
}

async function averageRatingsPerAreaGlobal() {
  const [rows] = await pool.execute(
    `SELECT AreaID, AreaName, AvgRating, ReviewCount
     FROM v_area_avg_ratings
     WHERE ReviewCount > 0
     ORDER BY AvgRating DESC, AreaID`,
  );
  return rows;
}

async function visitorDemographicsGlobal() {
  const [byGender] = await pool.execute(
    `SELECT Gender,
            COUNT(*) AS VisitorCount
     FROM visitor
     WHERE IsActive = 1
     GROUP BY Gender
     ORDER BY VisitorCount DESC`
  );

  const [byAgeGroup] = await pool.execute(
    `SELECT
        CASE
          WHEN Age IS NULL THEN 'Unknown'
          WHEN Age < 18 THEN '<18'
          WHEN Age BETWEEN 18 AND 29 THEN '18-29'
          WHEN Age BETWEEN 30 AND 44 THEN '30-44'
          WHEN Age BETWEEN 45 AND 64 THEN '45-64'
          ELSE '65+'
        END AS AgeGroup,
        COUNT(*) AS VisitorCount
     FROM visitor
     WHERE IsActive = 1
     GROUP BY AgeGroup
     ORDER BY
       CASE AgeGroup
         WHEN 'Unknown' THEN 0
         WHEN '<18' THEN 1
         WHEN '18-29' THEN 2
         WHEN '30-44' THEN 3
         WHEN '45-64' THEN 4
         ELSE 5
       END`
  );

  return { byGender, byAgeGroup };
}

async function mostPopularAreasByReviews() {
  const [rows] = await pool.execute(
    `SELECT
        a.AreaID,
        a.AreaName,
        COUNT(r.ReviewID) AS ReviewCount,
        ROUND(AVG(r.Feedback), 2) AS AvgRating
     FROM area a
     LEFT JOIN review r
       ON r.AreaID = a.AreaID
       AND r.IsActive = 1
     GROUP BY a.AreaID, a.AreaName
     ORDER BY ReviewCount DESC, AvgRating DESC, a.AreaID`
  );
  return rows;
}

async function visitorTotalSpentReport(VisitorID) {
  const [mineRows] = await pool.execute(
    `SELECT
        ? AS VisitorID,
        COUNT(*) AS TicketCount,
        COALESCE(SUM(Price), 0) AS TotalSpent,
        ROUND(COALESCE(AVG(Price), 0), 2) AS AvgTicketPrice
     FROM ticket
     WHERE VisitorID = ? AND IsActive = 1`,
    [VisitorID, VisitorID]
  );

  const [globalRows] = await pool.execute(
    `SELECT
        COUNT(DISTINCT VisitorID) AS TotalVisitorsWithTickets,
        COUNT(*) AS TotalActiveTickets,
        COALESCE(SUM(Price), 0) AS GlobalTotalSpent
     FROM ticket
     WHERE IsActive = 1`
  );

  return {
    mine: mineRows[0] || { VisitorID, TicketCount: 0, TotalSpent: 0, AvgTicketPrice: 0 },
    global: globalRows[0] || { TotalVisitorsWithTickets: 0, TotalActiveTickets: 0, GlobalTotalSpent: 0 },
  };
}

module.exports = {
  computeTicketPurchaseExpiryDate,
  ensureVisitorPortalSchema,
  createVisitor,
  getVisitorByEmail,
  getVisitorById,
  updateVisitorProfile,
  addVisitHistory,
  listVisitHistory,
  listAreas,
  listParks,
  listAttractionsWithDetails,
  listSpecialEvents,
  listDiningOptions,
  listMerchandiseOptions,

  listTicketsForVisitor,
  createTicket,
  purchaseTicketForVisitor,
  updateTicketForVisitor,
  deleteTicketForVisitor,
  createReservationForVisitor,
  listReservationsForVisitor,
  updateReservationForVisitor,
  createItineraryItem,
  listItineraryItems,
  deleteItineraryItem,
  createFeedbackSubmission,
  listFeedbackSubmissions,
  createDiningOrder,
  createMerchOrder,
  listOrdersForVisitor,
  listOrderItems,

  listReviewsForVisitor,
  createReview,
  updateReviewForVisitor,
  deleteReviewForVisitor,

  listChildren,
  createChild,
  updateChildForVisitor,
  deleteChildForVisitor,

  listExpiredTicketsForVisitor,
  ticketSalesSummaryForVisitor,
  averageRatingsPerAreaGlobal,
  visitorDemographicsGlobal,
  mostPopularAreasByReviews,
  visitorTotalSpentReport,
};

