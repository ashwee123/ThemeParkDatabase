"use strict";

/** Same host as homepage login (Render). Override via <meta name="admin-api-origin" content="https://..."> */
const DEFAULT_REMOTE_API_ORIGIN = "https://admin-portal-backend-c051.onrender.com";

function getApiBase() {
  const meta = document.querySelector('meta[name="admin-api-origin"]');
  const fromMeta = meta && meta.content && meta.content.trim();
  if (fromMeta) return fromMeta.replace(/\/$/, "") + "/api";
  const h = typeof location !== "undefined" ? location.hostname : "";
  if (h === "localhost" || h === "127.0.0.1") return "/api";
  return DEFAULT_REMOTE_API_ORIGIN.replace(/\/$/, "") + "/api";
}

const API = getApiBase();
const API_ORIGIN = API.replace(/\/api$/, "");
const IS_REMOTE_API = API.startsWith("http");
const WAKEUP_RETRY_DELAYS_MS = [0, 3000, 5000, 8000, 10000, 12000, 15000];
const BACKEND_WAKEUP_ERROR =
  "Backend is waking up. Please wait a moment, then retry.";

let apiReady = !IS_REMOTE_API;
let apiWakePromise = null;

function fetchCredentials() {
  return API.startsWith("http") ? "omit" : "same-origin";
}

// Safe querySelector — returns null instead of throwing
function $(sel) {
  return document.querySelector(sel);
}

function showToast(msg, err) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.toggle("error", !!err);
  t.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(function () {
    t.classList.remove("show");
  }, 3500);
}

function setBackendStatus(message, options = {}) {
  const wrap = $("#backend-status");
  const text = $("#backend-status-text");
  const retryBtn = $("#btn-backend-retry");
  if (!wrap || !text || !retryBtn) return;
  const visible = !!options.visible;
  wrap.classList.toggle("hidden", !visible);
  wrap.classList.toggle("error", !!options.error);
  text.textContent = message || "";
  retryBtn.classList.toggle("hidden", !options.showRetry);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

async function ping(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function ensureApiReady(force) {
  if (!IS_REMOTE_API) return;
  if (apiReady && !force) return;
  if (apiWakePromise && !force) return apiWakePromise;
  apiWakePromise = (async function () {
    apiReady = false;
    setBackendStatus("Connecting to backend service…", { visible: true });
    for (let i = 0; i < WAKEUP_RETRY_DELAYS_MS.length; i += 1) {
      if (WAKEUP_RETRY_DELAYS_MS[i] > 0) {
        await sleep(WAKEUP_RETRY_DELAYS_MS[i]);
      }
      const [healthOk, summaryOk] = await Promise.all([
        ping(API_ORIGIN + "/health"),
        ping(API + "/summary"),
      ]);
      if (healthOk || summaryOk) {
        apiReady = true;
        setBackendStatus("", { visible: false });
        return;
      }
    }
    setBackendStatus(BACKEND_WAKEUP_ERROR, {
      visible: true,
      error: true,
      showRetry: true,
    });
    // Do not hard-fail here; allow the actual API request to run.
    // This prevents false negatives when warm-up probes fail but data routes are reachable.
    return;
  })();

  try {
    await apiWakePromise;
  } finally {
    apiWakePromise = null;
  }
}

async function apiGet(path) {
  await ensureApiReady(false);
  const res = await fetch(API + path, { credentials: fetchCredentials() });
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch (e) { data = { raw: text }; }
  }
  if (!res.ok) {
    const m = data && data.error ? data.error : res.statusText;
    throw new Error(m);
  }
  apiReady = true;
  setBackendStatus("", { visible: false });
  return data;
}

async function apiPatch(path, body) {
  await ensureApiReady(false);
  const opts = { method: "PATCH", credentials: fetchCredentials() };
  if (body !== undefined) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(API + path, opts);
  const text = await res.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); }
    catch (e) { data = { error: text }; }
  }
  if (!res.ok) throw new Error(data.error || res.statusText);
  apiReady = true;
  setBackendStatus("", { visible: false });
  return data;
}

async function apiPost(path, body) {
  await ensureApiReady(false);
  const opts = { method: "POST", credentials: fetchCredentials(), headers: { "Content-Type": "application/json" } };
  opts.body = JSON.stringify(body != null ? body : {});
  const res = await fetch(API + path, opts);
  const text = await res.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); }
    catch (e) { data = { error: text }; }
  }
  if (!res.ok) throw new Error(data.error || res.statusText);
  apiReady = true;
  setBackendStatus("", { visible: false });
  return data;
}

const retryBackendBtn = $("#btn-backend-retry");
if (retryBackendBtn) {
  retryBackendBtn.addEventListener("click", function () {
    ensureApiReady(true)
      .then(function () {
        return loadDashboard();
      })
      .catch(function (e) {
        if (typeof console !== "undefined" && console.error) console.error(e);
      });
  });
}

function downloadCsv(filename, rows, columns) {
  function escCell(v) {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  const head = columns.map(function (c) { return escCell(c.label || c.key); }).join(",");
  const lines = rows.map(function (r) {
    return columns.map(function (c) { return escCell(r[c.key]); }).join(",");
  });
  const blob = new Blob([head + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Panel switching ──────────────────────────────────────────────────────────
const PANELS = [
  "dash", "users", "visitors", "retail", "hr", "maint", "park", "reports", "system",
];

function showPanel(name) {
  PANELS.forEach(function (id) {
    const p = document.getElementById("panel-" + id);
    if (!p) return;
    const on = id === name;
    p.classList.toggle("active", on);
    p.toggleAttribute("hidden", !on);
  });
}

document.querySelectorAll(".tab").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".tab").forEach(function (b) {
      b.classList.toggle("active", b === btn);
    });
    const tab = btn.dataset.tab;
    showPanel(tab);
    const loaders = {
      dash: loadDashboard,
      users: loadUsersPanel,
      visitors: async function () {
        await loadVisitorsPanel();
        await loadVisitorsTickets();
      },
      retail: loadRetail,
      hr: loadHrPanel,
      maint: loadMaint,
      park: loadParkPanel,
      reports: loadReportsPanel,
      system: loadSystemPanel,
    };
    if (loaders[tab]) {
      loaders[tab]().catch(function (e) {
        if (typeof console !== "undefined" && console.error) console.error(e);
      });
    }
  });
});

