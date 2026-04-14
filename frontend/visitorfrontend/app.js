const API_BASE = "https://visitors-portal-backend.onrender.com";
const TOKEN_KEY = "token";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function api(path, { method = "GET", body = null, token = null } = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg = (data && data.error) || res.statusText;
    throw new Error(msg);
  }
  return data;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function $(id) {
  return document.getElementById(id);
}

let areas = [];

function setActiveTab(tabName) {
  const panels = document.querySelectorAll(".tab-panel");
  panels.forEach((p) => p.classList.add("hidden"));
  const tab = document.getElementById(`tab-${tabName}`);
  if (tab) tab.classList.remove("hidden");

  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tabName);
  });
}

function showAuth(show) {
  $("authSection").classList.toggle("hidden", !show);
  $("appSection").classList.toggle("hidden", show);
}

function showToast(msg, isErr) {
  // Minimal: use alert-like error display; you can replace with a nicer toast.
  if (isErr) alert(msg);
}

async function loadAreas() {
  areas = await api("/api/areas", { token: getToken() });
  return areas;
}

function populateSelect(selectEl, items, { valueKey = "AreaID", labelKey = "AreaName" } = {}, selectedValue = null) {
  selectEl.innerHTML = "";
  for (const item of items) {
    const opt = document.createElement("option");
    opt.value = item[valueKey];
    opt.textContent = item[labelKey];
    if (selectedValue != null && String(item[valueKey]) === String(selectedValue)) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

// =========================
// Auth
// =========================

async function initAppWithToken(token) {
  showAuth(false);
  const visitor = await api("/api/visitor/me", { token });
  $("visitorBadge").classList.remove("hidden");
  $("visitorBadge").textContent = `Logged in as ${visitor.Name} (${visitor.Email})`;
  $("btnLogout").classList.remove("hidden");

  // Load dropdown data once
  await loadAreas();
  populateSelect($("reviewAreaSelect"), areas);
  populateSelect($("reviewEditAreaSelect"), areas);

  await Promise.all([loadTickets(), loadExpiredTickets(), loadReviews(), loadChildren()]);

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });
  setActiveTab("tickets");
}

async function init() {
  const token = getToken();
  if (!token) {
    showAuth(true);
    bindForms();
    return;
  }
  try {
    await initAppWithToken(token);
  } catch {
    clearToken();
    showAuth(true);
    bindForms();
  }
}

function bindForms() {
  $("btnLogout").addEventListener("click", () => {
    clearToken();
    location.reload();
  });

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = {
      Email: f.email.value,
      Password: f.password.value,
    };
    $("loginError").style.display = "none";

    try {
      const data = await api("/api/visitor/login", { method: "POST", body });
      setToken(data.token);
      await initAppWithToken(data.token);
    } catch (err) {
      $("loginError").style.display = "block";
      $("loginError").textContent = err.message;
    }
  });

  $("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = {
      Name: f.name.value,
      Phone: f.phone.value || null,
      Email: f.email.value,
      Password: f.password.value,
      Gender: f.gender.value || null,
      Age: f.age.value === "" ? null : Number(f.age.value),
    };
    $("registerError").style.display = "none";

    try {
      const data = await api("/api/visitor/register", { method: "POST", body });
      setToken(data.token);
      await initAppWithToken(data.token);
    } catch (err) {
      $("registerError").style.display = "block";
      $("registerError").textContent = err.message;
    }
  });
}

// =========================
// Tickets
// =========================

