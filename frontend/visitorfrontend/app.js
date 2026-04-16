const API_BASE = "https://visitors-portal-backend.onrender.com";
const TOKEN_KEY = "token";
const state = {
  areas: [],
  parks: [],
  attractions: [],
  dining: [],
  merchandise: [],
};

function $(id) {
  return document.getElementById(id);
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function api(path, { method = "GET", body = null, token = null } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  const data = raw ? safeJson(raw) : null;
  if (!res.ok) {
    throw new Error((data && data.error) || res.statusText);
  }
  return data;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(v) {
  localStorage.setItem(TOKEN_KEY, v);
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function logoutVisitor() {
  clearToken();
  showStatus("Logged out successfully.");
  showAuth(true);
  $("visitorBadge").textContent = "Guest";
}

function showStatus(msg, isErr = false) {
  const el = $("globalStatus");
  el.textContent = msg;
  el.className = isErr ? "status error" : "status";
}

function setAuthMode(mode) {
  const isRegister = mode === "register";
  $("registerPanel").classList.toggle("hidden", !isRegister);
  $("btnShowLogin").classList.toggle("btn-primary", !isRegister);
  $("btnShowRegister").classList.toggle("btn-primary", isRegister);
}

function setTab(name) {
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  const panel = document.getElementById(`tab-${name}`);
  if (panel) panel.classList.remove("hidden");
}

function fillSelect(id, items, valueKey, labelKey, includeBlank = false) {
  const select = $(id);
  if (!select) return;
  select.innerHTML = includeBlank ? `<option value="">-- Select --</option>` : "";
  for (const item of items) {
    const opt = document.createElement("option");
    opt.value = item[valueKey];
    opt.textContent = item[labelKey];
    select.appendChild(opt);
  }
}

async function loadLookups(token) {
  const [areas, parks, attractions, dining, merchandise] = await Promise.all([
    api("/api/areas", { token }),
    api("/api/parks", { token }),
    api("/api/attractions", { token }),
    api("/api/dining", { token }),
    api("/api/merchandise", { token }),
  ]);
  state.areas = areas;
  state.parks = parks;
  state.attractions = attractions;
  state.dining = dining;
  state.merchandise = merchandise;

  fillSelect("itineraryAttraction", attractions, "AttractionID", "AttractionName", true);
  fillSelect("itineraryPark", parks, "ParkID", "ParkName", true);
  fillSelect("reservationAttraction", attractions, "AttractionID", "AttractionName", true);
  fillSelect("reservationDining", dining, "DiningID", "DiningName", true);
  fillSelect("feedbackAttraction", attractions, "AttractionID", "AttractionName", true);
  fillSelect("diningOrderDining", dining, "DiningID", "DiningName", false);
  fillSelect("merchOrderItem", merchandise, "ItemID", "ItemName", false);
}

function showAuth(isAuthView) {
  $("authSection").classList.toggle("hidden", !isAuthView);
  $("appSection").classList.toggle("hidden", isAuthView);
  $("btnLogout").classList.toggle("hidden", isAuthView);
  if (isAuthView) setAuthMode("login");
}

async function refreshProfile() {
  const token = getToken();
  const me = await api("/api/visitor/me", { token });
  $("visitorBadge").textContent = `${me.Name} (${me.Email})`;
  $("profileName").value = me.Name || "";
  $("profilePhone").value = me.Phone || "";
  $("profileGender").value = me.Gender || "";
  $("profileAge").value = me.Age == null ? "" : me.Age;
}

async function renderVisitHistory() {
  const rows = await api("/api/visitor/visit-history", { token: getToken() });
  $("visitHistoryList").innerHTML = rows
    .map((r) => `<li><strong>${r.ActivityType}</strong> - ${r.ActivitySummary} (${r.VisitDateTime})</li>`)
    .join("");
}

async function renderAttractions() {
  const rows = await api("/api/attractions", { token: getToken() });
  $("attractionsTbody").innerHTML = rows
    .map(
      (a) => `<tr>
      <td>${a.AttractionName}</td>
      <td>${a.Description || "-"}</td>
      <td>${a.HeightRequirementCm || "-"}</td>
      <td>${a.DurationMinutes || "-"}</td>
      <td>${a.ThrillLevel || "Medium"}</td>
      <td>${a.Status}</td>
      <td>${a.WaitTimeMinutes || 0} min</td>
    </tr>`
    )
    .join("");
}

async function renderParksAndEvents() {
  const [parks, events] = await Promise.all([api("/api/parks", { token: getToken() }), api("/api/events", { token: getToken() })]);
  $("parksList").innerHTML = parks
    .map((p) => `<li><strong>${p.ParkName}</strong> - ${p.LocationText || "N/A"} | ${p.OpeningTime || "?"} to ${p.ClosingTime || "?"}</li>`)
    .join("");
  $("eventsList").innerHTML = events
    .map((e) => `<li><strong>${e.EventName}</strong> (${e.EventDate}) ${e.StartTime || ""}-${e.EndTime || ""} - ${e.EventDescription || ""}</li>`)
    .join("");
}

async function renderTickets() {
  const rows = await api("/api/tickets", { token: getToken() });
  $("ticketsTbody").innerHTML = rows
    .map((t) => `<tr><td>${t.TicketNumber}</td><td>${t.TicketType}</td><td>${t.DiscountFor}</td><td>${Number(t.Price).toFixed(2)}</td><td>${t.ExpiryDate}</td><td>${t.IsActive ? "Active" : "Expired"}</td></tr>`)
    .join("");
}

async function renderReservations() {
  const rows = await api("/api/reservations", { token: getToken() });
  $("reservationsTbody").innerHTML = rows
    .map(
      (r) => `<tr>
      <td>${r.ReservationID}</td>
      <td>${r.ReservationType}</td>
      <td>${r.AttractionName || r.DiningName || "-"}</td>
      <td>${r.ReservationDate}</td>
      <td>${r.TimeSlot}</td>
      <td>${r.Status}</td>
      <td><button class="btn small" data-cancel-res="${r.ReservationID}">Cancel</button></td>
    </tr>`
    )
    .join("");
}

async function renderItinerary() {
  const rows = await api("/api/itinerary", { token: getToken() });
  $("itineraryList").innerHTML = rows
    .map((i) => `<li>${i.ItemType}: ${i.AttractionName || i.ParkName || "-"} ${i.PlannedDate ? `on ${i.PlannedDate}` : ""} <button class="btn small" data-del-itin="${i.ItineraryID}">Delete</button></li>`)
    .join("");
}

async function renderDiningAndMerch() {
  const [dining, merch] = await Promise.all([api("/api/dining", { token: getToken() }), api("/api/merchandise", { token: getToken() })]);
  $("diningList").innerHTML = dining.map((d) => `<li><strong>${d.DiningName}</strong> (${d.CuisineType || "Cuisine"}) - ${d.MenuSummary || "Menu available at park."}</li>`).join("");
  $("merchList").innerHTML = merch
    .map((m) => `<li><strong>${m.ItemName}</strong> @ ${m.RetailName} - $${Number(m.DiscountPrice || m.SellPrice).toFixed(2)}</li>`)
    .join("");
}

async function renderOrders() {
  const rows = await api("/api/orders", { token: getToken() });
  $("ordersTbody").innerHTML = rows
    .map((o) => `<tr><td>${o.OrderID}</td><td>${o.OrderType}</td><td>${Number(o.OrderTotal).toFixed(2)}</td><td>${o.PromoCode || "-"}</td><td>${o.PaymentStatus}</td><td><button class="btn small" data-order-items="${o.OrderID}">View Items</button></td></tr>`)
    .join("");
}

async function renderFeedback() {
  const rows = await api("/api/feedback-submissions", { token: getToken() });
  $("feedbackList").innerHTML = rows
    .map((f) => `<li><strong>${f.FeedbackType}</strong> ${f.AttractionName ? `for ${f.AttractionName}` : ""}: ${f.Message}</li>`)
    .join("");
}

async function fullRefresh() {
  await Promise.all([
    refreshProfile(),
    renderVisitHistory(),
    renderAttractions(),
    renderParksAndEvents(),
    renderTickets(),
    renderReservations(),
    renderItinerary(),
    renderDiningAndMerch(),
    renderOrders(),
    renderFeedback(),
  ]);
}

function bindAuthForms() {
  $("btnShowLogin").addEventListener("click", () => setAuthMode("login"));
  $("btnShowRegister").addEventListener("click", () => setAuthMode("register"));

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const tokenData = await api("/api/visitor/login", {
        method: "POST",
        body: { Email: e.target.email.value, Password: e.target.password.value },
      });
      setToken(tokenData.token);
      await bootApp();
    } catch (err) {
      showStatus(err.message, true);
    }
  });

  $("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const tokenData = await api("/api/visitor/register", {
        method: "POST",
        body: {
          Name: e.target.name.value,
          Phone: e.target.phone.value || null,
          Email: e.target.email.value,
          Password: e.target.password.value,
          Gender: e.target.gender.value || null,
          Age: e.target.age.value === "" ? null : Number(e.target.age.value),
        },
      });
      setToken(tokenData.token);
      await bootApp();
    } catch (err) {
      showStatus(err.message, true);
    }
  });
}

