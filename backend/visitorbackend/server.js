const http = require("http");
const path = require("path");
const fs = require("fs");
const url = require("url");

const pool = require("./db");
const {
  pbkdf2Hash,
  pbkdf2Verify,
  createJwt,
  verifyJwt,
} = require("./auth");
const {
  sendJson,
  sendText,
  readJson,
  normalizeEnumTicketType,
  normalizeDiscountFor,
} = require("./utils");
const q = require("./queries");

const repoRoot = path.resolve(__dirname, "..", "..");
const visitorFrontendDir = path.join(repoRoot, "frontend", "visitorfrontend");
const assetsDir = path.join(repoRoot, "assets");

const PORT = process.env.PORT
  ? Number(process.env.PORT)
  : process.env.VISITOR_PORT
  ? Number(process.env.VISITOR_PORT)
  : 3002;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const ALLOWED_ORIGIN = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "*";
const RESERVED_VISITOR_EMAIL_TERMS = ["admin", "manager", "employee"];

function containsReservedVisitorEmailTerm(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return RESERVED_VISITOR_EMAIL_TERMS.some((term) => normalized.includes(term));
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

function authFromRequest(req) {
  const header = req.headers["authorization"] || "";
  const m = String(header).match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  return verifyJwt(m[1], JWT_SECRET);
}

async function requireVisitor(req, res) {
  const payload = authFromRequest(req);
  if (!payload || typeof payload.sub !== "number") {
    sendJson(res, 401, { error: "Unauthorized" });
    return null;
  }

  const visitor = await q.getVisitorById(payload.sub);
  if (!visitor || visitor.IsActive !== 1) {
    sendJson(res, 401, { error: "Unauthorized" });
    return null;
  }
  return visitor;
}

function serveFile(res, filePath) {
  const resolved = path.resolve(filePath);
  const allowedA = path.resolve(assetsDir);
  const allowedB = path.resolve(visitorFrontendDir);
  const resolvedLower = resolved.toLowerCase();
  const allowedALower = allowedA.toLowerCase();
  const allowedBLower = allowedB.toLowerCase();
  if (!resolvedLower.startsWith(allowedALower) && !resolvedLower.startsWith(allowedBLower)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      sendText(res, 404, "Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": getContentType(resolved) });
    res.end(data);
  });
}