// ── Dashboard ────────────────────────────────────────────────────────────────
async function loadDashboard() {
  const grid = $("#stat-grid");
  if (!grid) return;
  let s;
  try {
    s = await apiGet("/summary");
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    setBackendStatus("Dashboard request failed: " + msg, {
      visible: true,
      error: true,
      showRetry: true,
    });
    grid.innerHTML =
      '<p class="api-error" role="alert"><strong>Could not load dashboard.</strong><br />' +
      escapeHtml(msg) +
      "</p><p class=\"hint\">If you opened this from Vercel, the API must be live on your Render homepage service (<code>/api/summary</code>) and the database reachable.</p>";
    return;
  }
  const cards = [
    ["Employees",        s.employees],
    ["Active visitors",  s.visitorsActive],
    ["Attractions",      s.attractions],
    ["Rides",            s.rides],
    ["Open maint. alerts", s.openAlerts,   s.openAlerts  > 0 ? "badge-warn" : "badge-ok"],
    ["Open assignments", s.pendingMaint],
    ["Active SKUs",      s.retailItems],
    ["Low stock SKUs",   s.lowStock,       s.lowStock    > 0 ? "badge-warn" : "badge-ok"],
    ["Incidents (30d)",  s.incidents30d],
  ];
  grid.innerHTML = cards.map(function (c) {
    const cls = c[2] || "";
    return (
      '<div class="stat-card">' +
        '<div class="label">' + escapeHtml(c[0]) + '</div>' +
        '<div class="value ' + cls + '">' + escapeHtml(c[1]) + '</div>' +
      '</div>'
    );
  }).join("");
}

const ATTRACTION_STATUS_OPTIONS = [
  "Open", "Closed", "Restricted", "NeedsMaintenance", "UnderMaintenance", "ClosedDueToWeather",
];

function fillEmployeeTable(sel, rows) {
  const tb = $(sel);
  if (!tb) return;
  tb.innerHTML = rows.map(function (r) {
    const area = r.AreaName != null ? r.AreaName : r.AreaID != null ? String(r.AreaID) : "—";
    return (
      "<tr>" +
        '<td class="num">' + escapeHtml(r.EmployeeID) + "</td>" +
        "<td>" + escapeHtml(r.Name) + "</td>" +
        "<td>" + escapeHtml(r.Position) + "</td>" +
        '<td class="num">' + (r.Salary != null ? Number(r.Salary).toFixed(2) : "—") + "</td>" +
        "<td>" + escapeHtml(r.HireDate || "—") + "</td>" +
        '<td class="num">' + escapeHtml(r.ManagerID ?? "—") + "</td>" +
        "<td>" + escapeHtml(area) + "</td>" +
      "</tr>"
    );
  }).join("");
  if (!rows.length) tb.innerHTML = '<tr><td colspan="7" class="hint">No rows</td></tr>';
}

async function loadUsersPanel() {
  const [emps, notes] = await Promise.all([
    apiGet("/employees"),
    apiGet("/notifications?limit=80"),
  ]);
  fillEmployeeTable("#tbody-internal-users", emps);
  const tn = $("#tbody-admin-notifications");
  if (tn) {
    tn.innerHTML = notes.map(function (r) {
      return (
        "<tr>" +
          '<td class="num">' + escapeHtml(r.NotificationID) + "</td>" +
          "<td>" + escapeHtml(r.Message) + "</td>" +
          "<td>" + escapeHtml(r.RetailName || "—") + "</td>" +
          "<td>" + escapeHtml(r.ItemName || "—") + "</td>" +
          "<td>" + escapeHtml(r.CreatedAt) + "</td>" +
        "</tr>"
      );
    }).join("");
    if (!notes.length) tn.innerHTML = '<tr><td colspan="5" class="hint">No notification log rows</td></tr>';
  }
}

async function loadVisitorsPanel() {
  const qEl = $("#visitor-search-q");
  const q = qEl && qEl.value ? qEl.value.trim() : "";
  const qs = new URLSearchParams();
  qs.set("limit", "5000");
  if (q) qs.set("q", q);
  const rows = await apiGet("/visitors?" + qs.toString());
  const tb = $("#tbody-visitors");
  if (!tb) return;
  function cnt(v) {
    return v != null && v !== "" ? String(v) : "0";
  }
  tb.innerHTML = rows.map(function (r) {
    const active = Number(r.IsActive) === 1;
    return (
      "<tr data-visitor-id=\"" + escapeHtml(r.VisitorID) + "\">" +
        '<td class="num">' + escapeHtml(r.VisitorID) + "</td>" +
        "<td>" + escapeHtml(r.Name) + "</td>" +
        "<td>" + escapeHtml(r.Email) + "</td>" +
        "<td>" + escapeHtml(r.Phone || "—") + "</td>" +
        "<td>" + escapeHtml(r.Gender || "—") + "</td>" +
        '<td class="num">' + escapeHtml(r.Age ?? "—") + "</td>" +
        "<td>" + (active ? '<span class="badge-ok">Active</span>' : '<span class="badge-warn">Inactive</span>') + "</td>" +
        "<td>" + escapeHtml(r.CreatedAt || "—") + "</td>" +
        '<td class="num">' + escapeHtml(cnt(r.TicketCount)) + "</td>" +
        '<td class="num">' + escapeHtml(cnt(r.ReviewCount)) + "</td>" +
        '<td class="num">' + escapeHtml(cnt(r.RetailPurchaseCount)) + "</td>" +
        '<td class="num">' + escapeHtml(cnt(r.OrderCount)) + "</td>" +
        '<td class="num">' + escapeHtml(cnt(r.ReservationCount)) + "</td>" +
        '<td class="num">' + escapeHtml(cnt(r.VisitHistoryCount)) + "</td>" +
        '<td class="num">' + escapeHtml(cnt(r.PortalFeedbackCount)) + "</td>" +
        "<td>" +
          (active
            ? '<button type="button" class="btn btn-small btn-ghost btn-ban">Deactivate</button>'
            : '<button type="button" class="btn btn-small btn-ghost btn-unban">Reactivate</button>') +
        "</td>" +
      "</tr>"
    );
  }).join("");
  if (!rows.length) tb.innerHTML = '<tr><td colspan="16" class="hint">No visitors</td></tr>';
}