async function loadTickets() {
  const token = getToken();
  const tickets = await api("/api/tickets", { token });
  const tbody = $("ticketsTbody");
  tbody.innerHTML = "";

  tickets.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(t.TicketNumber)}</td>
      <td>${escapeHtml(t.TicketType)}</td>
      <td>${escapeHtml(t.DiscountFor || "None")}</td>
      <td>${Number(t.Price).toFixed(2)}</td>
      <td>${escapeHtml(t.IssueDate)}</td>
      <td>${escapeHtml(t.ExpiryDate)}</td>
      <td>${t.IsActive ? "Active" : "Inactive"}</td>
      <td>
        <button class="btn btn-primary" type="button" data-edit-ticket="${t.TicketNumber}">Edit</button>
        <button class="btn btn-danger" type="button" data-del-ticket="${t.TicketNumber}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadExpiredTickets() {
  const token = getToken();
  const tickets = await api("/api/queries/expired-tickets", { token });
  const tbody = $("expiredTicketsTbody");
  tbody.innerHTML = "";

  tickets.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(t.TicketNumber)}</td>
      <td>${escapeHtml(t.TicketType)}</td>
      <td>${escapeHtml(t.DiscountFor || "None")}</td>
      <td>${Number(t.Price).toFixed(2)}</td>
      <td>${escapeHtml(t.ExpiryDate)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function bindTicketActions() {
  $("ticketsTbody").addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-edit-ticket]");
    const delBtn = e.target.closest("[data-del-ticket]");
    if (!editBtn && !delBtn) return;

    const TicketNumber = (editBtn || delBtn).dataset.editTicket || (editBtn || delBtn).dataset.delTicket;
    if (!TicketNumber) return;

    if (delBtn) {
      if (!confirm(`Delete ticket ${TicketNumber}?`)) return;
      const token = getToken();
      await api(`/api/tickets/${TicketNumber}`, { method: "DELETE", token });
      await Promise.all([loadTickets(), loadExpiredTickets()]);
      return;
    }

    // Fill edit form
    const token = getToken();
    const tickets = await api("/api/tickets", { token, method: "GET" });
    const ticket = tickets.find((x) => String(x.TicketNumber) === String(TicketNumber));
    if (!ticket) return;

    $("ticketEditCard").classList.remove("hidden");
    const form = $("ticketEditForm");
    form.TicketNumber.value = ticket.TicketNumber;
    form.TicketType.value = ticket.TicketType;
    form.DiscountFor.value = ticket.DiscountFor || "None";
    form.Price.value = Number(ticket.Price);
    form.ExpiryDate.value = ticket.ExpiryDate;
    form.IsActive.value = ticket.IsActive ? "1" : "0";
  });
}

function bindTicketForms() {
  $("ticketCreateForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const token = getToken();
    const body = {
      TicketType: f.TicketType.value,
      DiscountFor: f.DiscountFor.value,
      Price: Number(f.Price.value),
      ExpiryDate: f.ExpiryDate.value,
    };
    await api("/api/tickets", { method: "POST", token, body });
    f.reset();
    await Promise.all([loadTickets(), loadExpiredTickets()]);
  });

  $("ticketCancelEdit").addEventListener("click", () => {
    $("ticketEditCard").classList.add("hidden");
  });

  $("ticketEditForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const token = getToken();
    const TicketNumber = f.TicketNumber.value;
    const body = {
      TicketType: f.TicketType.value,
      DiscountFor: f.DiscountFor.value,
      Price: Number(f.Price.value),
      ExpiryDate: f.ExpiryDate.value,
      IsActive: f.IsActive.value,
    };
    await api(`/api/tickets/${TicketNumber}`, { method: "PUT", token, body });
    $("ticketEditCard").classList.add("hidden");
    await Promise.all([loadTickets(), loadExpiredTickets()]);
  });
}

// =========================
// Reviews
// =========================