async function handleApi(req, res, method, pathname, query) {
  // Health check
  if (method === "GET" && pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  // Public endpoints
  if (pathname === "/api/visitor/register" && method === "POST") {
    const body = await readJson(req);
    if (!body || !body.Name || !body.Email || !body.Password) {
      sendJson(res, 400, { error: "Missing required fields: Name, Email, Password" });
      return true;
    }
    const email = String(body.Email).trim().toLowerCase();
    if (containsReservedVisitorEmailTerm(email)) {
      sendJson(res, 400, { error: "Visitor email cannot contain admin, manager, or employee." });
      return true;
    }

    const PasswordHash = pbkdf2Hash(body.Password);
    try {
      const { VisitorID } = await q.createVisitor({
        Name: String(body.Name).trim(),
        Phone: body.Phone ? String(body.Phone).trim() : null,
        Email: email,
        PasswordHash,
        Gender: body.Gender || null,
        Age: body.Age === "" || body.Age == null ? null : Number(body.Age),
      });

      const token = createJwt({ sub: VisitorID, email }, JWT_SECRET);
      sendJson(res, 201, { token });
    } catch (err) {
      if (String(err && err.code).startsWith("ER_DUP_ENTRY")) {
        sendJson(res, 409, { error: "Email already registered" });
      } else {
        sendJson(res, 500, { error: "Failed to register visitor" });
      }
    }
    return true;
  }

  if (pathname === "/api/visitor/login" && method === "POST") {
    const body = await readJson(req);
    if (!body || !body.Email || !body.Password) {
      sendJson(res, 400, { error: "Missing required fields: Email, Password" });
      return true;
    }

    const email = String(body.Email).trim().toLowerCase();
    if (containsReservedVisitorEmailTerm(email)) {
      sendJson(res, 400, { error: "Visitor email cannot contain admin, manager, or employee." });
      return true;
    }
    const visitor = await q.getVisitorByEmail(email);
    if (!visitor || visitor.IsActive !== 1) {
      sendJson(res, 401, { error: "Invalid email or password" });
      return true;
    }

    const ok = pbkdf2Verify(body.Password, visitor.PasswordHash);
    if (!ok) {
      sendJson(res, 401, { error: "Invalid email or password" });
      return true;
    }

    const token = createJwt({ sub: visitor.VisitorID, email: visitor.Email }, JWT_SECRET);
    sendJson(res, 200, { token, visitor: { VisitorID: visitor.VisitorID, Name: visitor.Name, Email: visitor.Email } });
    return true;
  }

  if (pathname === "/api/areas" && method === "GET") {
    const areas = await q.listAreas();
    sendJson(res, 200, areas);
    return true;
  }

  if (pathname === "/api/parks" && method === "GET") {
    const parks = await q.listParks();
    sendJson(res, 200, parks);
    return true;
  }

  if (pathname === "/api/attractions" && method === "GET") {
    const attractions = await q.listAttractionsWithDetails();
    sendJson(res, 200, attractions);
    return true;
  }

  if (pathname === "/api/events" && method === "GET") {
    const events = await q.listSpecialEvents();
    sendJson(res, 200, events);
    return true;
  }

  if (pathname === "/api/dining" && method === "GET") {
    const dining = await q.listDiningOptions();
    sendJson(res, 200, dining);
    return true;
  }

  if (pathname === "/api/merchandise" && method === "GET") {
    const merch = await q.listMerchandiseOptions();
    sendJson(res, 200, merch);
    return true;
  }

  // Auth-required endpoints
  const visitor = await requireVisitor(req, res);
  if (!visitor) return true;

  if (pathname === "/api/visitor/me" && method === "GET") {
    sendJson(res, 200, visitor);
    return true;
  }

  if (pathname === "/api/visitor/profile" && method === "PUT") {
    const body = await readJson(req);
    if (!body || !body.Name) {
      sendJson(res, 400, { error: "Name is required" });
      return true;
    }
    const ok = await q.updateVisitorProfile(visitor.VisitorID, {
      Name: String(body.Name).trim(),
      Phone: body.Phone ? String(body.Phone).trim() : null,
      Gender: body.Gender || null,
      Age: body.Age == null || body.Age === "" ? null : Number(body.Age),
    });
    if (!ok) return sendJson(res, 404, { error: "Profile not found" });
    await q.addVisitHistory(visitor.VisitorID, "ProfileUpdate", "Updated account profile details");
    const updated = await q.getVisitorById(visitor.VisitorID);
    sendJson(res, 200, updated);
    return true;
  }

  if (pathname === "/api/visitor/visit-history" && method === "GET") {
    const history = await q.listVisitHistory(visitor.VisitorID);
    sendJson(res, 200, history);
    return true;
  }

  // Tickets CRUD
  if (pathname === "/api/tickets" && method === "GET") {
    const ticketType = query.get("type") || null;
    const includeInactive = String(query.get("includeInactive") || "").toLowerCase() === "true";
    const tickets = await q.listTicketsForVisitor(visitor.VisitorID, {
      ticketType: ticketType ? normalizeEnumTicketType(ticketType) : null,
      includeInactive,
    });
    sendJson(res, 200, tickets);
    return true;
  }

  if (pathname === "/api/tickets" && method === "POST") {
    const body = await readJson(req);
    const ticketType = normalizeEnumTicketType(body && body.TicketType);
    const discountFor = normalizeDiscountFor(body && body.DiscountFor);
    if (!ticketType || body.Price == null || !body.ExpiryDate) {
      sendJson(res, 400, { error: "TicketType, Price, ExpiryDate are required" });
      return true;
    }
    if (discountFor == null) return sendJson(res, 400, { error: "DiscountFor must be None, Child, Senior, or Veteran" });
    if (ticketType !== "Discount" && discountFor !== "None") {
      return sendJson(res, 400, { error: "DiscountFor applies only when TicketType is Discount" });
    }
    if (ticketType === "Discount" && discountFor === "None") {
      return sendJson(res, 400, { error: "Discount ticket requires DiscountFor: Child, Senior, or Veteran" });
    }
    const Price = Number(body.Price);
    const ExpiryDate = String(body.ExpiryDate);
    const created = await q.createTicket(visitor.VisitorID, {
      TicketType: ticketType,
      DiscountFor: discountFor,
      Price,
      ExpiryDate,
    });
    sendJson(res, 201, created);
    return true;
  }

  if (pathname === "/api/tickets/purchase" && method === "POST") {
    const body = await readJson(req);
    if (!body || !body.TicketPlan || !body.TicketCategory) {
      sendJson(res, 400, { error: "TicketPlan, TicketCategory are required" });
      return true;
    }
    const plan = String(body.TicketPlan);
    const visitDate = body.VisitDate != null && body.VisitDate !== "" ? String(body.VisitDate).slice(0, 10) : null;
    if (plan !== "SeasonPass" && !visitDate) {
      sendJson(res, 400, { error: "VisitDate is required for single-day and multi-day tickets" });
      return true;
    }
    const ExpiryDate = q.computeTicketPurchaseExpiryDate({
      TicketPlan: plan,
      VisitDate: visitDate,
      MultiDayCount: body.MultiDayCount,
    });
    if (!ExpiryDate) {
      sendJson(res, 400, { error: "Could not compute ticket expiry; check VisitDate" });
      return true;
    }
    const created = await q.purchaseTicketForVisitor(visitor.VisitorID, {
      TicketPlan: plan,
      TicketCategory: String(body.TicketCategory),
      ExpiryDate,
      PaymentMethod: body.PaymentMethod ? String(body.PaymentMethod) : null,
    });
    sendJson(res, 201, created);
    return true;
  }

  const ticketMatch = pathname.match(/^\/api\/tickets\/(\d+)$/);
  if (ticketMatch) {
    const TicketNumber = Number(ticketMatch[1]);
    if (method === "PUT") {
      const body = await readJson(req);
      const ticketType = normalizeEnumTicketType(body && body.TicketType);
      const discountFor = normalizeDiscountFor(body && body.DiscountFor);
      const Price = Number(body.Price);
      const ExpiryDate = String(body.ExpiryDate);
      if (!ticketType) return sendJson(res, 400, { error: "TicketType is required" });
      if (discountFor == null) return sendJson(res, 400, { error: "DiscountFor must be None, Child, Senior, or Veteran" });
      if (ticketType !== "Discount" && discountFor !== "None") {
        return sendJson(res, 400, { error: "DiscountFor applies only when TicketType is Discount" });
      }
      if (ticketType === "Discount" && discountFor === "None") {
        return sendJson(res, 400, { error: "Discount ticket requires DiscountFor: Child, Senior, or Veteran" });
      }

      const ok = await q.updateTicketForVisitor(visitor.VisitorID, TicketNumber, {
        TicketType: ticketType,
        DiscountFor: discountFor,
        Price,
        ExpiryDate,
      });
      if (!ok) return sendJson(res, 404, { error: "Ticket not found" });
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (method === "DELETE") {
      const ok = await q.deleteTicketForVisitor(visitor.VisitorID, TicketNumber);
      if (!ok) return sendJson(res, 404, { error: "Ticket not found" });
      sendJson(res, 200, { ok: true });
      return true;
    }
  }

  if (pathname === "/api/reservations" && method === "GET") {
    const reservations = await q.listReservationsForVisitor(visitor.VisitorID);
    sendJson(res, 200, reservations);
    return true;
  }

  if (pathname === "/api/reservations" && method === "POST") {
    const body = await readJson(req);
    if (!body || !body.ReservationType || !body.ReservationDate || !body.TimeSlot) {
      sendJson(res, 400, { error: "ReservationType, ReservationDate, TimeSlot are required" });
      return true;
    }
    const id = await q.createReservationForVisitor(visitor.VisitorID, {
      ReservationType: String(body.ReservationType),
      AttractionID: body.AttractionID ? Number(body.AttractionID) : null,
      DiningID: body.DiningID ? Number(body.DiningID) : null,
      ReservationDate: String(body.ReservationDate),
      TimeSlot: String(body.TimeSlot),
      PartySize: body.PartySize ? Number(body.PartySize) : 1,
      Notes: body.Notes || null,
    });
    sendJson(res, 201, { ReservationID: id });
    return true;
  }

  const reservationMatch = pathname.match(/^\/api\/reservations\/(\d+)$/);
  if (reservationMatch && method === "PUT") {
    const ReservationID = Number(reservationMatch[1]);
    const body = await readJson(req);
    if (!body || !body.ReservationDate || !body.TimeSlot || !body.Status) {
      sendJson(res, 400, { error: "ReservationDate, TimeSlot, Status are required" });
      return true;
    }
    const ok = await q.updateReservationForVisitor(visitor.VisitorID, ReservationID, {
      ReservationDate: String(body.ReservationDate),
      TimeSlot: String(body.TimeSlot),
      PartySize: body.PartySize ? Number(body.PartySize) : 1,
      Status: String(body.Status),
      Notes: body.Notes || null,
    });
    if (!ok) return sendJson(res, 404, { error: "Reservation not found" });
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (pathname === "/api/itinerary" && method === "GET") {
    const items = await q.listItineraryItems(visitor.VisitorID);
    sendJson(res, 200, items);
    return true;
  }

  if (pathname === "/api/itinerary" && method === "POST") {
    const body = await readJson(req);
    const id = await q.createItineraryItem(visitor.VisitorID, {
      AttractionID: body && body.AttractionID ? Number(body.AttractionID) : null,
      ParkID: body && body.ParkID ? Number(body.ParkID) : null,
      PlannedDate: body && body.PlannedDate ? String(body.PlannedDate) : null,
      ItemType: body && body.ItemType ? String(body.ItemType) : "Wishlist",
      Notes: body && body.Notes ? String(body.Notes) : null,
    });
    sendJson(res, 201, { ItineraryID: id });
    return true;
  }

  const itineraryMatch = pathname.match(/^\/api\/itinerary\/(\d+)$/);
  if (itineraryMatch && method === "DELETE") {
    const ok = await q.deleteItineraryItem(visitor.VisitorID, Number(itineraryMatch[1]));
    if (!ok) return sendJson(res, 404, { error: "Itinerary item not found" });
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (pathname === "/api/orders" && method === "GET") {
    const orders = await q.listOrdersForVisitor(visitor.VisitorID);
    sendJson(res, 200, orders);
    return true;
  }

  const orderItemsMatch = pathname.match(/^\/api\/orders\/(\d+)\/items$/);
  if (orderItemsMatch && method === "GET") {
    const rows = await q.listOrderItems(Number(orderItemsMatch[1]), visitor.VisitorID);
    sendJson(res, 200, rows);
    return true;
  }

  if (pathname === "/api/orders/dining" && method === "POST") {
    const body = await readJson(req);
    if (!body || !body.DiningID || body.UnitPrice == null) {
      sendJson(res, 400, { error: "DiningID and UnitPrice are required" });
      return true;
    }
    const orderId = await q.createDiningOrder(visitor.VisitorID, {
      DiningID: Number(body.DiningID),
      Quantity: body.Quantity ? Number(body.Quantity) : 1,
      UnitPrice: Number(body.UnitPrice),
      PromoCode: body.PromoCode || null,
      PaymentMethod: body.PaymentMethod || null,
    });
    sendJson(res, 201, { OrderID: orderId });
    return true;
  }

  if (pathname === "/api/orders/merchandise" && method === "POST") {
    const body = await readJson(req);
    if (!body || !body.ItemID) {
      sendJson(res, 400, { error: "ItemID is required" });
      return true;
    }
    const orderId = await q.createMerchOrder(visitor.VisitorID, {
      ItemID: Number(body.ItemID),
      Quantity: body.Quantity ? Number(body.Quantity) : 1,
      PromoCode: body.PromoCode || null,
      PaymentMethod: body.PaymentMethod || null,
    });
    if (!orderId) return sendJson(res, 404, { error: "Merchandise item not found" });
    sendJson(res, 201, { OrderID: orderId });
    return true;
  }

  if (pathname === "/api/feedback-submissions" && method === "GET") {
    const rows = await q.listFeedbackSubmissions(visitor.VisitorID);
    sendJson(res, 200, rows);
    return true;
  }

  if (pathname === "/api/feedback-submissions" && method === "POST") {
    const body = await readJson(req);
    if (!body || !String(body.Message ?? "").trim()) {
      sendJson(res, 400, { error: "Message is required" });
      return true;
    }
    try {
      const id = await q.createFeedbackSubmission(visitor.VisitorID, {
        AttractionID: body.AttractionID ? Number(body.AttractionID) : null,
        Rating: body.Rating,
        FeedbackType: body.FeedbackType || "General",
        Message: String(body.Message),
      });
      sendJson(res, 201, { FeedbackID: id });
    } catch (err) {
      if (err && err.code === "INVALID_RATING") {
        sendJson(res, 400, { error: err.message || "Invalid rating" });
      } else if (err && err.code === "MESSAGE_REQUIRED") {
        sendJson(res, 400, { error: err.message || "Message is required" });
      } else if (err && err.code === "NO_AREA") {
        sendJson(res, 500, { error: err.message || "Server misconfiguration" });
      } else {
        console.error(err);
        sendJson(res, 500, { error: "Could not save feedback" });
      }
    }
    return true;
  }

  // Reviews CRUD
  if (pathname === "/api/reviews" && method === "GET") {
    const areaId = query.get("areaId") ? Number(query.get("areaId")) : null;
    const minRating = query.get("minRating") != null ? Number(query.get("minRating")) : null;
    const maxRating = query.get("maxRating") != null ? Number(query.get("maxRating")) : null;
    const includeInactive = String(query.get("includeInactive") || "").toLowerCase() === "true";
    const reviews = await q.listReviewsForVisitor(visitor.VisitorID, { areaId, minRating, maxRating, includeInactive });
    sendJson(res, 200, reviews);
    return true;
  }

  if (pathname === "/api/reviews" && method === "POST") {
    const body = await readJson(req);
    const AreaID = Number(body.AreaID);
    const Feedback = Number(body.Feedback);
    if (!AreaID || !Feedback) {
      sendJson(res, 400, { error: "AreaID and Feedback are required" });
      return true;
    }

    const created = await q.createReview(visitor.VisitorID, {
      AreaID,
      Feedback,
      Comment: body.Comment || null,
      IsActive: body.IsActive == null ? 1 : Boolean(Number(body.IsActive)),
    });
    sendJson(res, 201, created);
    return true;
  }

  const reviewMatch = pathname.match(/^\/api\/reviews\/(\d+)$/);
  if (reviewMatch) {
    const ReviewID = Number(reviewMatch[1]);
    if (method === "PUT") {
      const body = await readJson(req);
      const AreaID = Number(body.AreaID);
      const Feedback = Number(body.Feedback);
      const ok = await q.updateReviewForVisitor(visitor.VisitorID, ReviewID, {
        AreaID,
        Feedback,
        Comment: body.Comment || null,
        IsActive: body.IsActive == null ? 1 : Boolean(Number(body.IsActive)),
      });
      if (!ok) return sendJson(res, 404, { error: "Review not found" });
      sendJson(res, 200, { ok: true });
      return true;
    }
    if (method === "DELETE") {
      const ok = await q.deleteReviewForVisitor(visitor.VisitorID, ReviewID);
      if (!ok) return sendJson(res, 404, { error: "Review not found" });
      sendJson(res, 200, { ok: true });
      return true;
    }
  }

  // Children CRUD
  if (pathname === "/api/children" && method === "GET") {
    const kids = await q.listChildren(visitor.VisitorID);
    sendJson(res, 200, kids);
    return true;
  }

  if (pathname === "/api/children" && method === "POST") {
    const body = await readJson(req);
    if (!body.Name) return sendJson(res, 400, { error: "Name is required" });

    const created = await q.createChild(visitor.VisitorID, {
      Name: String(body.Name),
      Age: body.Age == null || body.Age === "" ? null : Number(body.Age),
      Gender: body.Gender || null,
    });
    sendJson(res, 201, created);
    return true;
  }

  const childMatch = pathname.match(/^\/api\/children\/(\d+)$/);
  if (childMatch) {
    const ChildID = Number(childMatch[1]);
    if (method === "PUT") {
      const body = await readJson(req);
      const ok = await q.updateChildForVisitor(visitor.VisitorID, ChildID, {
        Name: String(body.Name || ""),
        Age: body.Age == null || body.Age === "" ? null : Number(body.Age),
        Gender: body.Gender || null,
      });
      if (!ok) return sendJson(res, 404, { error: "Child not found" });
      sendJson(res, 200, { ok: true });
      return true;
    }
    if (method === "DELETE") {
      const ok = await q.deleteChildForVisitor(visitor.VisitorID, ChildID);
      if (!ok) return sendJson(res, 404, { error: "Child not found" });
      sendJson(res, 200, { ok: true });
      return true;
    }
  }

  // Queries
  if (pathname === "/api/queries/expired-tickets" && method === "GET") {
    const tickets = await q.listExpiredTicketsForVisitor(visitor.VisitorID);
    sendJson(res, 200, tickets);
    return true;
  }

  if (pathname === "/api/queries/tickets-by-type" && method === "GET") {
    const type = normalizeEnumTicketType(query.get("type"));
    if (!type) return sendJson(res, 400, { error: "type must be Basic, Membership, or Discount" });
    const tickets = await q.listTicketsForVisitor(visitor.VisitorID, { ticketType: type, includeInactive: true });
    sendJson(res, 200, tickets);
    return true;
  }

  if (pathname === "/api/queries/reviews-filter" && method === "GET") {
    const areaId = query.get("areaId") ? Number(query.get("areaId")) : null;
    const minRating = query.get("minRating") != null ? Number(query.get("minRating")) : null;
    const maxRating = query.get("maxRating") != null ? Number(query.get("maxRating")) : null;
    const reviews = await q.listReviewsForVisitor(visitor.VisitorID, { areaId, minRating, maxRating, includeInactive: true });
    sendJson(res, 200, reviews);
    return true;
  }

  // Reports
  if (pathname === "/api/reports/ticket-sales-summary" && method === "GET") {
    const rows = await q.ticketSalesSummaryForVisitor(visitor.VisitorID);
    sendJson(res, 200, rows);
    return true;
  }

  if (pathname === "/api/reports/average-ratings-per-area" && method === "GET") {
    const rows = await q.averageRatingsPerAreaGlobal();
    sendJson(res, 200, rows);
    return true;
  }

  if (pathname === "/api/reports/visitor-demographics" && method === "GET") {
    const rows = await q.visitorDemographicsGlobal();
    sendJson(res, 200, rows);
    return true;
  }

  if (pathname === "/api/reports/most-popular-areas" && method === "GET") {
    const rows = await q.mostPopularAreasByReviews();
    sendJson(res, 200, rows);
    return true;
  }

  if (pathname === "/api/reports/visitor-total-spent" && method === "GET") {
    const rows = await q.visitorTotalSpentReport(visitor.VisitorID);
    sendJson(res, 200, rows);
    return true;
  }

  sendJson(res, 404, { error: "Not found" });
  return true;
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    });
    res.end();
    return;
  }

  const parsed = url.parse(req.url || "", true);
  const pathname = parsed.pathname || "/";
  const query = parsed.query || {};
  const queryObj = new URLSearchParams(query);

  // API handling
  if (pathname.startsWith("/api/") || pathname === "/api/health") {
    try {
      const handled = await handleApi(req, res, req.method, pathname, queryObj);
      if (handled) return;
    } catch (err) {
      sendJson(res, 500, { error: "Server error" });
      return;
    }
  }

  // Static assets: /assets/*
  if (pathname.startsWith("/assets/")) {
    const rel = pathname.replace(/^\/assets\//, "");
    serveFile(res, path.join(assetsDir, rel));
    return;
  }

  // Static frontend
  let filePath = visitorFrontendDir;
  if (pathname === "/" || pathname === "") filePath = path.join(visitorFrontendDir, "index.html");
  else filePath = path.join(visitorFrontendDir, pathname.replace(/^\//, ""));

  // If the route doesn't exist, fall back to index.html for single-page-ish behavior.
  fs.stat(filePath, (err) => {
    if (err) {
      serveFile(res, path.join(visitorFrontendDir, "index.html"));
      return;
    }
    serveFile(res, filePath);
  });
});

async function start() {
  await q.ensureVisitorPortalSchema();
  server.listen(PORT, () => {
    console.log(`Visitor portal server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start visitor portal:", err);
  process.exit(1);
});

