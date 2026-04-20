// frontend/maintenanceFrontend/portal.js
// NOTE: This file must be loaded as a plain script tag — no "type=module".
// Do NOT use import/export syntax anywhere in this file.

var API_BASE = "https://maintenance-4i7r.onrender.com";
var token    = localStorage.getItem("token");
if (!token) window.location.href = "/";

// ─── GLOBAL STATE ─────────────────────────────────────────────────────────
var allTasksData        = [];
var currentSortCol      = "";
var isAscending         = true;
var seenAlertIds        = {};
var hiddenTaskIds       = {};
var pendingDeleteId     = null;
var _dropdownsPopulated = false;

var pieChartInstance = null;
var barChartInstance = null;
var calendarInstance = null;

// ─── SAFE HELPERS ─────────────────────────────────────────────────────────
function toArray(val) {
  if (Array.isArray(val)) return val;
  return [];
}

function unwrap(body) {
  if (body === null || body === undefined) return null;
  if (typeof body === "object" && "success" in body) return body.data ?? null;
  return body;
}

// ─── AUTH FETCH ───────────────────────────────────────────────────────────
async function authFetch(path, opts) {
  opts = opts || {};
  var headers = Object.assign(
    { "Content-Type": "application/json", "Authorization": "Bearer " + token },
    opts.headers || {}
  );
  var res = await fetch(API_BASE + path, Object.assign({}, opts, { headers: headers }));
  var body;
  try { body = await res.json(); }
  catch (e) { throw new Error("Non-JSON response from " + path); }
  if (res.status === 401) { logout(); throw new Error("Unauthorized"); }
  if (!res.ok) {
    var errMsg = (body && (body.error || body.message)) || ("Request failed: " + res.status);
    console.error("API error on " + path + ":", body);
    throw new Error(errMsg);
  }
  return unwrap(body);
}

// ─── BOOT ─────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {

  var dueDateInput = document.getElementById("due-date-input");
  if (dueDateInput) dueDateInput.min = new Date().toISOString().split("T")[0];

  document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
      document.querySelectorAll(".panel").forEach(function (p) { p.classList.remove("active"); });
      tab.classList.add("active");
      var panel = document.getElementById("panel-" + tab.dataset.tab);
      if (!panel) return;
      panel.classList.add("active");
      var t = tab.dataset.tab;
      if      (t === "performance")   loadEmployeePerformance();
      else if (t === "reports")       initReports();
      else if (t === "schedule")      loadScheduleCalendar();
      else if (t === "notifications") loadNotifications();
      else                            loadTasks();
    });
  });

  document.querySelectorAll(".report-subtab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".report-subtab").forEach(function (b) { b.classList.remove("active"); });
      document.querySelectorAll(".report-panel").forEach(function (p) { p.classList.remove("active"); });
      btn.classList.add("active");
      var panel = document.getElementById("report-" + btn.dataset.report);
      if (panel) panel.classList.add("active");
      loadReportByKey(btn.dataset.report);
    });
  });

  var refreshBtn = document.getElementById("refresh-reports-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", function () {
      var activeBtn = document.querySelector(".report-subtab.active");
      if (activeBtn) loadReportByKey(activeBtn.dataset.report);
    });
  }

  populateDropdowns();

  var form = document.getElementById("form-add-task");
  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var dueDate = fd.get("DueDate");
      if (dueDate && dueDate < new Date().toISOString().split("T")[0]) {
        showToast("Due date cannot be in the past.", "error"); return;
      }
      try {
        await authFetch("/addTask", {
          method: "POST",
          body: JSON.stringify({
            EmployeeID: fd.get("EmployeeID") || null, AreaID: fd.get("AreaID") || null,
            AttractionID: fd.get("AttractionID") || null, TaskDescription: fd.get("TaskDescription"),
            Status: fd.get("Status"), DueDate: dueDate || null,
          }),
        });
        showToast("Task assigned successfully.");
        e.target.reset();
        if (dueDateInput) dueDateInput.min = new Date().toISOString().split("T")[0];
        loadTasks();
      } catch (err) { showToast(err.message || "Failed to assign task.", "error"); }
    });
  }

  var editForm = document.getElementById("form-edit-task");
  if (editForm) {
    editForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      var id   = document.getElementById("edit-task-id").value;
      var task = allTasksData.find(function (t) { return t.MaintenanceAssignmentID == id; });
      try {
        await authFetch("/updateTask", {
          method: "POST",
          body: JSON.stringify({
            MaintenanceAssignmentID: id,
            EmployeeID:      document.getElementById("edit-employee").value || (task && task.EmployeeID),
            AreaID:          document.getElementById("edit-area").value     || (task && task.AreaID),
            TaskDescription: document.getElementById("edit-description").value,
            Status:          document.getElementById("edit-status").value,
            DueDate:         document.getElementById("edit-due-date").value || null,
          }),
        });
        showToast("Task updated."); closeModal("edit-modal"); loadTasks();
      } catch (err) { showToast(err.message || "Failed to update task.", "error"); }
    });
  }

  var logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  loadTasks(); loadNotifications(); loadAlerts();
  setInterval(loadAlerts, 15000);

  var scheduleTab = document.querySelector('[data-tab="schedule"]');
  if (scheduleTab) scheduleTab.click();
});