function bindAppActions() {
  $("btnLogout").addEventListener("click", logoutVisitor);
  $("btnLogoutAccount").addEventListener("click", logoutVisitor);

  document.querySelectorAll(".tab-btn").forEach((btn) => btn.addEventListener("click", () => setTab(btn.dataset.tab)));

  $("profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await api("/api/visitor/profile", {
      method: "PUT",
      token: getToken(),
      body: {
        Name: $("profileName").value,
        Phone: $("profilePhone").value || null,
        Gender: $("profileGender").value || null,
        Age: $("profileAge").value === "" ? null : Number($("profileAge").value),
      },
    });
    showStatus("Profile updated.");
    await fullRefresh();
  });

  $("ticketPurchaseForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await api("/api/tickets/purchase", {
      method: "POST",
      token: getToken(),
      body: {
        TicketPlan: $("ticketPlan").value,
        TicketCategory: $("ticketCategory").value,
        Price: Number($("ticketPrice").value),
        ExpiryDate: $("ticketExpiry").value,
        PromoCode: $("ticketPromo").value || null,
        PaymentMethod: $("ticketPaymentMethod").value || null,
      },
    });
    showStatus("Ticket purchased.");
    e.target.reset();
    await fullRefresh();
  });

  $("reservationForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await api("/api/reservations", {
      method: "POST",
      token: getToken(),
      body: {
        ReservationType: $("reservationType").value,
        AttractionID: $("reservationAttraction").value || null,
        DiningID: $("reservationDining").value || null,
        ReservationDate: $("reservationDate").value,
        TimeSlot: $("reservationTimeSlot").value,
        PartySize: Number($("reservationPartySize").value || 1),
        Notes: $("reservationNotes").value || null,
      },
    });
    showStatus("Reservation saved.");
    e.target.reset();
    await renderReservations();
  });

  $("reservationsTbody").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-cancel-res]");
    if (!btn) return;
    const id = Number(btn.dataset.cancelRes);
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 5);
    await api(`/api/reservations/${id}`, {
      method: "PUT",
      token: getToken(),
      body: { ReservationDate: date, TimeSlot: time, PartySize: 1, Status: "Cancelled", Notes: "Cancelled by visitor" },
    });
    await renderReservations();
  });

  $("itineraryForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await api("/api/itinerary", {
      method: "POST",
      token: getToken(),
      body: {
        AttractionID: $("itineraryAttraction").value || null,
        ParkID: $("itineraryPark").value || null,
        PlannedDate: $("itineraryDate").value || null,
        ItemType: $("itineraryType").value,
        Notes: $("itineraryNotes").value || null,
      },
    });
    e.target.reset();
    await renderItinerary();
  });

  $("itineraryList").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-del-itin]");
    if (!btn) return;
    await api(`/api/itinerary/${Number(btn.dataset.delItin)}`, { method: "DELETE", token: getToken() });
    await renderItinerary();
  });

  $("diningOrderForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await api("/api/orders/dining", {
      method: "POST",
      token: getToken(),
      body: {
        DiningID: Number($("diningOrderDining").value),
        Quantity: Number($("diningOrderQty").value || 1),
        UnitPrice: Number($("diningOrderUnitPrice").value),
        PromoCode: $("diningPromo").value || null,
        PaymentMethod: $("diningPaymentMethod").value || null,
      },
    });
    await renderOrders();
  });

  $("merchOrderForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await api("/api/orders/merchandise", {
      method: "POST",
      token: getToken(),
      body: {
        ItemID: Number($("merchOrderItem").value),
        Quantity: Number($("merchOrderQty").value || 1),
        PromoCode: $("merchPromo").value || null,
        PaymentMethod: $("merchPaymentMethod").value || null,
      },
    });
    await renderOrders();
  });

  $("ordersTbody").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-order-items]");
    if (!btn) return;
    const rows = await api(`/api/orders/${Number(btn.dataset.orderItems)}/items`, { token: getToken() });
    $("orderItemsPreview").textContent = JSON.stringify(rows, null, 2);
  });

  $("feedbackForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await api("/api/feedback-submissions", {
      method: "POST",
      token: getToken(),
      body: {
        AttractionID: $("feedbackAttraction").value || null,
        Rating: $("feedbackRating").value === "" ? null : Number($("feedbackRating").value),
        FeedbackType: $("feedbackType").value,
        Message: $("feedbackMessage").value,
      },
    });
    e.target.reset();
    await renderFeedback();
  });
}

async function bootApp() {
  const token = getToken();
  if (!token) {
    showAuth(true);
    return;
  }
  try {
    await loadLookups(token);
    showAuth(false);
    await fullRefresh();
    setTab("account");
  } catch (err) {
    clearToken();
    showAuth(true);
    showStatus(`Session reset: ${err.message}`, true);
  }
}

bindAuthForms();
bindAppActions();
bootApp();