function hrSearchPath(path, fixedParams) {
  const qEl = $("#hr-search-q");
  const q = qEl && qEl.value ? qEl.value.trim() : "";
  const p = new URLSearchParams(fixedParams || {});
  if (q) p.set("q", q);
  const s = p.toString();
  return path + (s ? "?" + s : "");
}

async function loadHrPanel() {
  const [mgrs, emps, visitors, shifts, vrevs] = await Promise.all([
    apiGet(hrSearchPath("/hr-managers")),
    apiGet(hrSearchPath("/employees")),
    apiGet(hrSearchPath("/visitors", { limit: "500" })),
    apiGet(hrSearchPath("/shifts", { limit: "1000" })),
    apiGet(hrSearchPath("/reports/visitor-reviews", { limit: "1000" })),
  ]);

  const tm = $("#tbody-hr-managers");
  if (tm) {
    tm.innerHTML = mgrs.map(function (r) {
      return (
        "<tr>" +
          '<td class="num">' + escapeHtml(r.ManagerID) + "</td>" +
          "<td>" + escapeHtml(r.ManagerName || "—") + "</td>" +
          '<td class="num">' + escapeHtml(r.AreaID ?? "—") + "</td>" +
          "<td>" + escapeHtml(r.AreaName || "—") + "</td>" +
        "</tr>"
      );
    }).join("");
    if (!mgrs.length) tm.innerHTML = '<tr><td colspan="4" class="hint">No HR manager rows (or table not present in this database).</td></tr>';
  }

  fillEmployeeTable("#tbody-hr-staff", emps);

  const hv = $("#tbody-hr-visitors");
  if (hv) {
    hv.innerHTML = visitors.map(function (r) {
      const active = Number(r.IsActive) === 1;
      return (
        "<tr>" +
          '<td class="num">' + escapeHtml(r.VisitorID) + "</td>" +
          "<td>" + escapeHtml(r.Name) + "</td>" +
          "<td>" + escapeHtml(r.Email) + "</td>" +
          "<td>" + escapeHtml(r.Phone || "—") + "</td>" +
          "<td>" + escapeHtml(r.Gender || "—") + "</td>" +
          '<td class="num">' + escapeHtml(r.Age ?? "—") + "</td>" +
          "<td>" + (active ? '<span class="badge-ok">Active</span>' : '<span class="badge-warn">Inactive</span>') + "</td>" +
          "<td>" + escapeHtml(r.CreatedAt || "—") + "</td>" +
        "</tr>"
      );
    }).join("");
    if (!visitors.length) {
      hv.innerHTML = '<tr><td colspan="8" class="hint">No visitors in the directory (or none match your search).</td></tr>';
    }
  }

  const ts = $("#tbody-shifts");
  if (ts) {
    ts.innerHTML = shifts.map(function (r) {
      return (
        "<tr>" +
          '<td class="num">' + escapeHtml(r.ShiftID) + "</td>" +
          '<td class="num">' + escapeHtml(r.EmployeeID ?? "—") + "</td>" +
          "<td>" + escapeHtml(r.EmployeeName || "—") + "</td>" +
          "<td>" + escapeHtml(r.ShiftDate || "—") + "</td>" +
          "<td>" + escapeHtml(r.StartTime || "—") + "</td>" +
          "<td>" + escapeHtml(r.EndTime || "—") + "</td>" +
        "</tr>"
      );
    }).join("");
    if (!shifts.length) ts.innerHTML = '<tr><td colspan="6" class="hint">No shifts match this search.</td></tr>';
  }
  const vr = $("#tbody-hr-visitor-reviews");
  if (vr) {
    vr.innerHTML = vrevs.map(function (r) {
      var comment = String(r.Comment || "").replace(/\s+/g, " ");
      if (comment.length > 120) comment = comment.slice(0, 117) + "…";
      const rating = r.Rating != null ? r.Rating : r.Feedback;
      return (
        "<tr>" +
          '<td class="num">' + escapeHtml(r.ReviewID) + "</td>" +
          "<td>" + escapeHtml(r.VisitorName || "—") + ' <span class="hint">#' + escapeHtml(r.VisitorID) + "</span></td>" +
          "<td>" + escapeHtml(r.AreaName || "—") + "</td>" +
          '<td class="num">' + escapeHtml(rating ?? "—") + "</td>" +
          "<td>" + escapeHtml(r.DateSubmitted || "—") + "</td>" +
          "<td>" + escapeHtml(comment) + "</td>" +
        "</tr>"
      );
    }).join("");
    if (!vrevs.length) vr.innerHTML = '<tr><td colspan="6" class="hint">No visitor reviews match this search.</td></tr>';
  }
}

function parkSearchPath(path) {
  const qEl = $("#park-search-q");
  const q = qEl && qEl.value ? qEl.value.trim() : "";
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  const s = p.toString();
  return path + (s ? "?" + s : "");
}