async function loadReviews() {
  const token = getToken();
  const reviews = await api("/api/reviews", { token });
  const tbody = $("reviewsTbody");
  tbody.innerHTML = "";

  reviews.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.ReviewID)}</td>
      <td>${escapeHtml(r.AreaName)}</td>
      <td>${escapeHtml(r.Feedback)}</td>
      <td>${escapeHtml(r.DateSubmitted)}</td>
      <td>${escapeHtml(r.Comment || "")}</td>
      <td>
        <button class="btn btn-primary" type="button" data-edit-review="${r.ReviewID}">Edit</button>
        <button class="btn btn-danger" type="button" data-del-review="${r.ReviewID}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function bindReviewActions() {
  $("reviewsTbody").addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-edit-review]");
    const delBtn = e.target.closest("[data-del-review]");
    if (!editBtn && !delBtn) return;

    const ReviewID = (editBtn || delBtn).dataset.editReview || (editBtn || delBtn).dataset.delReview;
    const token = getToken();

    if (delBtn) {
      if (!confirm(`Delete review ${ReviewID}?`)) return;
      await api(`/api/reviews/${ReviewID}`, { method: "DELETE", token });
      await loadReviews();
      return;
    }

    const reviews = await api("/api/reviews", { token });
    const review = reviews.find((x) => String(x.ReviewID) === String(ReviewID));
    if (!review) return;

    $("reviewEditCard").classList.remove("hidden");
    const f = $("reviewEditForm");
    f.ReviewID.value = review.ReviewID;
    f.AreaID.value = review.AreaID;
    f.Feedback.value = review.Feedback;
    f.Comment.value = review.Comment || "";
    f.IsActive.value = review.IsActive ? "1" : "0";
  });
}

function bindReviewForms() {
  $("reviewCancelEdit").addEventListener("click", () => {
    $("reviewEditCard").classList.add("hidden");
  });

  $("reviewCreateForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const token = getToken();
    const body = {
      AreaID: Number(f.AreaID.value),
      Feedback: Number(f.Feedback.value),
      Comment: f.Comment.value || null,
      IsActive: 1,
    };
    await api("/api/reviews", { method: "POST", token, body });
    f.reset();
    await loadReviews();
  });

  $("reviewEditForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const token = getToken();
    const ReviewID = f.ReviewID.value;
    const body = {
      AreaID: Number(f.AreaID.value),
      Feedback: Number(f.Feedback.value),
      Comment: f.Comment.value || null,
      IsActive: f.IsActive.value,
    };
    await api(`/api/reviews/${ReviewID}`, { method: "PUT", token, body });
    $("reviewEditCard").classList.add("hidden");
    await loadReviews();
  });
}

// =========================
// Children
// =========================

async function loadChildren() {
  const token = getToken();
  const kids = await api("/api/children", { token });
  const tbody = $("childrenTbody");
  tbody.innerHTML = "";

  kids.forEach((k) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(k.ChildID)}</td>
      <td>${escapeHtml(k.Name || "")}</td>
      <td>${escapeHtml(k.Age ?? "")}</td>
      <td>${escapeHtml(k.Gender ?? "")}</td>
      <td>
        <button class="btn btn-primary" type="button" data-edit-child="${k.ChildID}">Edit</button>
        <button class="btn btn-danger" type="button" data-del-child="${k.ChildID}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function bindChildActions() {
  $("childrenTbody").addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-edit-child]");
    const delBtn = e.target.closest("[data-del-child]");
    if (!editBtn && !delBtn) return;

    const ChildID = (editBtn || delBtn).dataset.editChild || (editBtn || delBtn).dataset.delChild;
    const token = getToken();

    if (delBtn) {
      if (!confirm(`Delete child ${ChildID}?`)) return;
      await api(`/api/children/${ChildID}`, { method: "DELETE", token });
      await loadChildren();
      return;
    }

    // For simplicity we’ll prompt instead of a full edit panel (keeps UI small).
    const kids = await api("/api/children", { token });
    const kid = kids.find((x) => String(x.ChildID) === String(ChildID));
    if (!kid) return;

    const newName = prompt("Child name:", kid.Name || "");
    if (newName == null) return;
    const newAge = prompt("Child age:", kid.Age ?? "");
    if (newAge == null) return;
    const newGender = prompt("Child gender (Male/Female/Other):", kid.Gender ?? "");
    if (newGender == null) return;

    await api(`/api/children/${ChildID}`, {
      method: "PUT",
      token,
      body: {
        Name: newName,
        Age: newAge === "" ? null : Number(newAge),
        Gender: newGender === "" ? null : newGender,
      },
    });

    await loadChildren();
  });
}