// ─── AUTH ─────────────────────────────────────────────────────────────────
function logout() { localStorage.removeItem("token"); window.location.href = "/"; }

// ─── DROPDOWNS ────────────────────────────────────────────────────────────
async function populateDropdowns() {
  if (_dropdownsPopulated) return;
  _dropdownsPopulated = true;
  try {
    var results = await Promise.all([
      authFetch("/employees"), authFetch("/areas"), authFetch("/attractions"),
    ]);
    var employees   = toArray(results[0]);
    var areas       = toArray(results[1]);
    var attractions = toArray(results[2]);

    fillSelect("select-employee",        employees,   "EmployeeID",   function (e) { return e.Name + " (" + (e.Position || "Staff") + ")"; });
    fillSelect("select-area",            areas,       "AreaID",       function (a) { return a.AreaName; }, true);
    fillSelect("select-attraction",      attractions, "AttractionID", function (a) { return a.AttractionName; }, true);
    fillSelect("edit-employee",          employees,   "EmployeeID",   function (e) { return e.Name + " (" + (e.Position || "Staff") + ")"; });
    fillSelect("edit-area",              areas,       "AreaID",       function (a) { return a.AreaName; }, true);
    fillSelect("ts-filter-area",         areas,       "AreaID",       function (a) { return a.AreaName; }, true);
    fillSelect("ts-filter-employee",     employees,   "EmployeeID",   function (e) { return e.Name; }, true);
    fillSelect("mh-filter-attraction",   attractions, "AttractionID", function (a) { return a.AttractionName; }, true);
    fillSelect("mh-filter-area",         areas,       "AreaID",       function (a) { return a.AreaName; }, true);
    fillSelect("mh-filter-employee-mh",  employees,   "EmployeeID",   function (e) { return e.Name; }, true);
    fillSelect("perf-filter-area",       areas,       "AreaID",       function (a) { return a.AreaName; }, true);
    fillSelect("tasks-filter-area",      areas,       "AreaID",       function (a) { return a.AreaName; }, true);
    fillSelect("tasks-filter-employee",  employees,   "EmployeeID",   function (e) { return e.Name; }, true);

    // Position filter from actual employee data
    var positions = [];
    employees.forEach(function (e) {
      if (e.Position && positions.indexOf(e.Position) === -1) positions.push(e.Position);
    });
    positions.sort();
    var perfPosSel = document.getElementById("perf-filter-position");
    if (perfPosSel) {
      positions.forEach(function (p) {
        var opt = document.createElement("option");
        opt.value = p; opt.textContent = p; perfPosSel.appendChild(opt);
      });
    }
  } catch (err) { console.error("populateDropdowns:", err); }
}

function fillSelect(id, data, valueKey, labelFn, addBlank) {
  var el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = addBlank ? '<option value="">All</option>' : "";
  toArray(data).forEach(function (item) {
    var opt = document.createElement("option");
    opt.value = item[valueKey]; opt.textContent = labelFn(item); el.appendChild(opt);
  });
}

// ─── TASKS ────────────────────────────────────────────────────────────────
async function loadTasks() {
  try {
    var data = await authFetch("/tasks");
    allTasksData = toArray(data);
    applyTaskFilters();
  } catch (err) { console.error("loadTasks:", err); }
}