async function loadParkPanel() {
  const parkQ = $("#park-search-q") && $("#park-search-q").value ? $("#park-search-q").value.trim() : "";
  const [atts, areas] = await Promise.all([
    apiGet(parkSearchPath("/attractions")),
    apiGet(parkSearchPath("/areas")),
  ]);
  const wrap = $("#park-areas-list");
  if (wrap) {
    wrap.innerHTML = areas.length
      ? areas.map(function (a) {
          return '<span class="area-chip">' + escapeHtml(a.AreaName) + "</span>";
        }).join("")
      : '<span class="hint">No areas match this search.</span>';
  }
  const tb = $("#tbody-park-att");
  if (!tb) return;
  tb.innerHTML = atts.map(function (r) {
    const opts = ATTRACTION_STATUS_OPTIONS.map(function (st) {
      const sel = st === r.Status ? " selected" : "";
      return "<option value=\"" + escapeHtml(st) + "\"" + sel + ">" + escapeHtml(st) + "</option>";
    }).join("");
    return (
      "<tr>" +
        '<td class="num">' + escapeHtml(r.AttractionID) + "</td>" +
        "<td>" + escapeHtml(r.AttractionName) + "</td>" +
        "<td>" + escapeHtml(r.AttractionType) + "</td>" +
        "<td>" + escapeHtml(r.AreaName || "—") + "</td>" +
        "<td><select class=\"att-status-select\" data-att-id=\"" + escapeHtml(r.AttractionID) +
        "\" data-prev-status=\"" + escapeHtml(r.Status) + "\">" + opts + "</select></td>" +
        '<td class="num">' + escapeHtml(r.QueueCount) + "</td>" +
        "<td>" + escapeHtml(r.SeverityLevel) + "</td>" +
      "</tr>"
    );
  }).join("");
  if (!atts.length) {
    tb.innerHTML =
      '<tr><td colspan="7" class="hint">' +
      (parkQ ? "No attractions match this search." : "No attractions in the database.") +
      "</td></tr>";
  }
}

function reportCardVisible(preset, tags) {
  if (preset === "all") return true;
  return tags.indexOf(preset) !== -1;
}

function reportSnapshotQueryString() {
  const incEl = $("#report-incidents-days");
  const revEl = $("#report-reviews-days");
  const incidentsDays = incEl && incEl.value ? incEl.value : "90";
  const reviewsDays = revEl && revEl.value ? revEl.value : "30";
  const qs = new URLSearchParams();
  qs.set("incidentsDays", incidentsDays);
  qs.set("reviewsDays", reviewsDays);
  const kInc = $("#report-kpi-max-incidents");
  const kRev = $("#report-kpi-min-revenue");
  const kTix = $("#report-kpi-max-active-tickets");
  if (kInc && String(kInc.value).trim() !== "") qs.set("kpiMaxIncidents", String(kInc.value).trim());
  if (kRev && String(kRev.value).trim() !== "") qs.set("kpiMinRetailRevenue", String(kRev.value).trim());
  if (kTix && String(kTix.value).trim() !== "") qs.set("kpiMaxActiveTickets", String(kTix.value).trim());
  return qs;
}

async function loadReportsPanel() {
  const presetEl = $("#report-preset");
  const preset = presetEl && presetEl.value ? presetEl.value : "all";

  let snap;
  try {
    snap = await apiGet("/reports/snapshot?" + reportSnapshotQueryString().toString());
  } catch (e) {
    showToast(e.message, true);
    return;
  }

  const alertWrap = $("#report-kpi-alerts");
  if (alertWrap) {
    if (snap.kpiAlerts && snap.kpiAlerts.length) {
      alertWrap.classList.remove("hidden");
      alertWrap.innerHTML = snap.kpiAlerts
        .map(function (a) {
          const sev = a.severity === "crit" ? "crit" : "warn";
          return '<div class="report-kpi-alert report-kpi-alert--' + escapeHtml(sev) + '">' + escapeHtml(a.message) + "</div>";
        })
        .join("");
    } else {
      alertWrap.classList.add("hidden");
      alertWrap.innerHTML = "";
    }
  }

  const g = $("#report-snapshot-grid");
  if (!g) return;

  const incWin = snap.incidentsWindowDays != null ? snap.incidentsWindowDays : 90;
  const revWin = snap.visitorReviewsWindowDays != null ? snap.visitorReviewsWindowDays : 30;
  const avgRaw = snap.visitorReviewsAvgInWindow != null ? snap.visitorReviewsAvgInWindow : snap.visitorReviewsAvgRating30d;
  const avgStr =
    avgRaw != null && Number.isFinite(Number(avgRaw)) ? Number(avgRaw).toFixed(2) : "—";
  const revInWin = snap.visitorReviewsInWindow != null ? snap.visitorReviewsInWindow : snap.visitorReviewsLast30d;

  const cardDefs = [
    { tags: ["guests"], label: "Visitors (total)", value: snap.visitorsTotal },
    { tags: ["guests"], label: "Visitors (active accounts)", value: snap.visitorsActive },
    { tags: ["guests"], label: "Tickets issued", value: snap.ticketsTotal },
    { tags: ["guests"], label: "Tickets active", value: snap.ticketsActive },
    { tags: ["retail"], label: "Retail transactions", value: snap.retailTxCount },
    { tags: ["retail"], label: "Retail revenue (sum)", value: Number(snap.retailRevenue).toFixed(2) },
    {
      tags: ["safety"],
      label: "Incidents (last " + incWin + " days)",
      value: snap.incidentsInWindow != null ? snap.incidentsInWindow : snap.incidents90d,
    },
    { tags: ["reviews"], label: "Visitor reviews (all time)", value: snap.visitorReviewsTotal ?? "—" },
    {
      tags: ["reviews"],
      label: "Visitor reviews (last " + revWin + " days)",
      value: revInWin ?? "—",
    },
    {
      tags: ["reviews"],
      label: "Avg visitor rating (last " + revWin + " days, 1–10)",
      value: avgStr,
    },
  ];

  const cards = cardDefs.filter(function (c) {
    return reportCardVisible(preset, c.tags);
  });

  g.innerHTML = cards.map(function (c) {
    return (
      '<div class="stat-card"><div class="label">' + escapeHtml(c.label) + '</div><div class="value">' +
      escapeHtml(c.value) + "</div></div>"
    );
  }).join("");
}

const SYSTEM_TICKET_TYPES = ["General", "VIP", "Discount"];

function dbTimeToInputTime(t) {
  if (t == null || t === "") return "";
  const s = String(t);
  if (s.length >= 5 && s.indexOf(":") !== -1) return s.slice(0, 5);
  return s;
}

