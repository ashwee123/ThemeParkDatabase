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

async function apiPatch(path) {
  const res = await fetch(API + path, { method: "PATCH", credentials: "same-origin" });
  const text = await res.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); }
    catch (e) { data = { error: text }; }
  }
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

// ── Panel switching ──────────────────────────────────────────────────────────
const PANELS = ["dash", "attractions", "staff", "maint", "retail", "incidents", "weather"];

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
      attractions: loadAttractions,
      staff: loadStaff,
      maint: loadMaint,
      retail: loadRetail,
      incidents: loadIncidents,
      weather: loadWeather,
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

// ── Attractions ──────────────────────────────────────────────────────────────
async function loadAttractions() {
  const rows = await apiGet("/attractions");
  const tb = $("#tbody-att");
  if (!tb) return;
  tb.innerHTML = rows.map(function (r) {
    return (
      "<tr>" +
        '<td class="num">' + escapeHtml(r.AttractionID)   + "</td>" +
        "<td>"             + escapeHtml(r.AttractionName)  + "</td>" +
        "<td>"             + escapeHtml(r.AttractionType)  + "</td>" +
        "<td>"             + escapeHtml(r.AreaName || "—") + "</td>" +
        "<td>"             + escapeHtml(r.Status)          + "</td>" +
        '<td class="num">' + escapeHtml(r.QueueCount)      + "</td>" +
        "<td>"             + escapeHtml(r.SeverityLevel)   + "</td>" +
      "</tr>"
    );
  }).join("");
  if (!rows.length) tb.innerHTML = '<tr><td colspan="7" class="hint">No rows</td></tr>';
}

// ── Staff ────────────────────────────────────────────────────────────────────
async function loadStaff() {
  const rows = await apiGet("/employees");
  const tb = $("#tbody-staff");
  if (!tb) return;
  tb.innerHTML = rows.map(function (r) {
    const area = r.AreaName != null ? r.AreaName : r.AreaID != null ? String(r.AreaID) : "—";
    return (
      "<tr>" +
        '<td class="num">' + escapeHtml(r.EmployeeID)                          + "</td>" +
        "<td>"             + escapeHtml(r.Name)                                 + "</td>" +
        "<td>"             + escapeHtml(r.Position)                             + "</td>" +
        '<td class="num">' + (r.Salary != null ? Number(r.Salary).toFixed(2) : "—") + "</td>" +
        "<td>"             + escapeHtml(r.HireDate || "—")                      + "</td>" +
        '<td class="num">' + escapeHtml(r.ManagerID ?? "—")                     + "</td>" +
        "<td>"             + escapeHtml(area)                                   + "</td>" +
      "</tr>"
    );
  }).join("");
  if (!rows.length) tb.innerHTML = '<tr><td colspan="7" class="hint">No rows</td></tr>';
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

// Delegated click — attached to the panel, not the tbody, so it always exists
document.getElementById("panel-maint").addEventListener("click", async function (ev) {
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

// ── Incidents ────────────────────────────────────────────────────────────────
async function loadIncidents() {
  const rows = await apiGet("/incidents?limit=150");
  const tb = $("#tbody-inc");
  if (!tb) return;
  tb.innerHTML = rows.map(function (r) {
    const full = r.Description || "";
    const desc = full.slice(0, 80) + (full.length > 80 ? "…" : "");
    return (
      "<tr>" +
        '<td class="num">' + escapeHtml(r.ReportID)               + "</td>" +
        "<td>"             + escapeHtml(r.EmployeeName || "—")     + "</td>" +
        "<td>"             + escapeHtml(r.ReportType)              + "</td>" +
        '<td class="num">' + escapeHtml(r.AttractionID ?? "—")     + "</td>" +
        '<td class="num">' + escapeHtml(r.ItemID ?? "—")           + "</td>" +
        "<td>"             + escapeHtml(r.ReportDate)              + "</td>" +
        "<td>"             + escapeHtml(desc)                      + "</td>" +
      "</tr>"
    );
  }).join("");
  if (!rows.length) tb.innerHTML = '<tr><td colspan="7" class="hint">No incidents</td></tr>';
}

// ── Weather ──────────────────────────────────────────────────────────────────
async function loadWeather() {
  const rows = await apiGet("/weather?limit=50");
  const tb = $("#tbody-weather");
  if (!tb) return;
  tb.innerHTML = rows.map(function (r) {
    return (
      "<tr>" +
        '<td class="num">' + escapeHtml(r.WeatherID)                    + "</td>" +
        "<td>"             + escapeHtml(r.WeatherDate)                   + "</td>" +
        '<td class="num">' + escapeHtml(r.HighTemp ?? "—")               + "</td>" +
        '<td class="num">' + escapeHtml(r.LowTemp ?? "—")                + "</td>" +
        "<td>"             + escapeHtml(r.SeverityLevel)                 + "</td>" +
        "<td>"             + escapeHtml(r.AttractionOperationStatus)     + "</td>" +
      "</tr>"
    );
  }).join("");
  if (!rows.length) tb.innerHTML = '<tr><td colspan="6" class="hint">No weather rows</td></tr>';
}

// ── Refresh buttons ──────────────────────────────────────────────────────────
[
  ["#btn-refresh-dash",    loadDashboard],
  ["#btn-refresh-att",     loadAttractions],
  ["#btn-refresh-staff",   loadStaff],
  ["#btn-refresh-maint",   loadMaint],
  ["#btn-refresh-retail",  loadRetail],
  ["#btn-refresh-inc",     loadIncidents],
  ["#btn-refresh-weather", loadWeather],
].forEach(function (pair) {
  const el = $(pair[0]);
  if (el) el.addEventListener("click", function () {
    pair[1]().catch(function (e) { showToast(e.message, true); });
  });
});

// ── Boot ─────────────────────────────────────────────────────────────────────
loadDashboard().catch(function (e) { showToast(e.message, true); });