function applyTaskFilters() {
  var filterArea     = (document.getElementById("tasks-filter-area")     || {}).value || "";
  var filterEmployee = (document.getElementById("tasks-filter-employee") || {}).value || "";
  var filterStatus   = (document.getElementById("tasks-filter-status")   || {}).value || "";
  var filterOverdue  = (document.getElementById("tasks-filter-overdue")  || {}).value || "";
  var filterKeyword  = ((document.getElementById("tasks-filter-keyword") || {}).value || "").toLowerCase().trim();

  var filtered = allTasksData.filter(function (t) {
    if (hiddenTaskIds[t.MaintenanceAssignmentID]) return false;
    if (filterArea     && String(t.AreaID)     !== String(filterArea))     return false;
    if (filterEmployee && String(t.EmployeeID) !== String(filterEmployee)) return false;
    if (filterStatus   && t.Status             !== filterStatus)           return false;
    if (filterOverdue === "1" && !t.IsOverdue)                             return false;
    if (filterKeyword  && !(t.TaskDescription || "").toLowerCase().includes(filterKeyword)) return false;
    return true;
  });
  renderTables(filtered);
}

function renderTables(dataList) {
  var tbodyAll = document.getElementById("tbody-tasks");
  if (tbodyAll) tbodyAll.innerHTML = "";
  var visible = toArray(dataList);
  if (tbodyAll && !visible.length) {
    tbodyAll.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:20px;">No tasks to display.</td></tr>';
    return;
  }
  visible.forEach(function (task) {
    var sc        = "status-" + task.Status.replace(/\s+/g, "").toLowerCase();
    var cleanDesc = (task.TaskDescription || "").replace(/'/g, "\\'").replace(/\n/g, " ");
    var preview   = (task.TaskDescription || "").substring(0, 40);
    var empName   = (task.EmployeeName || "").replace(/'/g, "\\'");
    var overdueFlag = task.IsOverdue ? ' <span style="color:var(--blood-light);font-size:0.75rem;font-weight:600;">⚠ Overdue</span>' : "";
    var row = '<tr onclick="showTaskDetails(\'' + empName + '\',\'' + cleanDesc + '\')" style="cursor:pointer;">'
      + "<td>" + task.MaintenanceAssignmentID + "</td>"
      + "<td><strong>" + (task.EmployeeName || "—") + "</strong></td>"
      + "<td>" + (task.AreaName || "—") + "</td>"
      + "<td>" + preview + (preview.length === 40 ? "…" : "") + "</td>"
      + '<td><span class="status ' + sc + '">' + task.Status + "</span></td>"
      + "<td>" + (task.DueDate || "—") + overdueFlag + "</td>"
      + '<td onclick="event.stopPropagation()">'
      + '<button class="btn btn-ghost btn-small" onclick="openEditModal(' + task.MaintenanceAssignmentID + ')">Edit</button> '
      + '<button class="btn btn-danger btn-small" onclick="openDeleteModal(' + task.MaintenanceAssignmentID + ')">Delete</button>'
      + "</td></tr>";
    if (tbodyAll) tbodyAll.innerHTML += row;
  });
}

function resetTaskFilters() {
  ["tasks-filter-area","tasks-filter-employee","tasks-filter-status","tasks-filter-overdue","tasks-filter-keyword"].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.value = "";
  });
  currentSortCol = ""; isAscending = true;
  document.querySelectorAll(".data-table th").forEach(function (th) { th.classList.remove("active-sort","asc","desc"); });
  applyTaskFilters();
}

function resetTable() { resetTaskFilters(); }

// ─── MODALS ───────────────────────────────────────────────────────────────
function openEditModal(id) {
  var task = allTasksData.find(function (t) { return t.MaintenanceAssignmentID === id; });
  if (!task) return;
  document.getElementById("edit-task-id").value    = id;
  document.getElementById("edit-description").value = task.TaskDescription || "";
  document.getElementById("edit-due-date").value    = task.DueDate || "";
  var statusSel = document.getElementById("edit-status");
  Array.from(statusSel.options).forEach(function (o) { o.selected = o.value === task.Status; });
  if (task.EmployeeID) {
    var empSel = document.getElementById("edit-employee");
    Array.from(empSel.options).forEach(function (o) { o.selected = o.value == task.EmployeeID; });
  }
  openModal("edit-modal");
}

function openDeleteModal(id) {
  var task = allTasksData.find(function (t) { return t.MaintenanceAssignmentID === id; });
  if (!task) return;
  pendingDeleteId = id;
  document.getElementById("delete-task-preview").textContent =
    "Task #" + id + " · " + (task.EmployeeName || "Unknown") + " · \"" + (task.TaskDescription || "").substring(0, 60) + "…\"";
  openModal("delete-modal");
}