async function loadSystemPanel() {
  const tbParks = $("#tbody-system-parks");
  const tbEvents = $("#tbody-system-events");
  const tbPricing = $("#tbody-system-ticket-pricing");
  const tbNotes = $("#tbody-system-notifications");
  if (!tbParks || !tbEvents || !tbPricing) return;

  let parks;
  let events;
  let pricing;
  let settings;
  let notifications;
  try {
    const pack = await Promise.all([
      apiGet("/system/parks"),
      apiGet("/system/special-events?limit=80"),
      apiGet("/system/ticket-pricing"),
      apiGet("/system/settings"),
      apiGet("/notifications?limit=40"),
    ]);
    parks = pack[0];
    events = pack[1];
    pricing = pack[2];
    settings = pack[3];
    notifications = pack[4];
  } catch (e) {
    showToast(e.message, true);
    return;
  }

  const parkSelect = $("#system-event-park-id");
  if (parkSelect) {
    parkSelect.innerHTML =
      '<option value="">— All parks / unspecified —</option>' +
      parks.map(function (p) {
        return '<option value="' + escapeHtml(p.ParkID) + '">' + escapeHtml(p.ParkName) + "</option>";
      }).join("");
  }

  tbParks.innerHTML = parks.length
    ? parks.map(function (p) {
        const active = Number(p.IsActive) === 1;
        return (
          "<tr data-park-id=\"" + escapeHtml(p.ParkID) + "\">" +
          '<td class="num">' + escapeHtml(p.ParkID) + "</td>" +
          "<td><input type=\"text\" class=\"system-park-name\" value=\"" + escapeHtml(p.ParkName) + "\" /></td>" +
          "<td><input type=\"text\" class=\"system-park-location\" value=\"" + escapeHtml(p.LocationText || "") + "\" /></td>" +
          '<td><input type="time" class="system-park-open" value="' + escapeHtml(dbTimeToInputTime(p.OpeningTime)) + '" step="60" /></td>' +
          '<td><input type="time" class="system-park-close" value="' + escapeHtml(dbTimeToInputTime(p.ClosingTime)) + '" step="60" /></td>' +
          "<td><input type=\"text\" class=\"system-park-map\" value=\"" + escapeHtml(p.MapImageUrl || "") + "\" /></td>" +
          "<td><input type=\"checkbox\" class=\"system-park-active\" title=\"Active\" " + (active ? "checked " : "") + "/></td>" +
          '<td><button type="button" class="btn btn-small btn-ghost btn-system-save-park">Save</button></td>' +
          "</tr>"
        );
      }).join("")
    : '<tr><td colspan="8" class="hint">No parks in <code>visitor_park</code> (run visitor portal SQL upgrade + seed).</td></tr>';

  tbEvents.innerHTML = events.length
    ? events.map(function (ev) {
        const desc = String(ev.EventDescription || "").replace(/\s+/g, " ");
        const short = desc.length > 100 ? desc.slice(0, 97) + "…" : desc;
        return (
          "<tr>" +
          '<td class="num">' + escapeHtml(ev.EventID) + "</td>" +
          "<td>" + escapeHtml(ev.ParkName || "—") + "</td>" +
          "<td>" + escapeHtml(ev.EventName) + "</td>" +
          "<td>" + escapeHtml(ev.EventDate || "—") + "</td>" +
          "<td>" + escapeHtml(dbTimeToInputTime(ev.StartTime) || "—") + "</td>" +
          "<td>" + escapeHtml(dbTimeToInputTime(ev.EndTime) || "—") + "</td>" +
          "<td>" + escapeHtml(short || "—") + "</td>" +
          "</tr>"
        );
      }).join("")
    : '<tr><td colspan="7" class="hint">No special events yet.</td></tr>';

  const byType = {};
  pricing.forEach(function (r) {
    byType[r.TicketType] = r;
  });
  tbPricing.innerHTML = SYSTEM_TICKET_TYPES.map(function (tt) {
    const r = byType[tt] || { ticketsSold: 0, minPrice: null, maxPrice: null, avgPrice: null };
    const sold = r.ticketsSold != null ? r.ticketsSold : 0;
    const minP = r.minPrice != null ? Number(r.minPrice).toFixed(2) : "—";
    const maxP = r.maxPrice != null ? Number(r.maxPrice).toFixed(2) : "—";
    const avgP = r.avgPrice != null ? Number(r.avgPrice).toFixed(2) : "—";
    const suggest = r.maxPrice != null ? String(Number(r.maxPrice).toFixed(2)) : "";
    return (
      "<tr data-ticket-type=\"" + escapeHtml(tt) + "\">" +
      "<td>" + escapeHtml(tt) + "</td>" +
      '<td class="num">' + escapeHtml(sold) + "</td>" +
      "<td>" + escapeHtml(minP) + "</td>" +
      "<td>" + escapeHtml(maxP) + "</td>" +
      "<td>" + escapeHtml(avgP) + "</td>" +
      '<td><input type="number" class="system-ticket-newprice" min="0" step="0.01" placeholder="' +
      escapeHtml(suggest || "0.00") + "\" /></td>" +
      '<td><button type="button" class="btn btn-small btn-ghost btn-system-ticket-apply">Apply to all</button></td>' +
      "</tr>"
    );
  }).join("");

  if (settings) {
    const bk = $("#system-setting-backups");
    const wh = $("#system-setting-webhook");
    const nn = $("#system-setting-notify-notes");
    const br = $("#system-setting-branding");
    if (bk) bk.value = settings.backupsRpoRto || "";
    if (wh) wh.value = settings.notificationWebhookUrl || "";
    if (nn) nn.value = settings.notificationNotes || "";
    if (br) br.value = settings.brandingNotes || "";
  }

  if (tbNotes) {
    tbNotes.innerHTML = notifications.map(function (r) {
      return (
        "<tr>" +
        '<td class="num">' + escapeHtml(r.NotificationID) + "</td>" +
        "<td>" + escapeHtml(r.Message) + "</td>" +
        "<td>" + escapeHtml(r.RetailName || "—") + "</td>" +
        "<td>" + escapeHtml(r.ItemName || "—") + "</td>" +
        "<td>" + escapeHtml(r.CreatedAt) + "</td>" +
        "</tr>"
      );
    }).join("");
    if (!notifications.length) tbNotes.innerHTML = '<tr><td colspan="5" class="hint">No notification log rows</td></tr>';
  }
}

