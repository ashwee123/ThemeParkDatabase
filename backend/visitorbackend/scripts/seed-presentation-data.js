/**
 * Presentation/demo seed for the visitor portal DB.
 *
 * Moderate volume: enough for reports & queries, not a huge dataset.
 *
 * Prereqs (MySQL):
 *   - Base schema + `sql files/visitor_ticket_type_migration.sql`
 *   - `sql files/visitor_views_and_triggers.sql`
 *   - Rows in `area` (default dump: 1, 101, 102, 103)
 *
 * From `backend/visitorbackend`:
 *   node scripts/seed-presentation-data.js
 *
 * Demo logins: emails *@presentation-demo.local — password: Demo1234!
 * (Script deletes prior *@presentation-demo.local visitors first; CASCADE removes their tickets/reviews/children.)
 */

const pool = require("../db");
const { pbkdf2Hash } = require("../auth");

const DEMO_TAG = "@presentation-demo.local";
const DEMO_PASSWORD = "Demo1234!";

const AREA_IDS = [1, 101, 102, 103];

/** @type {Array<{ name: string; email: string; phone: string | null; gender: string; age: number | null }>} */
const VISITORS = [
  { name: "Morgan Lee", email: `morgan${DEMO_TAG}`, phone: "555-1001", gender: "Female", age: 29 },
  { name: "Jordan Kim", email: `jordan${DEMO_TAG}`, phone: "555-1002", gender: "Male", age: 41 },
  { name: "Riley Chen", email: `riley${DEMO_TAG}`, phone: "555-1003", gender: "Other", age: 22 },
  { name: "Casey Nova", email: `casey${DEMO_TAG}`, phone: null, gender: "Prefer not to say", age: null },
  { name: "Sam Patel", email: `sam${DEMO_TAG}`, phone: "555-1005", gender: "Male", age: 54 },
  { name: "Taylor Brooks", email: `taylor${DEMO_TAG}`, phone: "555-1006", gender: "Female", age: 17 },
  { name: "Jamie Ortiz", email: `jamie${DEMO_TAG}`, phone: "555-1007", gender: "Female", age: 63 },
  { name: "Alex Rivera", email: `alex${DEMO_TAG}`, phone: "555-1008", gender: "Male", age: 35 },
];

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [del] = await conn.query(`DELETE FROM visitor WHERE Email LIKE ?`, [`%${DEMO_TAG}`]);
    console.log(`Cleared old demo visitors (if any). affectedRows=${del.affectedRows ?? 0}`);

    const visitorIds = [];
    for (const v of VISITORS) {
      const hash = pbkdf2Hash(DEMO_PASSWORD);
      const [res] = await conn.execute(
        `INSERT INTO visitor (Name, Phone, Email, PasswordHash, Gender, Age, IsActive)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [v.name, v.phone, v.email, hash, v.gender, v.age]
      );
      visitorIds.push(res.insertId);
    }
    console.log(`Inserted ${visitorIds.length} visitors.`);

    const today = new Date();
    const ticketPlans = [
      [
        { type: "Basic", discount: "None", price: 79.99, issue: -40, expiry: -5, active: 0 },
        { type: "Membership", discount: "None", price: 199.0, issue: -10, expiry: 355, active: 1 },
        { type: "Discount", discount: "Senior", price: 49.5, issue: -2, expiry: 14, active: 1 },
      ],
      [
        { type: "Basic", discount: "None", price: 79.99, issue: -120, expiry: -30, active: 0 },
        { type: "Basic", discount: "None", price: 79.99, issue: -5, expiry: 25, active: 1 },
        { type: "Discount", discount: "Child", price: 39.0, issue: -1, expiry: 7, active: 1 },
        { type: "Membership", discount: "None", price: 199.0, issue: 0, expiry: 300, active: 1 },
      ],
      [
        { type: "Discount", discount: "Veteran", price: 44.0, issue: -60, expiry: -1, active: 0 },
        { type: "Basic", discount: "None", price: 89.99, issue: 0, expiry: 30, active: 1 },
      ],
      [
        { type: "Basic", discount: "None", price: 79.99, issue: -7, expiry: 21, active: 1 },
        { type: "Discount", discount: "Child", price: 39.0, issue: -7, expiry: 21, active: 1 },
      ],
      [
        { type: "Membership", discount: "None", price: 199.0, issue: -200, expiry: -10, active: 0 },
        { type: "Basic", discount: "None", price: 79.99, issue: -3, expiry: 60, active: 1 },
      ],
      [{ type: "Basic", discount: "None", price: 79.99, issue: 0, expiry: 10, active: 1 }],
      [
        { type: "Basic", discount: "None", price: 79.99, issue: -90, expiry: -20, active: 0 },
        { type: "Membership", discount: "None", price: 199.0, issue: -1, expiry: 364, active: 1 },
      ],
      [
        { type: "Basic", discount: "None", price: 99.0, issue: -14, expiry: 45, active: 1 },
        { type: "Discount", discount: "Senior", price: 49.5, issue: -14, expiry: 45, active: 1 },
        { type: "Basic", discount: "None", price: 79.99, issue: -14, expiry: 5, active: 1 },
      ],
    ];

    let ticketCount = 0;
    for (let i = 0; i < visitorIds.length; i++) {
      const vid = visitorIds[i];
      const plans = ticketPlans[i] || [
        { type: "Basic", discount: "None", price: 79.99, issue: -1, expiry: 30, active: 1 },
      ];
      for (const p of plans) {
        const issue = isoDate(addDays(today, p.issue));
        const expiry = isoDate(addDays(today, p.expiry));
        await conn.execute(
          `INSERT INTO ticket (TicketType, DiscountFor, Price, IssueDate, ExpiryDate, VisitorID, IsActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [p.type, p.discount, p.price, issue, expiry, vid, p.active]
        );
        ticketCount++;
      }
    }
    console.log(`Inserted ${ticketCount} tickets.`);

    // Reviews: spread across areas; varied ratings 1–10 and dates
    const reviewSpecs = [
      { vi: 0, area: 1, feedback: 8, daysAgo: 2, comment: "Great atmosphere today." },
      { vi: 0, area: 101, feedback: 6, daysAgo: 10, comment: "Queues were long." },
      { vi: 1, area: 101, feedback: 9, daysAgo: 1, comment: "Loved the rides." },
      { vi: 1, area: 102, feedback: 7, daysAgo: 4, comment: "Food was solid." },
      { vi: 2, area: 102, feedback: 10, daysAgo: 0, comment: "Best visit this year." },
      { vi: 2, area: 103, feedback: 4, daysAgo: 20, comment: "Kids area crowded." },
      { vi: 3, area: 1, feedback: 5, daysAgo: 7, comment: "Okay experience." },
      { vi: 4, area: 103, feedback: 9, daysAgo: 3, comment: "Staff were helpful." },
      { vi: 5, area: 101, feedback: 3, daysAgo: 14, comment: "Rain affected the day." },
      { vi: 6, area: 102, feedback: 8, daysAgo: 5, comment: "Good snacks." },
      { vi: 7, area: 1, feedback: 7, daysAgo: 6, comment: "Easy to navigate." },
      { vi: 7, area: 101, feedback: 8, daysAgo: 8, comment: "Would come again." },
    ];

    let reviewCount = 0;
    for (const r of reviewSpecs) {
      const vid = visitorIds[r.vi];
      const submitted = isoDate(addDays(today, -r.daysAgo));
      await conn.execute(
        `INSERT INTO review (VisitorID, AreaID, Feedback, Comment, DateSubmitted, IsActive)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [vid, r.area, r.feedback, r.comment, submitted]
      );
      reviewCount++;
    }
    console.log(`Inserted ${reviewCount} reviews.`);

    const childSpecs = [
      { vi: 1, name: "Sky Kim", age: 9, gender: "Female" },
      { vi: 1, name: "Bo Kim", age: 6, gender: "Male" },
      { vi: 4, name: "River Nova", age: 12, gender: "Other" },
      { vi: 5, name: "Quinn Patel", age: 14, gender: "Female" },
      { vi: 7, name: "Rio Rivera", age: 7, gender: "Male" },
    ];
    let childCount = 0;
    for (const c of childSpecs) {
      await conn.execute(
        `INSERT INTO child (GuardianID, Name, Age, Gender) VALUES (?, ?, ?, ?)`,
        [visitorIds[c.vi], c.name, c.age, c.gender]
      );
      childCount++;
    }
    console.log(`Inserted ${childCount} children.`);

    await conn.commit();
    console.log("\nDone. Log in to the visitor portal with any demo email above.");
    console.log(`Password for all: ${DEMO_PASSWORD}`);
  } catch (e) {
    await conn.rollback();
    console.error("Seed failed:", e.message);
    if (/Unknown column|DiscountFor|Basic/i.test(String(e.message))) {
      console.error(
        "\nHint: run `sql files/visitor_ticket_type_migration.sql` on your database so `ticket` matches the portal."
      );
    }
    throw e;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(() => process.exit(1));