function confirmDelete() {
  if (pendingDeleteId == null) return;
  hiddenTaskIds[pendingDeleteId] = true;
  showToast("Task hidden from view. Database record preserved.", "error");
  pendingDeleteId = null; closeModal("delete-modal"); applyTaskFilters();
}

function openModal(id) {
  var m = document.getElementById(id); if (!m) return;
  m.style.display = "flex";
  requestAnimationFrame(function () { requestAnimationFrame(function () { m.classList.add("modal-visible"); }); });
}

function closeModal(id) {
  var m = document.getElementById(id); if (!m) return;
  m.classList.remove("modal-visible");
  setTimeout(function () { m.style.display = "none"; }, 250);
}

function showTaskDetails(employee, description) {
  document.getElementById("modal-employee").textContent    = "DATA FILE: " + employee.toUpperCase();
  document.getElementById("modal-description").textContent = description;
  openModal("task-modal");
}

// ─── EMPLOYEE PERFORMANCE ─────────────────────────────────────────────────
async function loadEmployeePerformance() {
  var cards = document.getElementById("perf-stat-cards");
  var tbody = document.getElementById("tbody-performance");
  if (!tbody) return;
  try {
    var data = toArray(await authFetch("/employee-performance"));

    var filterArea     = (document.getElementById("perf-filter-area")      || {}).value || "";
    var filterPosition = (document.getElementById("perf-filter-position")  || {}).value || "";
    var filterMinRate  = parseInt((document.getElementById("perf-filter-min-rate")  || {}).value || "0", 10) || 0;
    var filterOverdue  = (document.getElementById("perf-filter-overdue")   || {}).value || "";
    var filterMinTasks = parseInt((document.getElementById("perf-filter-min-tasks") || {}).value || "0", 10) || 0;

    var filtered = data.filter(function (row) {
      if (filterArea     && String(row.AreaID) !== String(filterArea)) return false;
      if (filterPosition && row.Position       !== filterPosition)      return false;
      if (filterOverdue === "1" && Number(row.overdue || 0) === 0)      return false;
      var total = Number(row.totalTasks || 0);
      var rate  = total > 0 ? Math.round((Number(row.completed || 0) / total) * 100) : 0;
      if (filterMinRate  > 0 && rate  < filterMinRate)  return false;
      if (filterMinTasks > 0 && total < filterMinTasks) return false;
      return true;
    });

    var totalStaff     = filtered.length;
    var totalCompleted = filtered.reduce(function (s, r) { return s + Number(r.completed  || 0); }, 0);
    var totalOverdue   = filtered.reduce(function (s, r) { return s + Number(r.overdue    || 0); }, 0);
    var totalTasks     = filtered.reduce(function (s, r) { return s + Number(r.totalTasks || 0); }, 0);
    var avgRate        = totalTasks ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    if (cards) {
      cards.innerHTML =
        '<div class="perf-card"><h3>Staff Members</h3><p class="stat-number">' + totalStaff + "</p></div>"
        + '<div class="perf-card"><h3>Total Tasks Assigned</h3><p class="stat-number">' + totalTasks + "</p></div>"
        + '<div class="perf-card"><h3>Team Completion Rate</h3><p class="stat-number" style="color:#2ecc71">' + avgRate + "%</p></div>"
        + '<div class="perf-card"><h3>Overdue Across Team</h3><p class="stat-number" style="color:var(--blood-light)">' + totalOverdue + "</p></div>";
    }

    tbody.innerHTML = "";
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-dim);padding:20px;">No employees match filters.</td></tr>';
      return;
    }
    filtered.forEach(function (row) {
      var total = Number(row.totalTasks || 0);
      var rate  = total > 0 ? Math.round((Number(row.completed || 0) / total) * 100) : 0;
      var rc    = rate >= 75 ? "#2ecc71" : rate >= 40 ? "var(--gold)" : "var(--blood-light)";
      tbody.innerHTML +=
        "<tr>"
        + "<td><strong>" + row.Name + "</strong></td>"
        + "<td>" + (row.Position || "—") + "</td>"
        + "<td>" + (row.AreaName || "—") + "</td>"
        + "<td>" + total + "</td>"
        + '<td style="color:#2ecc71">'            + (row.completed  || 0) + "</td>"
        + '<td style="color:var(--gold)">'        + (row.inProgress || 0) + "</td>"
        + '<td style="color:var(--ember)">'       + (row.pending    || 0) + "</td>"
        + '<td style="color:var(--blood-light)">' + (row.overdue    || 0) + "</td>"
        + '<td style="color:' + rc + ';font-weight:600">' + rate + "%</td>"
        + "</tr>";
    });
  } catch (err) { console.error("loadEmployeePerformance:", err); }
}