(function wireReportFilters() {
  ["report-preset", "report-incidents-days", "report-reviews-days", "report-kpi-max-incidents", "report-kpi-min-revenue", "report-kpi-max-active-tickets"].forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", function () {
      loadReportsPanel().catch(function (e) {
        if (typeof console !== "undefined" && console.error) console.error(e);
      });
    });
    if (id.indexOf("report-kpi-") === 0) {
      let debounceT;
      el.addEventListener("input", function () {
        clearTimeout(debounceT);
        debounceT = setTimeout(function () {
          loadReportsPanel().catch(function (e) {
            if (typeof console !== "undefined" && console.error) console.error(e);
          });
        }, 450);
      });
    }
  });
})();

async function downloadReportPdf() {
  await ensureApiReady(false);
  const url = API + "/reports/pdf?" + reportSnapshotQueryString().toString();
  const res = await fetch(url, { method: "GET", credentials: fetchCredentials(), cache: "no-store" });
  const ct = (res.headers && res.headers.get("content-type")) || "";
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const j = JSON.parse(text);
      if (j && j.error) msg = j.error;
    } catch (e) { /* ignore */ }
    throw new Error(msg || res.statusText);
  }
  if (!ct.includes("pdf")) {
    const text = await res.text();
    throw new Error(text.slice(0, 200) || "Expected PDF");
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "report-snapshot.pdf";
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("Downloaded report-snapshot.pdf");
}

const btnReportPdf = $("#btn-export-report-pdf");
if (btnReportPdf) {
  btnReportPdf.addEventListener("click", function () {
    downloadReportPdf().catch(function (e) {
      if (typeof console !== "undefined" && console.error) console.error(e);
      showToast(e && e.message ? e.message : "PDF download failed", true);
    });
  });
}

// ── Maintenance ──────────────────────────────────────────────────────────────
async function loadMaint() {
  const [alerts, assign] = await Promise.all([
    apiGet("/alerts"),
    apiGet("/maintenance-assignments"),
  ]);

  const ta = $("#tbody-alerts");
  if (ta) {
    ta.innerHTML = alerts.map(function (r) {
      return (
        '<tr data-alert-id="' + escapeHtml(r.AlertID) + '">' +
          '<td class="num">' + escapeHtml(r.AlertID)            + "</td>" +
          "<td>"             + escapeHtml(r.AttractionName)      + "</td>" +
          "<td>"             + escapeHtml(r.AttractionSeverity)  + "</td>" +
          "<td>"             + escapeHtml(r.AlertMessage)        + "</td>" +
          "<td>"             + escapeHtml(r.CreatedAt)           + "</td>" +
          '<td><button type="button" class="btn btn-small btn-ghost btn-resolve">Mark handled</button></td>' +
        "</tr>"
      );
    }).join("");
    if (!alerts.length) ta.innerHTML = '<tr><td colspan="6" class="hint">No open alerts</td></tr>';
  }

  const tb = $("#tbody-assign");
  if (tb) {
    tb.innerHTML = assign.map(function (r) {
      return (
        "<tr>" +
          '<td class="num">' + escapeHtml(r.MaintenanceAssignmentID)       + "</td>" +
          "<td>"             + escapeHtml(r.EmployeeName || r.EmployeeID)   + "</td>" +
          "<td>"             + escapeHtml(r.AreaName || "—")                + "</td>" +
          "<td>"             + escapeHtml(r.TaskDescription)                + "</td>" +
          "<td>"             + escapeHtml(r.Status)                        + "</td>" +
          "<td>"             + escapeHtml(r.DueDate || "—")                 + "</td>" +
          "<td>"             + escapeHtml(r.CreatedAt)                     + "</td>" +
        "</tr>"
      );
    }).join("");
    if (!assign.length) tb.innerHTML = '<tr><td colspan="7" class="hint">No assignments</td></tr>';
  }
}

// Delegated click — maintenance alerts
const panelMaint = document.getElementById("panel-maint");
if (panelMaint) {
  panelMaint.addEventListener("click", async function (ev) {
    const btn = ev.target.closest(".btn-resolve");
    if (!btn) return;
    const tr = btn.closest("tr");
    const id = tr && tr.dataset.alertId;
    if (!id) return;
    try {
      await apiPatch("/alerts/" + id + "/handled");
      showToast("Alert #" + id + " marked handled");
      await loadMaint();
      await loadDashboard();
    } catch (e) {
      showToast(e.message, true);
    }
  });
}

// Visitor ban / reactivate
const panelVisitors = document.getElementById("panel-visitors");
if (panelVisitors) {
  panelVisitors.addEventListener("click", async function (ev) {
    const ban = ev.target.closest(".btn-ban");
    const un = ev.target.closest(".btn-unban");
    if (!ban && !un) return;
    const tr = ev.target.closest("tr[data-visitor-id]");
    const vid = tr && tr.dataset.visitorId;
    if (!vid) return;
    try {
      await apiPatch("/visitors/" + vid, { isActive: !!un });
      showToast(un ? "Visitor #" + vid + " reactivated" : "Visitor #" + vid + " deactivated");
      await loadVisitorsPanel();
      await loadDashboard();
    } catch (e) {
      showToast(e.message, true);
    }
  });
}