function bindChildForms() {
  $("childCreateForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const token = getToken();
    const body = {
      Name: f.Name.value,
      Age: f.Age.value === "" ? null : Number(f.Age.value),
      Gender: f.Gender.value || null,
    };
    await api("/api/children", { method: "POST", token, body });
    f.reset();
    await loadChildren();
  });
}

// =========================
// Reports
// =========================

function bindReports() {
  $("btnReportTickets").addEventListener("click", async () => {
    const token = getToken();
    const rows = await api("/api/reports/ticket-sales-summary", { token });
    $("reportTickets").textContent = JSON.stringify(rows, null, 2);
  });

  $("btnReportRatings").addEventListener("click", async () => {
    const rows = await api("/api/reports/average-ratings-per-area", { token: getToken() });
    $("reportRatings").textContent = JSON.stringify(rows, null, 2);
  });

  $("btnReportDemographics").addEventListener("click", async () => {
    const rows = await api("/api/reports/visitor-demographics", { token: getToken() });
    $("reportDemographics").textContent = JSON.stringify(rows, null, 2);
  });

  $("btnReportPopularAreas").addEventListener("click", async () => {
    const rows = await api("/api/reports/most-popular-areas", { token: getToken() });
    $("reportPopularAreas").textContent = JSON.stringify(rows, null, 2);
  });

  $("btnReportTotalSpent").addEventListener("click", async () => {
    const rows = await api("/api/reports/visitor-total-spent", { token: getToken() });
    $("reportTotalSpent").textContent = JSON.stringify(rows, null, 2);
  });
}

// =========================
// Queries
// =========================

function bindQueries() {
  $("btnQueryExpired").addEventListener("click", async () => {
    await loadExpiredTickets();
    setActiveTab("tickets");
  });

  $("btnQueryTicketsByType").addEventListener("click", async () => {
    const token = getToken();
    const type = $("ticketTypeQuery").value;
    const rows = await api(`/api/queries/tickets-by-type?type=${encodeURIComponent(type)}`, { token });
    $("queryTicketsByType").textContent = JSON.stringify(rows, null, 2);
  });

  $("btnQueryReviewsFiltered").addEventListener("click", async () => {
    const token = getToken();
    const areaId = $("reviewAreaQuery").value ? Number($("reviewAreaQuery").value) : null;
    const minRating = $("minRatingQuery").value === "" ? null : Number($("minRatingQuery").value);
    const maxRating = $("maxRatingQuery").value === "" ? null : Number($("maxRatingQuery").value);

    const qs = new URLSearchParams();
    if (areaId != null) qs.set("areaId", areaId);
    if (minRating != null) qs.set("minRating", minRating);
    if (maxRating != null) qs.set("maxRating", maxRating);

    const rows = await api(`/api/queries/reviews-filter?${qs.toString()}`, { token });
    $("queryReviewsFiltered").textContent = JSON.stringify(rows, null, 2);
  });
}

async function bindOnReady() {
  bindTicketForms();
  bindTicketActions();
  bindReviewForms();
  bindReviewActions();
  bindChildForms();
  bindChildActions();
  bindReports();
  bindQueries();

  // Query dropdown uses same areas list
  populateSelect($("reviewAreaQuery"), areas);
}

// Entry
init().then(async () => {
  // If logged in, bind everything and load dropdown selection
  if (getToken()) {
    await bindOnReady();
  }
});

// If user logs in later, we still need bindings.
// We bind forms on DOMContentLoaded as well, but only once here for simplicity.