// ─── REPORTS ROUTER ───────────────────────────────────────────────────────
function initReports() {
  var activeBtn = document.querySelector(".report-subtab.active");
  loadReportByKey(activeBtn ? activeBtn.dataset.report : "task-summary");
}

function loadReportByKey(key) {
  if      (key === "task-summary")        loadTaskSummary();
  else if (key === "maintenance-history") loadMaintenanceHistory();
}

// ─── REPORT: TASK SUMMARY ─────────────────────────────────────────────────
async function loadTaskSummary() {
  try {
    var payload = await authFetch("/task-summary");
    var stats   = toArray(payload && payload.stats);
    var overdue = Number((payload && payload.overdue) || 0);
    var byArea  = toArray(payload && payload.byArea);

    var cards = document.getElementById("task-summary-cards");
    if (cards) {
      var total  = stats.reduce(function (s, r) { return s + Number(r.count || 0); }, 0);
      var done   = stats.find(function (r) { return r.Status === "Completed"; });
      var inProg = stats.find(function (r) { return r.Status === "In Progress"; });
      var pend   = stats.find(function (r) { return r.Status === "Pending"; });
      var rate   = total ? Math.round((Number((done && done.count) || 0) / total) * 100) : 0;
      cards.innerHTML =
        '<div class="perf-card"><h3>Total Tasks</h3><p class="stat-number">' + total + "</p></div>"
        + '<div class="perf-card"><h3>Completed</h3><p class="stat-number" style="color:#2ecc71">'        + ((done   && done.count)   || 0) + "</p></div>"
        + '<div class="perf-card"><h3>In Progress</h3><p class="stat-number" style="color:var(--gold)">' + ((inProg && inProg.count) || 0) + "</p></div>"
        + '<div class="perf-card"><h3>Pending</h3><p class="stat-number" style="color:var(--ember)">'    + ((pend   && pend.count)   || 0) + "</p></div>"
        + '<div class="perf-card"><h3>Overdue</h3><p class="stat-number" style="color:var(--blood-light)">' + overdue + "</p></div>"
        + '<div class="perf-card"><h3>Completion Rate</h3><p class="stat-number" style="color:#2ecc71">' + rate + "%</p></div>";
    }
    renderPieChart(stats);
    renderBarChart(byArea);
    loadTaskSummaryTable();
  } catch (err) { console.error("loadTaskSummary:", err); }
}

async function loadTaskSummaryTable() {
  var tbody = document.getElementById("tbody-task-summary");
  if (!tbody) return;
  var params = new URLSearchParams();
  var status   = (document.getElementById("ts-filter-status")   || {}).value || "";
  var area     = (document.getElementById("ts-filter-area")     || {}).value || "";
  var employee = (document.getElementById("ts-filter-employee") || {}).value || "";
  var from     = (document.getElementById("ts-filter-from")     || {}).value || "";
  var to       = (document.getElementById("ts-filter-to")       || {}).value || "";
  var overdue  = (document.getElementById("ts-filter-overdue")  || {}).value || "";
  var keyword  = (document.getElementById("ts-filter-keyword")  || {}).value || "";
  if (status)   params.set("status",     status);
  if (area)     params.set("areaId",     area);
  if (employee) params.set("employeeId", employee);
  if (from)     params.set("from",       from);
  if (to)       params.set("to",         to);
  if (overdue)  params.set("overdue",    overdue);
  if (keyword)  params.set("keyword",    keyword);
  try {
    var rows = toArray(await authFetch("/tasks-filtered?" + params.toString()));
    tbody.innerHTML = "";
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:20px;">No tasks match filters.</td></tr>';
      return;
    }
    rows.forEach(function (t) {
      var sc = "status-" + t.Status.replace(/\s+/g, "").toLowerCase();
      var overdueFlag = t.IsOverdue ? ' <span style="color:var(--blood-light);font-size:0.75rem;">⚠</span>' : "";
      tbody.innerHTML += "<tr>"
        + "<td>" + t.MaintenanceAssignmentID + "</td>"
        + "<td>" + (t.EmployeeName || "—") + "</td>"
        + "<td>" + (t.AreaName || "—") + "</td>"
        + "<td>" + (t.TaskDescription || "").substring(0, 50) + "…</td>"
        + '<td><span class="status ' + sc + '">' + t.Status + "</span></td>"
        + "<td>" + (t.DueDate || "—") + overdueFlag + "</td>"
        + "</tr>";
    });
  } catch (err) { console.error("loadTaskSummaryTable:", err); }
}