// System configuration (parks, events, ticket prices, settings)
const panelSystem = document.getElementById("panel-system");
if (panelSystem) {
  panelSystem.addEventListener("click", async function (ev) {
    const savePark = ev.target.closest(".btn-system-save-park");
    if (savePark) {
      const tr = savePark.closest("tr[data-park-id]");
      const id = tr && tr.dataset.parkId;
      if (!id || !tr) return;
      const nameEl = tr.querySelector(".system-park-name");
      const locEl = tr.querySelector(".system-park-location");
      const openEl = tr.querySelector(".system-park-open");
      const closeEl = tr.querySelector(".system-park-close");
      const mapEl = tr.querySelector(".system-park-map");
      const actEl = tr.querySelector(".system-park-active");
      try {
        await apiPatch("/system/parks/" + id, {
          parkName: nameEl ? nameEl.value : "",
          locationText: locEl ? locEl.value : "",
          openingTime: openEl ? openEl.value : "",
          closingTime: closeEl ? closeEl.value : "",
          mapImageUrl: mapEl ? mapEl.value : "",
          isActive: actEl ? actEl.checked : true,
        });
        showToast("Park #" + id + " saved");
        await loadSystemPanel();
      } catch (e) {
        showToast(e.message, true);
      }
      return;
    }
    const applyTix = ev.target.closest(".btn-system-ticket-apply");
    if (applyTix) {
      const tr = applyTix.closest("tr[data-ticket-type]");
      const tt = tr && tr.dataset.ticketType;
      const inp = tr && tr.querySelector(".system-ticket-newprice");
      if (!tt || !inp) return;
      const price = Number(inp.value);
      if (!Number.isFinite(price) || price < 0) {
        showToast("Enter a valid price", true);
        return;
      }
      try {
        await apiPatch("/system/ticket-pricing", { ticketType: tt, price: price });
        showToast(tt + " tickets updated to " + price);
        await loadSystemPanel();
      } catch (e) {
        showToast(e.message, true);
      }
    }
  });

  const formEvent = $("#form-system-event");
  if (formEvent) {
    formEvent.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      const parkSel = $("#system-event-park-id");
      const pid = parkSel && parkSel.value ? parkSel.value.trim() : "";
      const body = {
        eventName: ($("#system-event-name") && $("#system-event-name").value) || "",
        eventDate: ($("#system-event-date") && $("#system-event-date").value) || "",
        eventDescription: ($("#system-event-desc") && $("#system-event-desc").value) || "",
        startTime: ($("#system-event-start") && $("#system-event-start").value) || "",
        endTime: ($("#system-event-end") && $("#system-event-end").value) || "",
      };
      if (pid) body.parkId = Number(pid);
      try {
        await apiPost("/system/special-events", body);
        showToast("Special event created");
        formEvent.reset();
        await loadSystemPanel();
      } catch (e) {
        showToast(e.message, true);
      }
    });
  }

  const formSettings = $("#form-system-settings");
  if (formSettings) {
    formSettings.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      try {
        await apiPatch("/system/settings", {
          backupsRpoRto: ($("#system-setting-backups") && $("#system-setting-backups").value) || "",
          notificationWebhookUrl: ($("#system-setting-webhook") && $("#system-setting-webhook").value) || "",
          notificationNotes: ($("#system-setting-notify-notes") && $("#system-setting-notify-notes").value) || "",
          brandingNotes: ($("#system-setting-branding") && $("#system-setting-branding").value) || "",
        });
        showToast("System settings saved");
      } catch (e) {
        showToast(e.message, true);
      }
    });
  }
}

// Attraction status (park-wide)
const panelPark = document.getElementById("panel-park");
if (panelPark) {
  panelPark.addEventListener("change", async function (ev) {
    const sel = ev.target.closest(".att-status-select");
    if (!sel) return;
    const id = sel.dataset.attId;
    const status = sel.value;
    const prev = sel.getAttribute("data-prev-status") || "";
    if (status === prev) return;
    try {
      await apiPatch("/attractions/" + id + "/status", { status: status });
      sel.setAttribute("data-prev-status", status);
      showToast("Attraction #" + id + " → " + status);
      await loadDashboard();
    } catch (e) {
      sel.value = prev;
      showToast(e.message, true);
    }
  });
}

// ── Retail ───────────────────────────────────────────────────────────────────
async function loadRetail() {
  const qEl = $("#retail-search-q");
  const q = qEl && qEl.value ? qEl.value.trim() : "";
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  const path = "/retail/items" + (q ? "?" + qs.toString() : "");
  const rows = await apiGet(path);
  const tb = $("#tbody-retail");
  if (!tb) return;
  tb.innerHTML = rows.map(function (r) {
    const low  = r.Quantity <= r.LowStockThreshold;
    const qcls = low ? "badge-warn" : "";
    const active = Number(r.IsActive) === 1;
    return (
      "<tr>" +
        "<td>" +
          escapeHtml(r.ItemName) +
          ' <span class="num">#' + escapeHtml(r.ItemID) +
          '</span> <span class="hint">RetailID ' + escapeHtml(r.RetailID) + "</span></td>" +
        "<td>"                          + escapeHtml(r.RetailName)                              + "</td>" +
        "<td>"                          + escapeHtml(r.AreaName || r.AreaID || "—")             + "</td>" +
        '<td class="num ' + qcls + '">' + escapeHtml(r.Quantity)                               + "</td>" +
        '<td class="num">'              + escapeHtml(r.LowStockThreshold)                       + "</td>" +
        '<td class="num">'              + escapeHtml(r.BuyPrice)                                + "</td>" +
        '<td class="num">'              + escapeHtml(r.SellPrice)                               + "</td>" +
        '<td class="num">'              + (r.DiscountPrice != null ? escapeHtml(r.DiscountPrice) : "—") + "</td>" +
        "<td>" + (active ? '<span class="badge-ok">Yes</span>' : '<span class="badge-warn">No</span>') + "</td>" +
      "</tr>"
    );
  }).join("");
  const emptyMsg = q ? "No items match your search." : "No items";
  if (!rows.length) tb.innerHTML = '<tr><td colspan="9" class="hint">' + emptyMsg + "</td></tr>";
}

async function loadVisitorsTickets() {
  const rows = await apiGet("/tickets/admin?limit=300");
  const tb = $("#tbody-visitor-tickets");
  if (!tb) return;
  tb.innerHTML = rows.map(function (r) {
    return (
      "<tr>" +
        '<td class="num">' + escapeHtml(r.TicketNumber) + "</td>" +
        "<td>" + escapeHtml(r.VisitorName) + "</td>" +
        "<td>" + escapeHtml(r.VisitorEmail) + "</td>" +
        "<td>" + escapeHtml(r.TicketType) + "</td>" +
        "<td>" + escapeHtml(r.DiscountFor || "None") + "</td>" +
        '<td class="num">' + escapeHtml(r.Price) + "</td>" +
        "<td>" + escapeHtml(r.IssueDate) + "</td>" +
        "<td>" + escapeHtml(r.ExpiryDate) + "</td>" +
        "<td>" + (Number(r.IsActive) === 1 ? "Yes" : "No") + "</td>" +
      "</tr>"
    );
  }).join("");
  if (!rows.length) tb.innerHTML = '<tr><td colspan="9" class="hint">No tickets</td></tr>';
}

