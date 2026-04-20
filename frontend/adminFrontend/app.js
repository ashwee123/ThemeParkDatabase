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

function panelSearchSelector(panelId) {
  return (
    "#" +
    panelId +
    " .table-wrap tbody tr, #" +
    panelId +
    " .stat-card, #" +
    panelId +
    " .report-chart-card, #" +
    panelId +
    " .checklist li"
  );
}

function applyPanelTextFilter(panelId, query) {
  const q = String(query || "").trim().toLowerCase();
  document.querySelectorAll(panelSearchSelector(panelId)).forEach(function (el) {
    const txt = (el.textContent || "").toLowerCase();
    const visible = !q || txt.indexOf(q) !== -1;
    el.classList.toggle("hidden-by-filter", !visible);
  });
}

function applyReportsFilter() {
  const panelId = "panel-reports";
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const searchEl = $("#search-reports");
  const selectEl = $("#reports-filter-type");
  const q = String(searchEl && searchEl.value ? searchEl.value : "").trim().toLowerCase();
  const category = selectEl && selectEl.value ? selectEl.value : "all";
  panel.querySelectorAll(".stat-card, .report-chart-card").forEach(function (card) {
    const txt = (card.textContent || "").toLowerCase();
    const raw = card.getAttribute("data-metric-type");
    const types =
      raw != null && String(raw).trim() !== ""
        ? String(raw).trim().split(/\s+/).filter(Boolean)
        : [];
    const matchesText = !q || txt.indexOf(q) !== -1;
    const matchesCategory =
      category === "all" || (types.length > 0 && types.indexOf(category) !== -1);
    card.classList.toggle("hidden-by-filter", !(matchesText && matchesCategory));
  });
}

function localYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function initReportsDateDefaults() {
  const fromEl = $("#reports-date-from");
  const toEl = $("#reports-date-to");
  if (!fromEl || !toEl) return;
  if (fromEl.value && toEl.value) return;
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  toEl.value = localYmd(to);
  fromEl.value = localYmd(from);
}

function setReportsPresetDays(days) {
  const toEl = $("#reports-date-to");
  const fromEl = $("#reports-date-from");
  if (!toEl || !fromEl) return;
  const n = Math.min(Math.max(Number(days) || 0, 1), 366);
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (n - 1));
  toEl.value = localYmd(to);
  fromEl.value = localYmd(from);
}

function updateReportsScopeUi() {
  const scope = $("#reports-data-scope");
  const fromEl = $("#reports-date-from");
  const toEl = $("#reports-date-to");
  const legacy = scope && scope.value === "legacy";
  if (fromEl) fromEl.disabled = !!legacy;
  if (toEl) toEl.disabled = !!legacy;
  document.querySelectorAll(".btn-reports-preset").forEach(function (b) {
    b.disabled = !!legacy;
  });
}

function buildReportsApiPath() {
  const scope = $("#reports-data-scope");
  if (scope && scope.value === "legacy") return "/reports/snapshot";
  const fromEl = $("#reports-date-from");
  const toEl = $("#reports-date-to");
  if (!fromEl || !toEl || !fromEl.value || !toEl.value) return "/reports/snapshot";
  return (
    "/reports/snapshot?from=" +
    encodeURIComponent(fromEl.value) +
    "&to=" +
    encodeURIComponent(toEl.value)
  );
}

let reportChartInstances = [];

function destroyReportCharts() {
  reportChartInstances.forEach(function (c) {
    try {
      c.destroy();
    } catch (e) {
      /* ignore */
    }
  });
  reportChartInstances = [];
}