function renderPieChart(taskStats) {
  var ctx = document.getElementById("chart-status-pie");
  if (!ctx || !taskStats.length) return;
  if (pieChartInstance) { pieChartInstance.destroy(); pieChartInstance = null; }
  var colorMap = { "Pending": "#d4580a", "In Progress": "#c9a84c", "Completed": "#2ecc71" };
  var labels = taskStats.map(function (s) { return s.Status; });
  var values = taskStats.map(function (s) { return Number(s.count || 0); });
  var colors = labels.map(function (l) { return colorMap[l] || "#5a4a3a"; });
  pieChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: { labels: labels, datasets: [{ data: values, backgroundColor: colors, borderColor: "#120e0a", borderWidth: 3 }] },
    options: {
      responsive: true, cutout: "65%",
      plugins: {
        legend: { position: "bottom", labels: { color: "#b0a898", font: { family: "'Crimson Text', serif", size: 13 }, padding: 16 } },
        tooltip: { backgroundColor: "#211a14", titleColor: "#c9a84c", bodyColor: "#d6cdb8", borderColor: "rgba(139,0,0,0.4)", borderWidth: 1 },
      },
    },
  });
}

function renderBarChart(byArea) {
  var ctx = document.getElementById("chart-area-bar");
  if (!ctx || !byArea.length) return;
  if (barChartInstance) { barChartInstance.destroy(); barChartInstance = null; }
  barChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: byArea.map(function (d) { return d.AreaName; }),
      datasets: [
        { label: "Pending",     data: byArea.map(function (d) { return Number(d.pending    || 0); }), backgroundColor: "rgba(212,88,10,0.75)",  borderRadius: 3 },
        { label: "In Progress", data: byArea.map(function (d) { return Number(d.inProgress || 0); }), backgroundColor: "rgba(201,168,76,0.75)", borderRadius: 3 },
        { label: "Completed",   data: byArea.map(function (d) { return Number(d.completed  || 0); }), backgroundColor: "rgba(46,204,113,0.75)", borderRadius: 3 },
        { label: "Overdue",     data: byArea.map(function (d) { return Number(d.overdue    || 0); }), backgroundColor: "rgba(139,0,0,0.75)",    borderRadius: 3 },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#b0a898", font: { family: "'Crimson Text', serif", size: 13 }, padding: 14 } },
        tooltip: { backgroundColor: "#211a14", titleColor: "#c9a84c", bodyColor: "#d6cdb8", borderColor: "rgba(139,0,0,0.4)", borderWidth: 1 },
      },
      scales: {
        x: { ticks: { color: "#b0a898", font: { family: "'Crimson Text', serif" } }, grid: { color: "rgba(139,0,0,0.1)" } },
        y: { beginAtZero: true, ticks: { color: "#b0a898", stepSize: 1 }, grid: { color: "rgba(139,0,0,0.1)" } },
      },
    },
  });
}

