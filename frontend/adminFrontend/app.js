"use strict";

const API = "/api";

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

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function apiGet(path) {
  const res = await fetch(API + path, { credentials: "same-origin" });
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
  return data;
}

async function apiPatch(path, body) {
  const opts = { method: "PATCH", credentials: "same-origin" };
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
  return data;
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
  const s = await apiGet("/summary");
  const grid = $("#stat-grid");
  if (!grid) return;
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
  const [emps, shifts] = await Promise.all([apiGet("/employees"), apiGet("/shifts")]);
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
  const snap = await apiGet("/reports/snapshot");
  const g = $("#report-snapshot-grid");
  if (g) {
    const cards = [
      ["Visitors (total)", snap.visitorsTotal],
      ["Visitors (active accts)", snap.visitorsActive],
      ["Tickets issued", snap.ticketsTotal],
      ["Tickets active", snap.ticketsActive],
      ["Retail transactions", snap.retailTxCount],
      ["Retail revenue (sum)", snap.retailRevenue.toFixed(2)],
      ["Incidents (90d)", snap.incidents90d],
    ];
    g.innerHTML = cards.map(function (c) {
      return (
        '<div class="stat-card"><div class="label">' + escapeHtml(c[0]) + '</div><div class="value">' +
        escapeHtml(c[1]) + "</div></div>"
      );
    }).join("");
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