function renderReportCharts(snap) {
  destroyReportCharts();
  if (snap.mode !== "range" || typeof Chart === "undefined") return;
  const axisColor = "rgba(224, 218, 204, 0.7)";
  const gridColor = "rgba(139, 0, 0, 0.12)";
  const font = { family: "'Crimson Text', serif", size: 12 };
  const commonScale = {
    ticks: { color: axisColor, font: font, maxTicksLimit: 12 },
    grid: { color: gridColor },
  };
  const series = snap.seriesDaily || [];
  const labels = series.map(function (r) {
    return r.day;
  });

  const elTickets = document.getElementById("chart-reports-tickets");
  if (elTickets) {
    reportChartInstances.push(
      new Chart(elTickets, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Tickets issued",
              data: series.map(function (r) {
                return r.ticketsIssued;
              }),
              borderColor: "rgba(197, 165, 114, 0.95)",
              backgroundColor: "rgba(197, 165, 114, 0.12)",
              fill: true,
              tension: 0.25,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: axisColor, font: font } } },
          scales: { x: commonScale, y: { ...commonScale, beginAtZero: true } },
        },
      })
    );
  }

  const elRetail = document.getElementById("chart-reports-retail");
  if (elRetail) {
    reportChartInstances.push(
      new Chart(elRetail, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Revenue",
              data: series.map(function (r) {
                return r.retailRevenue;
              }),
              backgroundColor: "rgba(139, 0, 0, 0.55)",
              borderColor: "rgba(139, 0, 0, 0.85)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: axisColor, font: font } } },
          scales: { x: commonScale, y: { ...commonScale, beginAtZero: true } },
        },
      })
    );
  }

  const elOps = document.getElementById("chart-reports-incidents-reviews");
  if (elOps) {
    reportChartInstances.push(
      new Chart(elOps, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Incidents",
              data: series.map(function (r) {
                return r.incidents;
              }),
              borderColor: "rgba(139, 0, 0, 0.9)",
              backgroundColor: "rgba(139, 0, 0, 0.08)",
              fill: true,
              tension: 0.25,
              yAxisID: "y",
            },
            {
              label: "Reviews",
              data: series.map(function (r) {
                return r.reviews;
              }),
              borderColor: "rgba(120, 160, 140, 0.95)",
              backgroundColor: "rgba(120, 160, 140, 0.1)",
              fill: true,
              tension: 0.25,
              yAxisID: "y1",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: axisColor, font: font } } },
          scales: {
            x: commonScale,
            y: {
              type: "linear",
              position: "left",
              beginAtZero: true,
              ticks: { color: axisColor, font: font },
              grid: { color: gridColor },
              title: { display: true, text: "Incidents", color: axisColor, font: font },
            },
            y1: {
              type: "linear",
              position: "right",
              beginAtZero: true,
              ticks: { color: axisColor, font: font },
              grid: { drawOnChartArea: false },
              title: { display: true, text: "Reviews", color: axisColor, font: font },
            },
          },
        },
      })
    );
  }

  const pieColors = [
    "rgba(197, 165, 114, 0.85)",
    "rgba(139, 0, 0, 0.75)",
    "rgba(120, 160, 140, 0.8)",
    "rgba(140, 140, 200, 0.8)",
    "rgba(200, 160, 120, 0.8)",
    "rgba(160, 160, 160, 0.75)",
  ];

  const elTypes = document.getElementById("chart-reports-ticket-types");
  if (elTypes && snap.ticketsByType && snap.ticketsByType.length) {
    reportChartInstances.push(
      new Chart(elTypes, {
        type: "pie",
        data: {
          labels: snap.ticketsByType.map(function (t) {
            return t.ticketType;
          }),
          datasets: [
            {
              data: snap.ticketsByType.map(function (t) {
                return t.count;
              }),
              backgroundColor: snap.ticketsByType.map(function (_t, i) {
                return pieColors[i % pieColors.length];
              }),
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom", labels: { color: axisColor, font: font } } },
        },
      })
    );
  }

  const elRetailTypes = document.getElementById("chart-reports-retail-types");
  if (elRetailTypes && snap.retailByType && snap.retailByType.length) {
    reportChartInstances.push(
      new Chart(elRetailTypes, {
        type: "doughnut",
        data: {
          labels: snap.retailByType.map(function (t) {
            return t.txType;
          }),
          datasets: [
            {
              data: snap.retailByType.map(function (t) {
                return t.count;
              }),
              backgroundColor: snap.retailByType.map(function (_t, i) {
                return pieColors[i % pieColors.length];
              }),
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom", labels: { color: axisColor, font: font } } },
        },
      })
    );
  }
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

const retryBackendBtn = $("#btn-backend-retry");
if (retryBackendBtn) {
  retryBackendBtn.addEventListener("click", function () {
    ensureApiReady(true)
      .then(function () {
        return loadDashboard();
      })
      .catch(function (e) {
        showToast(e.message, true);
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
  "dash", "users", "visitors", "retail", "hr", "maint", "park", "reports", "system", "security",
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
      system: function () { return Promise.resolve(); },
      security: loadSecurityPanel,
    };
    if (loaders[tab]) {
      loaders[tab]().catch(function (e) { showToast(e.message, true); });
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
    showToast(msg, true);
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
  const path = "/visitors" + (q ? "?q=" + encodeURIComponent(q) : "");
  const rows = await apiGet(path);
  const tb = $("#tbody-visitors");
  if (!tb) return;
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
        "<td>" +
          (active
            ? '<button type="button" class="btn btn-small btn-ghost btn-ban">Deactivate</button>'
            : '<button type="button" class="btn btn-small btn-ghost btn-unban">Reactivate</button>') +
        "</td>" +
      "</tr>"
    );
  }).join("");
  if (!rows.length) tb.innerHTML = '<tr><td colspan="9" class="hint">No visitors</td></tr>';
}

async function loadHrPanel() {
  const [emps, shifts, vrevs] = await Promise.all([
    apiGet("/employees"),
    apiGet("/shifts"),
    apiGet("/reports/visitor-reviews?limit=200"),
  ]);
  fillEmployeeTable("#tbody-hr-staff", emps);
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
    if (!shifts.length) ts.innerHTML = '<tr><td colspan="6" class="hint">No shifts</td></tr>';
  }
  const vr = $("#tbody-hr-visitor-reviews");
  if (vr) {
    vr.innerHTML = vrevs.map(function (r) {
      var comment = String(r.Comment || "").replace(/\s+/g, " ");
      if (comment.length > 120) comment = comment.slice(0, 117) + "…";
      return (
        "<tr>" +
          '<td class="num">' + escapeHtml(r.ReviewID) + "</td>" +
          "<td>" + escapeHtml(r.VisitorName || "—") + ' <span class="hint">#' + escapeHtml(r.VisitorID) + "</span></td>" +
          "<td>" + escapeHtml(r.AreaName || "—") + "</td>" +
          '<td class="num">' + escapeHtml(r.Rating) + "</td>" +
          "<td>" + escapeHtml(r.DateSubmitted || "—") + "</td>" +
          "<td>" + escapeHtml(comment) + "</td>" +
        "</tr>"
      );
    }).join("");
    if (!vrevs.length) vr.innerHTML = '<tr><td colspan="6" class="hint">No visitor reviews yet</td></tr>';
  }
}

async function loadParkPanel() {
  const [atts, areas] = await Promise.all([apiGet("/attractions"), apiGet("/areas")]);
  const wrap = $("#park-areas-list");
  if (wrap) {
    wrap.innerHTML = areas.map(function (a) {
      return '<span class="area-chip">' + escapeHtml(a.AreaName) + "</span>";
    }).join("");
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
  if (!atts.length) tb.innerHTML = '<tr><td colspan="7" class="hint">No attractions</td></tr>';
}

async function loadReportsPanel() {
  const path = buildReportsApiPath();
  const snap = await apiGet(path);
  const g = $("#report-snapshot-grid");
  const wrap = $("#report-charts-wrap");
  const summaryEl = $("#reports-range-summary");
  if (summaryEl) {
    if (snap.mode === "range" && snap.range) {
      summaryEl.classList.remove("hidden");
      summaryEl.textContent =
        "Period " + snap.range.from + " → " + snap.range.to + " (inclusive). Metrics below are limited to this window unless noted.";
    } else {
      summaryEl.classList.add("hidden");
      summaryEl.textContent = "";
    }
  }
  if (wrap) {
    if (snap.mode === "range") {
      wrap.classList.remove("hidden");
      renderReportCharts(snap);
    } else {
      wrap.classList.add("hidden");
      destroyReportCharts();
    }
  }
  if (g) {
    let cards;
    if (snap.mode === "range") {
      const avgRaw = snap.visitorReviewsAvgRating;
      const avgP =
        avgRaw != null && Number.isFinite(Number(avgRaw)) ? Number(avgRaw).toFixed(2) : "—";
      cards = [
        ["New visitor registrations", snap.visitorSignups, "visitor"],
        ["Active visitor accounts (now)", snap.visitorsActiveNow, "visitor"],
        ["Tickets issued (period)", snap.ticketsIssued, "ticket"],
        ["Active tickets issued in period", snap.ticketsActiveIssued, "ticket"],
        ["Retail transactions (period)", snap.retailTxCount, "retail"],
        ["Retail revenue (period)", snap.retailRevenue.toFixed(2), "retail"],
        ["Incidents (period)", snap.incidentsCount, "incident"],
        ["Visitor reviews (period)", snap.visitorReviewsCount ?? "—", "review"],
        ["Avg visitor rating (period, 1–10)", avgP, "review"],
      ];
    } else {
      const avgRaw = snap.visitorReviewsAvgRating30d;
      const avg30 =
        avgRaw != null && Number.isFinite(Number(avgRaw)) ? Number(avgRaw).toFixed(2) : "—";
      cards = [
        ["Visitors (total)", snap.visitorsTotal, "visitor"],
        ["Visitors (active accts)", snap.visitorsActive, "visitor"],
        ["Tickets issued", snap.ticketsTotal, "ticket"],
        ["Tickets active", snap.ticketsActive, "ticket"],
        ["Retail transactions", snap.retailTxCount, "retail"],
        ["Retail revenue (sum)", snap.retailRevenue.toFixed(2), "retail"],
        ["Incidents (90d)", snap.incidents90d, "incident"],
        ["Visitor reviews (total)", snap.visitorReviewsTotal ?? "—", "review"],
        ["Visitor reviews (30d)", snap.visitorReviewsLast30d ?? "—", "review"],
        ["Avg visitor rating (30d, 1–10)", avg30, "review"],
      ];
    }
    g.innerHTML = cards.map(function (c) {
      return (
        '<div class="stat-card" data-metric-type="' +
        escapeHtml(c[2]) +
        '"><div class="label">' +
        escapeHtml(c[0]) +
        '</div><div class="value">' +
        escapeHtml(c[1]) +
        "</div></div>"
      );
    }).join("");
    applyReportsFilter();
  }
}

async function loadSecurityPanel() {
  await Promise.all([loadIncidentsTable("#tbody-security-incidents"), loadWeatherTable("#tbody-security-weather")]);
  const notes = await apiGet("/notifications?limit=50");
  const tn = $("#tbody-security-notifications");
  if (tn) {
    tn.innerHTML = notes.map(function (r) {
      return (
        "<tr>" +
          '<td class="num">' + escapeHtml(r.NotificationID) + "</td>" +
          "<td>" + escapeHtml(r.Message) + "</td>" +
          "<td>" + escapeHtml(r.CreatedAt) + "</td>" +
        "</tr>"
      );
    }).join("");
    if (!notes.length) tn.innerHTML = '<tr><td colspan="3" class="hint">No rows</td></tr>';
  }
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
  const rows = await apiGet("/retail/items");
  const tb = $("#tbody-retail");
  if (!tb) return;
  tb.innerHTML = rows.map(function (r) {
    const low  = r.Quantity <= r.LowStockThreshold;
    const qcls = low ? "badge-warn" : "";
    return (
      "<tr>" +
        "<td>"                          + escapeHtml(r.ItemName) + ' <span class="num">#' + escapeHtml(r.ItemID) + "</span></td>" +
        "<td>"                          + escapeHtml(r.RetailName)                              + "</td>" +
        "<td>"                          + escapeHtml(r.AreaName || r.AreaID || "—")             + "</td>" +
        '<td class="num ' + qcls + '">' + escapeHtml(r.Quantity)                               + "</td>" +
        '<td class="num">'              + escapeHtml(r.LowStockThreshold)                       + "</td>" +
        '<td class="num">'              + escapeHtml(r.BuyPrice)                                + "</td>" +
        '<td class="num">'              + escapeHtml(r.SellPrice)                               + "</td>" +
        '<td class="num">'              + (r.DiscountPrice != null ? escapeHtml(r.DiscountPrice) : "—") + "</td>" +
      "</tr>"
    );
  }).join("");
  if (!rows.length) tb.innerHTML = '<tr><td colspan="8" class="hint">No items</td></tr>';
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

async function loadIncidentsTable(tbodySel) {
  const rows = await apiGet("/incidents?limit=150");
  const tb = $(tbodySel);
  if (!tb) return;
  tb.innerHTML = rows.map(function (r) {
    const full = r.Description || "";
    const desc = full.slice(0, 80) + (full.length > 80 ? "…" : "");
    return (
      "<tr>" +
        '<td class="num">' + escapeHtml(r.ReportID) + "</td>" +
        "<td>" + escapeHtml(r.EmployeeName || "—") + "</td>" +
        "<td>" + escapeHtml(r.ReportType) + "</td>" +
        '<td class="num">' + escapeHtml(r.AttractionID ?? "—") + "</td>" +
        '<td class="num">' + escapeHtml(r.ItemID ?? "—") + "</td>" +
        "<td>" + escapeHtml(r.ReportDate) + "</td>" +
        "<td>" + escapeHtml(desc) + "</td>" +
      "</tr>"
    );
  }).join("");
  if (!rows.length) tb.innerHTML = '<tr><td colspan="7" class="hint">No incidents</td></tr>';
}

async function loadWeatherTable(tbodySel) {
  const rows = await apiGet("/weather?limit=50");
  const tb = $(tbodySel);
  if (!tb) return;
  tb.innerHTML = rows.map(function (r) {
    return (
      "<tr>" +
        '<td class="num">' + escapeHtml(r.WeatherID) + "</td>" +
        "<td>" + escapeHtml(r.WeatherDate) + "</td>" +
        '<td class="num">' + escapeHtml(r.HighTemp ?? "—") + "</td>" +
        '<td class="num">' + escapeHtml(r.LowTemp ?? "—") + "</td>" +
        "<td>" + escapeHtml(r.SeverityLevel) + "</td>" +
        "<td>" + escapeHtml(r.AttractionOperationStatus) + "</td>" +
      "</tr>"
    );
  }).join("");
  if (!rows.length) tb.innerHTML = '<tr><td colspan="6" class="hint">No weather rows</td></tr>';
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
  ["#btn-refresh-hr", loadHrPanel],
  ["#btn-refresh-maint", loadMaint],
  ["#btn-refresh-retail", loadRetail],
  ["#btn-refresh-park", loadParkPanel],
  ["#btn-refresh-reports", loadReportsPanel],
  ["#btn-refresh-security", loadSecurityPanel],
].forEach(function (pair) {
  const el = $(pair[0]);
  if (el) {
    el.addEventListener("click", function () {
      pair[1]().catch(function (e) { showToast(e.message, true); });
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
        .catch(function (e) { showToast(e.message, true); });
    }
  });
}

document.querySelectorAll(".panel-search").forEach(function (input) {
  input.addEventListener("input", function () {
    const panelId = input.getAttribute("data-panel-target");
    if (!panelId) return;
    if (panelId === "panel-reports") {
      applyReportsFilter();
      return;
    }
    applyPanelTextFilter(panelId, input.value);
  });
});

const reportFilterType = $("#reports-filter-type");
if (reportFilterType) {
  reportFilterType.addEventListener("change", applyReportsFilter);
}

const reportScope = $("#reports-data-scope");
if (reportScope) {
  reportScope.addEventListener("change", function () {
    if (reportScope.value === "range") {
      initReportsDateDefaults();
    }
    updateReportsScopeUi();
    loadReportsPanel().catch(function (e) {
      showToast(e.message, true);
    });
  });
}

document.querySelectorAll(".btn-reports-preset").forEach(function (btn) {
  btn.addEventListener("click", function () {
    const days = parseInt(btn.getAttribute("data-days"), 10);
    if (!Number.isFinite(days)) return;
    setReportsPresetDays(days);
    const scope = $("#reports-data-scope");
    if (scope) scope.value = "range";
    updateReportsScopeUi();
    loadReportsPanel().catch(function (e) {
      showToast(e.message, true);
    });
  });
});

["reports-date-from", "reports-date-to"].forEach(function (id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("change", function () {
    const scope = $("#reports-data-scope");
    if (!scope || scope.value !== "range") return;
    loadReportsPanel().catch(function (e) {
      showToast(e.message, true);
    });
  });
});

initReportsDateDefaults();
updateReportsScopeUi();

async function exportVisitorsCsv() {
  const rows = await apiGet("/visitors?limit=500");
  downloadCsv("visitors-export.csv", rows, [
    { key: "VisitorID", label: "VisitorID" },
    { key: "Name", label: "Name" },
    { key: "Email", label: "Email" },
    { key: "Phone", label: "Phone" },
    { key: "Gender", label: "Gender" },
    { key: "Age", label: "Age" },
    { key: "IsActive", label: "IsActive" },
    { key: "CreatedAt", label: "CreatedAt" },
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
      pair[1]().catch(function (e) { showToast(e.message, true); });
    });
  }
});

// ── Boot ─────────────────────────────────────────────────────────────────────
loadDashboard().catch(function (e) { showToast(e.message, true); });