// ─── REPORT: MAINTENANCE HISTORY ──────────────────────────────────────────
async function loadMaintenanceHistory() {
  var tbody = document.getElementById("tbody-mh");
  var cards = document.getElementById("mh-summary-cards");
  if (!tbody) return;
  var params = new URLSearchParams();
  var sev     = (document.getElementById("mh-filter-severity")    || {}).value || "";
  var stat    = (document.getElementById("mh-filter-status")      || {}).value || "";
  var att     = (document.getElementById("mh-filter-attraction")  || {}).value || "";
  var areaId  = (document.getElementById("mh-filter-area")        || {}).value || "";
  var empId   = (document.getElementById("mh-filter-employee-mh") || {}).value || "";
  var from    = (document.getElementById("mh-filter-from")        || {}).value || "";
  var to      = (document.getElementById("mh-filter-to")          || {}).value || "";
  var ongoing = (document.getElementById("mh-filter-ongoing")     || {}).value || "";
  var keyword = (document.getElementById("mh-filter-keyword")     || {}).value || "";
  if (sev)    params.set("severity",     sev);
  if (stat)   params.set("status",       stat);
  if (att)    params.set("attractionId", att);
  if (areaId) params.set("areaId",       areaId);
  if (empId)  params.set("employeeId",   empId);
  if (from)   params.set("startDate",    from);
  if (to)     params.set("endDate",      to);
  if (keyword)params.set("keyword",      keyword);
  try {
    var rows = toArray(await authFetch("/maintenance-report?" + params.toString()));
    if (ongoing === "1") rows = rows.filter(function (r) { return !r.DateEnd; });
    if (cards) {
      var total        = rows.length;
      var high         = rows.filter(function (r) { return r.Severity === "High"; }).length;
      var ongoingCount = rows.filter(function (r) { return !r.DateEnd; }).length;
      var done         = rows.filter(function (r) { return r.Status === "Completed"; }).length;
      cards.innerHTML =
        '<div class="perf-card"><h3>Total Records</h3><p class="stat-number">' + total + "</p></div>"
        + '<div class="perf-card"><h3>High Severity</h3><p class="stat-number" style="color:var(--blood-light)">' + high + "</p></div>"
        + '<div class="perf-card"><h3>Ongoing</h3><p class="stat-number" style="color:var(--gold)">' + ongoingCount + "</p></div>"
        + '<div class="perf-card"><h3>Completed</h3><p class="stat-number" style="color:#2ecc71">' + done + "</p></div>";
    }
    tbody.innerHTML = "";
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-dim);padding:20px;">No records match filters.</td></tr>';
      return;
    }
    rows.forEach(function (row) {
      var sc = row.Severity === "High" ? "color:var(--blood-light)" : row.Severity === "Medium" ? "color:var(--ember)" : "color:var(--gold)";
      tbody.innerHTML += "<tr>"
        + "<td>" + row.MaintenanceID + "</td>"
        + "<td>" + (row.EmployeeName   || "—") + "</td>"
        + "<td>" + (row.AreaName       || "—") + "</td>"
        + "<td>" + (row.AttractionName || "—") + "</td>"
        + '<td style="' + sc + '">' + (row.Severity || "—") + "</td>"
        + "<td>" + (row.Status         || "—") + "</td>"
        + "<td>" + (row.DateStart      || "—") + "</td>"
        + "<td>" + (row.DateEnd        || "Ongoing") + "</td>"
        + "</tr>";
    });
  } catch (err) { console.error("loadMaintenanceHistory:", err); }
}