// ── Refresh buttons ──────────────────────────────────────────────────────────
[
  ["#btn-refresh-dash", loadDashboard],
  ["#btn-refresh-users", loadUsersPanel],
  ["#btn-refresh-visitors", async function () {
    await loadVisitorsPanel();
    await loadVisitorsTickets();
  }],
  ["#btn-visitor-search", loadVisitorsPanel],
  ["#btn-hr-search", loadHrPanel],
  ["#btn-refresh-hr", loadHrPanel],
  ["#btn-refresh-maint", loadMaint],
  ["#btn-retail-search", loadRetail],
  ["#btn-refresh-retail", loadRetail],
  ["#btn-park-search", loadParkPanel],
  ["#btn-refresh-park", loadParkPanel],
  ["#btn-refresh-reports", loadReportsPanel],
  ["#btn-refresh-system", loadSystemPanel],
].forEach(function (pair) {
  const el = $(pair[0]);
  if (el) {
    el.addEventListener("click", function () {
      pair[1]().catch(function (e) {
        if (typeof console !== "undefined" && console.error) console.error(e);
      });
    });
  }
});

const vq = $("#visitor-search-q");
if (vq) {
  vq.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      loadVisitorsPanel()
        .then(function () { return loadVisitorsTickets(); })
        .catch(function (e) {
          if (typeof console !== "undefined" && console.error) console.error(e);
        });
    }
  });
}

const rq = $("#retail-search-q");
if (rq) {
  rq.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      loadRetail().catch(function (e) {
        if (typeof console !== "undefined" && console.error) console.error(e);
      });
    }
  });
}

const hrq = $("#hr-search-q");
if (hrq) {
  hrq.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      loadHrPanel().catch(function (e) {
        if (typeof console !== "undefined" && console.error) console.error(e);
      });
    }
  });
}

const pq = $("#park-search-q");
if (pq) {
  pq.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      loadParkPanel().catch(function (e) {
        if (typeof console !== "undefined" && console.error) console.error(e);
      });
    }
  });
}

async function exportVisitorsCsv() {
  const rows = await apiGet("/visitors?limit=5000&counts=0");
  downloadCsv("visitors-export.csv", rows, [
    { key: "VisitorID", label: "VisitorID" },
    { key: "Name", label: "Name" },
    { key: "Email", label: "Email" },
    { key: "Phone", label: "Phone" },
    { key: "Gender", label: "Gender" },
    { key: "Age", label: "Age" },
    { key: "IsActive", label: "IsActive" },
    { key: "CreatedAt", label: "CreatedAt" },
    { key: "TicketCount", label: "TicketCount" },
    { key: "ReviewCount", label: "ReviewCount" },
    { key: "RetailPurchaseCount", label: "RetailPurchaseCount" },
    { key: "OrderCount", label: "OrderCount" },
    { key: "ReservationCount", label: "ReservationCount" },
    { key: "VisitHistoryCount", label: "VisitHistoryCount" },
    { key: "PortalFeedbackCount", label: "PortalFeedbackCount" },
  ]);
  showToast("Downloaded visitors-export.csv");
}

async function exportTicketsCsv() {
  const rows = await apiGet("/tickets/admin?limit=500");
  downloadCsv("tickets-export.csv", rows, [
    { key: "TicketNumber", label: "TicketNumber" },
    { key: "VisitorName", label: "VisitorName" },
    { key: "VisitorEmail", label: "VisitorEmail" },
    { key: "TicketType", label: "TicketType" },
    { key: "DiscountFor", label: "DiscountFor" },
    { key: "Price", label: "Price" },
    { key: "IssueDate", label: "IssueDate" },
    { key: "ExpiryDate", label: "ExpiryDate" },
    { key: "IsActive", label: "IsActive" },
  ]);
  showToast("Downloaded tickets-export.csv");
}

async function exportVisitorReviewsCsv() {
  const rows = await apiGet("/reports/visitor-reviews?limit=10000");
  downloadCsv("visitor-reviews-export.csv", rows, [
    { key: "ReviewID", label: "ReviewID" },
    { key: "VisitorID", label: "VisitorID" },
    { key: "VisitorName", label: "VisitorName" },
    { key: "AreaID", label: "AreaID" },
    { key: "AreaName", label: "AreaName" },
    { key: "Rating", label: "Rating" },
    { key: "DateSubmitted", label: "DateSubmitted" },
    { key: "Comment", label: "Comment" },
  ]);
  showToast("Downloaded visitor-reviews-export.csv");
}

async function exportIncidentsCsv() {
  const rows = await apiGet("/incidents?limit=400");
  downloadCsv("incidents-export.csv", rows, [
    { key: "ReportID", label: "ReportID" },
    { key: "EmployeeName", label: "EmployeeName" },
    { key: "ReportType", label: "ReportType" },
    { key: "AttractionID", label: "AttractionID" },
    { key: "ItemID", label: "ItemID" },
    { key: "ReportDate", label: "ReportDate" },
    { key: "Description", label: "Description" },
  ]);
  showToast("Downloaded incidents-export.csv");
}

[
  ["#btn-export-visitors", exportVisitorsCsv],
  ["#btn-export-tickets", exportTicketsCsv],
  ["#btn-export-incidents", exportIncidentsCsv],
  ["#btn-export-visitor-reviews", exportVisitorReviewsCsv],
].forEach(function (pair) {
  const el = $(pair[0]);
  if (el) {
    el.addEventListener("click", function () {
      pair[1]().catch(function (e) {
        if (typeof console !== "undefined" && console.error) console.error(e);
        showToast(e && e.message ? e.message : "Export failed", true);
      });
    });
  }
});

// ── Boot ─────────────────────────────────────────────────────────────────────
loadDashboard().catch(function (e) {
  if (typeof console !== "undefined" && console.error) console.error(e);
});