// ─── CSV EXPORT ───────────────────────────────────────────────────────────
function exportTableCSV(tbodyId, filename) {
  var tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  var thead = tbody.closest("table") && tbody.closest("table").querySelector("thead");
  var headers = [];
  if (thead) thead.querySelectorAll("th").forEach(function (th) { headers.push(th.textContent.trim()); });
  var rows = [headers];
  tbody.querySelectorAll("tr").forEach(function (tr) {
    var cells = [];
    tr.querySelectorAll("td").forEach(function (td) {
      cells.push('"' + td.textContent.trim().replace(/"/g, '""') + '"');
    });
    if (cells.length) rows.push(cells);
  });
  var csv  = rows.map(function (r) { return r.join(","); }).join("\r\n");
  var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement("a");
  a.href = url; a.download = filename + "-" + new Date().toISOString().split("T")[0] + ".csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
function exportPerformanceCSV() { exportTableCSV("tbody-performance", "employee-performance"); }

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────
async function loadNotifications() {
  var container = document.getElementById("notifications-list");
  if (!container) return;
  container.innerHTML = "<p style='color:var(--text-dim)'>Loading alerts…</p>";
  try {
    var payload = await authFetch("/notifications");
    var notifications = toArray(payload && payload.notifications);
    var badge = document.getElementById("notif-badge");
    if (badge) { badge.textContent = notifications.length || ""; badge.style.display = notifications.length ? "inline-block" : "none"; }
    if (!notifications.length) {
      container.innerHTML = "<p style='color:var(--text-dim);font-style:italic;'>No active alerts. All systems operational.</p>";
      return;
    }
    var iconMap = { weather: "🌩", overdue: "⏰", shutdown: "🔴", inspection: "🔧" };
    container.innerHTML = notifications.map(function (n) {
      return '<div class="notif-card notif-' + n.severity + '">'
        + '<div class="notif-icon">' + (iconMap[n.type] || "⚠️") + "</div>"
        + '<div class="notif-body"><p class="notif-title">' + n.title + '</p><p class="notif-detail">' + n.detail + "</p></div>"
        + '<span class="notif-severity">' + n.severity.toUpperCase() + "</span></div>";
    }).join("");
  } catch (err) {
    console.error("loadNotifications:", err);
    if (container) container.innerHTML = "<p style='color:var(--blood-light)'>Failed to load alerts.</p>";
  }
}

// ─── TOAST ALERTS ─────────────────────────────────────────────────────────
async function loadAlerts() {
  try {
    var alerts = toArray(await authFetch("/alerts"));
    alerts.forEach(function (alert) {
      if (!seenAlertIds[alert.AlertID]) {
        seenAlertIds[alert.AlertID] = true;
        showToast(alert.AlertMessage, alert.SeverityLevel === "Severe" ? "error" : "");
      }
    });
  } catch (err) { console.error("loadAlerts:", err); }
}

function showToast(message, type) {
  var container = document.getElementById("toast-container");
  if (!container) return;
  var div = document.createElement("div");
  div.className = "toast" + (type ? " " + type : "");
  div.textContent = message;
  container.appendChild(div);
  requestAnimationFrame(function () { requestAnimationFrame(function () { div.classList.add("show"); }); });
  setTimeout(function () { div.classList.remove("show"); setTimeout(function () { div.remove(); }, 300); }, 5000);
}

// ─── SCHEDULE CALENDAR ────────────────────────────────────────────────────
async function loadScheduleCalendar() {
  var calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;
  try {
    var tasks = toArray(await authFetch("/tasks"));
    if (calendarInstance) { calendarInstance.destroy(); calendarInstance = null; }
    var areaColorPalette = ["#8b0000","#c0392b","#d4580a","#c9a84c","#2980b9","#27ae60","#8e44ad","#16a085","#e67e22","#2c3e50"];
    var areaColorMap = {}; var areaColorIdx = 0;
    var today = new Date().toISOString().split("T")[0];
    var events = tasks
      .filter(function (t) { return t.DueDate && !hiddenTaskIds[t.MaintenanceAssignmentID]; })
      .map(function (t) {
        var areaKey = t.AreaName || "Unknown";
        if (!areaColorMap[areaKey]) { areaColorMap[areaKey] = areaColorPalette[areaColorIdx % areaColorPalette.length]; areaColorIdx++; }
        return { id: t.MaintenanceAssignmentID, title: (t.TaskDescription || "Task").substring(0, 28) + " · " + (t.EmployeeName || ""), start: t.DueDate, color: areaColorMap[areaKey], extendedProps: { task: t } };
      });
    calendarInstance = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth", events: events, height: "auto",
      headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,listWeek" },
      buttonText: { today: "Today", month: "Month", list: "List" },
      eventClick: function (info) { var t = info.event.extendedProps.task; showTaskDetails(t.EmployeeName || "Unknown", t.TaskDescription || ""); },
      eventDidMount: function (info) { if (info.event.startStr === today) info.el.classList.add("fc-event-today"); },
      dayMaxEvents: 3,
    });
    calendarInstance.render();
  } catch (err) { console.error("loadScheduleCalendar:", err); }
}

// ─── SORT ─────────────────────────────────────────────────────────────────
function toggleSort(column) {
  var activePanel = document.querySelector(".panel.active");
  if (!activePanel) return;
  var headers = activePanel.querySelectorAll(".data-table th");
  headers.forEach(function (th) { th.classList.remove("active-sort","asc","desc"); });
  if (currentSortCol === column) isAscending = !isAscending;
  else { currentSortCol = column; isAscending = true; }
  var clicked = Array.from(headers).find(function (th) { return th.innerText.toLowerCase().includes(column.toLowerCase()); });
  if (clicked) clicked.classList.add("active-sort", isAscending ? "asc" : "desc");
  var sorted = allTasksData.slice().sort(function (a, b) {
    if (column === "MaintenanceAssignmentID") return isAscending ? a[column] - b[column] : b[column] - a[column];
    var va = (a[column] || "").toString().toLowerCase();
    var vb = (b[column] || "").toString().toLowerCase();
    return isAscending ? va.localeCompare(vb) : vb.localeCompare(va);
  });
  renderTables(sorted);
}