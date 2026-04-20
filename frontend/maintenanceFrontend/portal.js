// frontend/maintenanceFrontend/portal.js

const API_BASE  = "https://maintenance-4i7r.onrender.com";
const token     = localStorage.getItem("token");
if (!token) window.location.href = "/";

// ─── GLOBAL STATE ──────────────────────────────────────────────────────────
let allTasksData   = [];
let currentSortCol = "";
let isAscending    = true;
let seenAlertIds   = new Set();
let hiddenTaskIds  = new Set();
let pendingDeleteId = null;

let pieChartInstance     = null;
let barChartInstance     = null;
let awBarChartInstance   = null;

// ─── WHITELIST ──────────────────────────────────────────────────────────────────
const allowedEmployeeIDs = new Set([
  128374, 992834, 445362, 112233, 666001,
  900800, 777111, 223344, 554433, 881122,
  334455, 998877, 123456, 654321, 111222,
  333444, 555666, 777888, 999000, 121212,
  343434, 565656, 787878, 909090, 212121, 434343
]);
// ─── BOOT ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {

  // Set min date on due-date input so past dates can't be picked
  const dueDateInput = document.getElementById("due-date-input");
  if (dueDateInput) dueDateInput.min = new Date().toISOString().split("T")[0];

  // Main tab switching
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      const panel = document.getElementById("panel-" + tab.dataset.tab);
      if (!panel) return;
      panel.classList.add("active");
      const t = tab.dataset.tab;
      if      (t === "performance")   loadEmployeePerformance();
      else if (t === "reports")       initReports();
      else if (t === "schedule")      loadScheduleCalendar();
      else if (t === "notifications") loadNotifications();
      else                            loadTasks();
    });
  });

  // Report sub-tab switching
  document.querySelectorAll(".report-subtab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".report-subtab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".report-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("report-" + btn.dataset.report)?.classList.add("active");
      loadReportByKey(btn.dataset.report);
    });
  });

  // Refresh button on reports
  document.getElementById("refresh-reports-btn")?.addEventListener("click", () => {
    const activeKey = document.querySelector(".report-subtab.active")?.dataset.report;
    if (activeKey) loadReportByKey(activeKey);
  });

  // Assign form — populate dropdowns and submit
  populateDropdowns();

  const form = document.getElementById("form-add-task");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);

      // Past-date guard (belt-and-suspenders on top of the min attribute)
      const dueDate = fd.get("DueDate");
      if (dueDate && dueDate < new Date().toISOString().split("T")[0]) {
        showToast("Due date cannot be in the past.", "error");
        return;
      }

      await authFetch("/addTask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          EmployeeID:      fd.get("EmployeeID")    || null,
          AreaID:          fd.get("AreaID")         || null,
          AttractionID:    fd.get("AttractionID")   || null,
          TaskDescription: fd.get("TaskDescription"),
          Status:          fd.get("Status"),
          DueDate:         dueDate || null,
        }),
      });
      showToast("Task assigned successfully.");
      e.target.reset();
      dueDateInput.min = new Date().toISOString().split("T")[0];
      loadTasks();
    });
  }

  // Edit form submit
  const editForm = document.getElementById("form-edit-task");
  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id   = document.getElementById("edit-task-id").value;
      const task = allTasksData.find((t) => t.MaintenanceAssignmentID == id);
      await authFetch("/updateTask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          MaintenanceAssignmentID: id,
          EmployeeID:    document.getElementById("edit-employee").value || task?.EmployeeID,
          AreaID:        document.getElementById("edit-area").value     || task?.AreaID,
          TaskDescription: document.getElementById("edit-description").value,
          Status:        document.getElementById("edit-status").value,
          DueDate:       document.getElementById("edit-due-date").value || null,
        }),
      });
      showToast("Task updated.");
      closeModal("edit-modal");
      loadTasks();
      await loadTasks();
      loadScheduleCalendar();
      loadEmployeePerformance();
      initReports();
    });
  }

  document.getElementById("btn-logout")?.addEventListener("click", logout);

  // Initial loads
  loadTasks();
  loadNotifications();
  loadAlerts();
  setInterval(loadAlerts, 15000);

  document.querySelector('[data-tab="schedule"]').click();
});

// ─── AUTH ──────────────────────────────────────────────────────────────────
function logout() { localStorage.removeItem("token"); window.location.href = "/"; }

async function authFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (res.status === 401) { logout(); throw new Error("Unauthorized"); }
  return res;
}

// ─── DROPDOWNS ─────────────────────────────────────────────────────────────
async function populateDropdowns() {
  try {
    const [empRes, areaRes, attRes] = await Promise.all([
      authFetch("/employees"), authFetch("/areas"), authFetch("/attractions"),
    ]);
    const [employees, areas, attractions] = await Promise.all([
      empRes.json(), areaRes.json(), attRes.json(),
    ]);

    fillSelect("select-employee",   employees,   "EmployeeID",   (e) => `${e.Name} (${e.Position || "Staff"})`);
    fillSelect("select-area",       areas,        "AreaID",       (a) => a.AreaName, true);
    fillSelect("select-attraction", attractions,  "AttractionID", (a) => a.AttractionName, true);
    fillSelect("edit-employee",     employees,   "EmployeeID",   (e) => `${e.Name} (${e.Position || "Staff"})`);
    fillSelect("edit-area",         areas,        "AreaID",       (a) => a.AreaName, true);

    // Populate report filter dropdowns
    fillSelect("ts-filter-area",     areas,       "AreaID",       (a) => a.AreaName, true);
    fillSelect("ts-filter-employee", employees,   "EmployeeID",   (e) => e.Name, true);
    fillSelect("mh-filter-attraction", attractions, "AttractionID", (a) => a.AttractionName, true);
  } catch (err) { console.error("populateDropdowns:", err); }
}

function fillSelect(id, data, valueKey, labelFn, addBlank = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = addBlank ? `<option value="">None</option>` : "";
  data.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item[valueKey];
    opt.textContent = labelFn(item);
    el.appendChild(opt);
  });
}

// ─── TASKS ─────────────────────────────────────────────────────────────────
async function loadTasks() {
  try {
    const res = await authFetch("/tasks");
    allTasksData = await res.json();
    renderTables(allTasksData);
  } catch (err) { console.error(err); }
}

function renderTables(dataList) {
  const tbodyAll   = document.getElementById("tbody-tasks");
  const tbodySched = document.getElementById("tbody-active-schedule");
  if (tbodyAll)   tbodyAll.innerHTML   = "";
  if (tbodySched) tbodySched.innerHTML = "";

  const visible = dataList.filter((t) => !hiddenTaskIds.has(t.MaintenanceAssignmentID));

  visible.forEach((task) => {
    const sc        = `status-${task.Status.replace(/\s+/g, "").toLowerCase()}`;
    const cleanDesc = (task.TaskDescription || "").replace(/'/g, "\\'");
    const preview   = (task.TaskDescription || "").substring(0, 40);

    const row = `
      <tr onclick="showTaskDetails('${task.EmployeeName}','${cleanDesc}')" style="cursor:pointer;">
        <td>${task.MaintenanceAssignmentID}</td>
        <td><strong>${task.EmployeeName || "—"}</strong></td>
        <td>${task.AreaName || "—"}</td>
        <td>${preview}${preview.length === 40 ? "…" : ""}</td>
        <td><span class="status ${sc}">${task.Status}</span></td>
        <td>${task.DueDate || "—"}</td>
        <td onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-small" onclick="openEditModal(${task.MaintenanceAssignmentID})">Edit</button>
          <button class="btn btn-danger btn-small" onclick="openDeleteModal(${task.MaintenanceAssignmentID})">Delete</button>
        </td>
      </tr>`;

    if (tbodyAll)   tbodyAll.innerHTML   += row;
    if (tbodySched && task.Status !== "Completed") tbodySched.innerHTML += row;
  });

  if (tbodyAll && !visible.length) {
    tbodyAll.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:20px;">No tasks to display.</td></tr>`;
  }
}

// ─── EDIT / DELETE MODALS ──────────────────────────────────────────────────
function openEditModal(id) {
  const task = allTasksData.find((t) => t.MaintenanceAssignmentID === id);
  if (!task) return;
  document.getElementById("edit-task-id").value    = id;
  document.getElementById("edit-description").value = task.TaskDescription || "";
  document.getElementById("edit-due-date").value   = task.DueDate || "";
  const statusSel = document.getElementById("edit-status");
  [...statusSel.options].forEach((o) => { o.selected = o.value === task.Status; });
  if (task.EmployeeID) {
    [...document.getElementById("edit-employee").options].forEach((o) => { o.selected = o.value == task.EmployeeID; });
  }
  openModal("edit-modal");
}

function openDeleteModal(id) {
  const task = allTasksData.find((t) => t.MaintenanceAssignmentID === id);
  if (!task) return;
  pendingDeleteId = id;
  document.getElementById("delete-task-preview").textContent =
    `Task #${id} · ${task.EmployeeName || "Unknown"} · "${(task.TaskDescription || "").substring(0, 60)}…"`;
  openModal("delete-modal");
}

function confirmDelete() {
  if (pendingDeleteId == null) return;
  hiddenTaskIds.add(pendingDeleteId);
  showToast("Task hidden from view. Database record preserved.", "error");
  pendingDeleteId = null;
  closeModal("delete-modal");
  renderTables(allTasksData);
}

function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.style.display = "flex"; requestAnimationFrame(() => m.classList.add("modal-visible")); }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove("modal-visible"); setTimeout(() => { m.style.display = "none"; }, 250); }
}
function showTaskDetails(employee, description) {
  document.getElementById("modal-employee").textContent    = `DATA FILE: ${employee.toUpperCase()}`;
  document.getElementById("modal-description").textContent = description;
  openModal("task-modal");
}

// ─── EMPLOYEE PERFORMANCE ──────────────────────────────────────────────────
async function loadEmployeePerformance() {
  const cards   = document.getElementById("perf-stat-cards");
  const tbody   = document.getElementById("tbody-performance");
  if (!tbody) return;

  try {
    const res  = await authFetch("/employee-performance");
    const data = await res.json();

    const totalStaff     = data.length;
    const totalCompleted = data.reduce((s, r) => s + Number(r.completed),  0);
    const totalOverdue   = data.reduce((s, r) => s + Number(r.overdue),    0);
    const totalTasks     = data.reduce((s, r) => s + Number(r.totalTasks), 0);
    const avgRate        = totalTasks ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    if (cards) {
      cards.innerHTML = `
        <div class="perf-card"><h3>Staff Members</h3><p class="stat-number">${totalStaff}</p></div>
        <div class="perf-card"><h3>Total Tasks Assigned</h3><p class="stat-number">${totalTasks}</p></div>
        <div class="perf-card"><h3>Team Completion Rate</h3><p class="stat-number" style="color:#2ecc71">${avgRate}%</p></div>
        <div class="perf-card"><h3>Overdue Across Team</h3><p class="stat-number" style="color:var(--blood-light)">${totalOverdue}</p></div>`;
    }

    tbody.innerHTML = "";
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text-dim);padding:20px;">No employee data.</td></tr>`;
      return;
    }

    data.forEach((row) => {
      const rate = row.totalTasks > 0 ? Math.round((row.completed / row.totalTasks) * 100) : 0;
      const rateColor = rate >= 75 ? "#2ecc71" : rate >= 40 ? "var(--gold)" : "var(--blood-light)";
      tbody.innerHTML += `
        <tr>
          <td><strong>${row.Name}</strong></td>
          <td>${row.Position || "—"}</td>
          <td>${row.AreaName || "—"}</td>
          <td>${row.totalTasks}</td>
          <td style="color:#2ecc71">${row.completed}</td>
          <td style="color:var(--gold)">${row.inProgress}</td>
          <td style="color:var(--ember)">${row.pending}</td>
          <td style="color:var(--blood-light)">${row.overdue}</td>
          <td style="color:${rateColor};font-weight:600">${rate}%</td>
        </tr>`;
    });
  } catch (err) { console.error(err); }
}

// ─── REPORTS — SUB-TAB ROUTER ──────────────────────────────────────────────
function initReports() {
  // Load whichever sub-tab is currently active (defaults to task-summary)
  const activeKey = document.querySelector(".report-subtab.active")?.dataset.report || "task-summary";
  loadReportByKey(activeKey);
}

function loadReportByKey(key) {
  switch (key) {
    case "task-summary":       loadTaskSummary();       break;
    case "maintenance-history": loadMaintenanceHistory(); break;
    case "area-workload":       loadAreaWorkload();       break;
  }
}

// ─── REPORT: TASK SUMMARY ──────────────────────────────────────────────────
async function loadTaskSummary() {
  // Fetch all task stats from the dedicated endpoint (counts every status correctly)
  try {
    const res  = await authFetch("/task-summary");
    const data = await res.json();

    // Summary cards
    const cards = document.getElementById("task-summary-cards");
    if (cards) {
      const total    = data.stats.reduce((s, r) => s + Number(r.count), 0);
      const done     = data.stats.find((r) => r.Status === "Completed");
      const inProg   = data.stats.find((r) => r.Status === "In Progress");
      const pend     = data.stats.find((r) => r.Status === "Pending");
      const rate     = total ? Math.round((Number(done?.count || 0) / total) * 100) : 0;

      cards.innerHTML = `
        <div class="perf-card"><h3>Total Tasks</h3><p class="stat-number">${total}</p></div>
        <div class="perf-card"><h3>Completed</h3><p class="stat-number" style="color:#2ecc71">${done?.count || 0}</p></div>
        <div class="perf-card"><h3>In Progress</h3><p class="stat-number" style="color:var(--gold)">${inProg?.count || 0}</p></div>
        <div class="perf-card"><h3>Pending</h3><p class="stat-number" style="color:var(--ember)">${pend?.count || 0}</p></div>
        <div class="perf-card"><h3>Overdue</h3><p class="stat-number" style="color:var(--blood-light)">${data.overdue}</p></div>
        <div class="perf-card"><h3>Completion Rate</h3><p class="stat-number" style="color:#2ecc71">${rate}%</p></div>`;
    }

    // Charts
    renderPieChart(data.stats);
    renderBarChart(data.byArea);

    // Load filterable table
    loadTaskSummaryTable();
  } catch (err) { console.error(err); }
}

async function loadTaskSummaryTable() {
  const tbody = document.getElementById("tbody-task-summary");
  if (!tbody) return;

  const params = new URLSearchParams();
  const status   = document.getElementById("ts-filter-status")?.value;
  const area     = document.getElementById("ts-filter-area")?.value;
  const employee = document.getElementById("ts-filter-employee")?.value;
  const from     = document.getElementById("ts-filter-from")?.value;
  const to       = document.getElementById("ts-filter-to")?.value;

  if (status)   params.set("status",     status);
  if (area)     params.set("areaId",     area);
  if (employee) params.set("employeeId", employee);
  if (from)     params.set("from",       from);
  if (to)       params.set("to",         to);

  try {
    const res  = await authFetch(`/tasks-filtered?${params}`);
    const data = await res.json();
    tbody.innerHTML = "";
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:20px;">No tasks match filters.</td></tr>`;
      return;
    }
    data.forEach((t) => {
      const sc = `status-${t.Status.replace(/\s+/g, "").toLowerCase()}`;
      tbody.innerHTML += `<tr>
        <td>${t.MaintenanceAssignmentID}</td>
        <td>${t.EmployeeName || "—"}</td>
        <td>${t.AreaName || "—"}</td>
        <td>${(t.TaskDescription || "").substring(0, 50)}…</td>
        <td><span class="status ${sc}">${t.Status}</span></td>
        <td>${t.DueDate || "—"}</td>
      </tr>`;
    });
  } catch (err) { console.error(err); }
}

function renderPieChart(taskStats) {
  const ctx = document.getElementById("chart-status-pie");
  if (!ctx) return;
  if (pieChartInstance) { pieChartInstance.destroy(); pieChartInstance = null; }
  const colorMap = { "Pending": "#d4580a", "In Progress": "#c9a84c", "Completed": "#2ecc71" };
  const labels = taskStats.map((s) => s.Status);
  const values = taskStats.map((s) => Number(s.count));
  const colors = labels.map((l) => colorMap[l] || "#5a4a3a");
  pieChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: "#120e0a", borderWidth: 3 }] },
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
  const ctx = document.getElementById("chart-area-bar");
  if (!ctx || !byArea?.length) return;
  if (barChartInstance) { barChartInstance.destroy(); barChartInstance = null; }
  barChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: byArea.map((d) => d.AreaName),
      datasets: [
        { label: "Pending",     data: byArea.map((d) => d.pending),    backgroundColor: "rgba(212,88,10,0.75)",  borderRadius: 3 },
        { label: "In Progress", data: byArea.map((d) => d.inProgress), backgroundColor: "rgba(201,168,76,0.75)", borderRadius: 3 },
        { label: "Completed",   data: byArea.map((d) => d.completed),  backgroundColor: "rgba(46,204,113,0.75)", borderRadius: 3 },
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
        y: { beginAtZero: true, ticks: { color: "#b0a898", font: { family: "'Crimson Text', serif" }, stepSize: 1 }, grid: { color: "rgba(139,0,0,0.1)" } },
      },
    },
  });
}

// ─── REPORT: MAINTENANCE HISTORY ───────────────────────────────────────────
async function loadMaintenanceHistory() {
  const tbody = document.getElementById("tbody-mh");
  const cards = document.getElementById("mh-summary-cards");
  if (!tbody) return;

  const params = new URLSearchParams();
  const sev  = document.getElementById("mh-filter-severity")?.value;
  const stat = document.getElementById("mh-filter-status")?.value;
  const att  = document.getElementById("mh-filter-attraction")?.value;
  const from = document.getElementById("mh-filter-from")?.value;
  const to   = document.getElementById("mh-filter-to")?.value;

  if (sev)  params.set("severity",     sev);
  if (stat) params.set("status",       stat);
  if (att)  params.set("attractionId", att);
  if (from) params.set("startDate",    from);
  if (to)   params.set("endDate",      to);

  try {
    const res  = await authFetch(`/maintenance-report?${params}`);
    const data = await res.json();

    // Summary cards for this report
    if (cards) {
      const total    = data.length;
      const high     = data.filter((r) => r.Severity === "High").length;
      const ongoing  = data.filter((r) => !r.DateEnd).length;
      const done     = data.filter((r) => r.Status === "Completed").length;
      cards.innerHTML = `
        <div class="perf-card"><h3>Total Records</h3><p class="stat-number">${total}</p></div>
        <div class="perf-card"><h3>High Severity</h3><p class="stat-number" style="color:var(--blood-light)">${high}</p></div>
        <div class="perf-card"><h3>Ongoing</h3><p class="stat-number" style="color:var(--gold)">${ongoing}</p></div>
        <div class="perf-card"><h3>Completed</h3><p class="stat-number" style="color:#2ecc71">${done}</p></div>`;
    }

    tbody.innerHTML = "";
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-dim);padding:20px;">No records match filters.</td></tr>`;
      return;
    }
    data.forEach((row) => {
      const sc = row.Severity === "High" ? "color:var(--blood-light)" : row.Severity === "Medium" ? "color:var(--ember)" : "color:var(--gold)";
      tbody.innerHTML += `<tr>
        <td>${row.MaintenanceID}</td>
        <td>${row.EmployeeName   || "—"}</td>
        <td>${row.AreaName       || "—"}</td>
        <td>${row.AttractionName || "—"}</td>
        <td style="${sc}">${row.Severity || "—"}</td>
        <td>${row.Status         || "—"}</td>
        <td>${row.DateStart      || "—"}</td>
        <td>${row.DateEnd        || "Ongoing"}</td>
      </tr>`;
    });
  } catch (err) { console.error(err); }
}

// ─── REPORT: AREA WORKLOAD ──────────────────────────────────────────────────
async function loadAreaWorkload() {
  const tbody = document.getElementById("tbody-area-workload");
  const cards = document.getElementById("aw-summary-cards");
  if (!tbody) return;

  try {
    const res  = await authFetch("/area-workload");
    const data = await res.json();

    if (cards) {
      const busiest  = data[0];
      const totalAll = data.reduce((s, r) => s + Number(r.total), 0);
      const overdueAll = data.reduce((s, r) => s + Number(r.overdue || 0), 0);
      cards.innerHTML = `
        <div class="perf-card"><h3>Total Tasks (All Areas)</h3><p class="stat-number">${totalAll}</p></div>
        <div class="perf-card"><h3>Busiest Area</h3><p class="stat-number" style="font-size:1.2rem">${busiest?.AreaName || "—"}</p></div>
        <div class="perf-card"><h3>Overdue (All Areas)</h3><p class="stat-number" style="color:var(--blood-light)">${overdueAll}</p></div>`;
    }

    tbody.innerHTML = "";
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:20px;">No area data.</td></tr>`;
    } else {
      data.forEach((row) => {
        tbody.innerHTML += `<tr>
          <td>${row.AreaName}</td>
          <td>${row.total}</td>
          <td style="color:var(--ember)">${row.pending}</td>
          <td style="color:var(--gold)">${row.inProgress}</td>
          <td style="color:#2ecc71">${row.completed}</td>
          <td style="color:var(--blood-light)">${row.overdue || 0}</td>
        </tr>`;
      });
    }

    // Bar chart
    const ctx = document.getElementById("chart-area-workload-bar");
    if (ctx && data.length) {
      if (awBarChartInstance) { awBarChartInstance.destroy(); awBarChartInstance = null; }
      awBarChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
          labels: data.map((d) => d.AreaName),
          datasets: [
            { label: "Pending",     data: data.map((d) => d.pending),    backgroundColor: "rgba(212,88,10,0.75)",  borderRadius: 3 },
            { label: "In Progress", data: data.map((d) => d.inProgress), backgroundColor: "rgba(201,168,76,0.75)", borderRadius: 3 },
            { label: "Completed",   data: data.map((d) => d.completed),  backgroundColor: "rgba(46,204,113,0.75)", borderRadius: 3 },
            { label: "Overdue",     data: data.map((d) => d.overdue||0), backgroundColor: "rgba(139,0,0,0.75)",    borderRadius: 3 },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { labels: { color: "#b0a898", font: { family: "'Crimson Text', serif", size: 13 } } },
            tooltip: { backgroundColor: "#211a14", titleColor: "#c9a84c", bodyColor: "#d6cdb8", borderColor: "rgba(139,0,0,0.4)", borderWidth: 1 },
          },
          scales: {
            x: { ticks: { color: "#b0a898", font: { family: "'Crimson Text', serif" } }, grid: { color: "rgba(139,0,0,0.1)" } },
            y: { beginAtZero: true, ticks: { color: "#b0a898", stepSize: 1 }, grid: { color: "rgba(139,0,0,0.1)" } },
          },
        },
      });
    }
  } catch (err) { console.error(err); }
}

// ─── REPORT: TRANSACTIONS ──────────────────────────────────────────────────
async function loadTransactions() {
  const tbody = document.getElementById("tbody-transactions");
  const cards = document.getElementById("tx-summary-cards");
  if (!tbody) return;

  const params = new URLSearchParams();
  const type = document.getElementById("tx-filter-type")?.value;
  const from = document.getElementById("tx-filter-from")?.value;
  const to   = document.getElementById("tx-filter-to")?.value;
  if (type) params.set("type", type);
  if (from) params.set("from", from);
  if (to)   params.set("to",   to);

  try {
    const res  = await authFetch(`/transactions?${params}`);
    const data = await res.json();

    if (cards) {
      const total    = data.length;
      const revenue  = data.reduce((s, r) => s + Number(r.TotalCost || 0), 0);
      const stolen   = data.filter((r) => r.Type === "Stolen").length;
      const damaged  = data.filter((r) => r.Type === "Damaged").length;
      cards.innerHTML = `
        <div class="perf-card"><h3>Total Transactions</h3><p class="stat-number">${total}</p></div>
        <div class="perf-card"><h3>Total Revenue</h3><p class="stat-number" style="color:#2ecc71">$${revenue.toFixed(2)}</p></div>
        <div class="perf-card"><h3>Stolen Items</h3><p class="stat-number" style="color:var(--blood-light)">${stolen}</p></div>
        <div class="perf-card"><h3>Damaged Items</h3><p class="stat-number" style="color:var(--ember)">${damaged}</p></div>`;
    }

    tbody.innerHTML = "";
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:20px;">No transactions found.</td></tr>`;
      return;
    }
    data.forEach((row) => {
      const typeColor = row.Type === "Stolen" ? "color:var(--blood-light)" :
                        row.Type === "Damaged" ? "color:var(--ember)" :
                        row.Type === "Discount" ? "color:var(--gold)" : "";
      tbody.innerHTML += `<tr>
        <td>${row.TransactionID}</td>
        <td>${row.ItemName || "—"}</td>
        <td style="${typeColor}">${row.Type}</td>
        <td>${row.Quantity}</td>
        <td>$${Number(row.Price).toFixed(2)}</td>
        <td>$${Number(row.TotalCost).toFixed(2)}</td>
        <td>${row.Date}</td>
      </tr>`;
    });
  } catch (err) { console.error(err); }
}

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────
async function loadNotifications() {
  const container = document.getElementById("notifications-list");
  if (!container) return;
  container.innerHTML = "<p style='color:var(--text-dim)'>Loading alerts…</p>";
  try {
    const res  = await authFetch("/notifications");
    const { notifications } = await res.json();
    const badge = document.getElementById("notif-badge");
    if (badge) { badge.textContent = notifications.length || ""; badge.style.display = notifications.length ? "inline-block" : "none"; }
    if (!notifications.length) { container.innerHTML = "<p style='color:var(--text-dim);font-style:italic;'>No active alerts. All systems operational.</p>"; return; }
    const iconMap = { weather: "🌩", overdue: "⏰", shutdown: "🔴", inspection: "🔧" };
    container.innerHTML = notifications.map((n) => `
      <div class="notif-card notif-${n.severity}">
        <div class="notif-icon">${iconMap[n.type] || "⚠️"}</div>
        <div class="notif-body"><p class="notif-title">${n.title}</p><p class="notif-detail">${n.detail}</p></div>
        <span class="notif-severity">${n.severity.toUpperCase()}</span>
      </div>`).join("");
  } catch (err) { console.error(err); container.innerHTML = "<p style='color:var(--blood-light)'>Failed to load.</p>"; }
}

// ─── TOAST ALERTS ─────────────────────────────────────────────────────────
async function loadAlerts() {
  try {
    const res = await authFetch("/alerts");
    const alerts = await res.json();
    alerts.forEach((alert) => {
      if (!seenAlertIds.has(alert.AlertID)) {
        seenAlertIds.add(alert.AlertID);
        showToast(alert.AlertMessage, alert.SeverityLevel === "Severe" ? "error" : "");
      }
    });
  } catch (err) { console.error(err); }
}

function showToast(message, type = "") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const div = document.createElement("div");
  div.className = `toast${type ? " " + type : ""}`;
  div.textContent = message;
  container.appendChild(div);
  requestAnimationFrame(() => requestAnimationFrame(() => div.classList.add("show")));
  setTimeout(() => { div.classList.remove("show"); setTimeout(() => div.remove(), 300); }, 5000);
}

// ─── SCHEDULE CALENDAR ─────────────────────────────────────────────────────
let calendarInstance = null;

async function loadScheduleCalendar() {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;
  try {
    const res   = await authFetch("/tasks");
    const tasks = await res.json();
    if (calendarInstance) { calendarInstance.destroy(); calendarInstance = null; }
    const areaColors = {
      "Uncanny Valley": "#8b0000",
      "Bloodmoon Village": "#c0392b",
      "Space Station X": "#d35400",
      "Camp Blackwood": "#c9a84c",
      "Dead End District": "#7f8c8d",
      "Isolation Ward": "#2c3e50"
    };
    const events = tasks
      .filter((t) => t.DueDate && !hiddenTaskIds.has(t.MaintenanceAssignmentID))
      .map((t) => ({
        id: t.MaintenanceAssignmentID,
        title: `${(t.TaskDescription || "Task").substring(0, 28)} · ${t.EmployeeName || ""}`,
        start: t.DueDate,
        color: areaColors[t.AreaName] || "#5a4a3a",
        extendedProps: { task: t },
      }));
    calendarInstance = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      events,
      height: "auto",
      headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,listWeek" },
      buttonText: { today: "Today", month: "Month", list: "List" },
      eventClick: (info) => { const t = info.event.extendedProps.task; showTaskDetails(t.EmployeeName || "Unknown", t.TaskDescription || ""); },
      eventDidMount: (info) => {
        const today = new Date().toISOString().split("T")[0];
        if (info.event.startStr === today) info.el.classList.add("fc-event-today");
      },
      dayMaxEvents: 3,
    });
    calendarInstance.render();
  } catch (err) { console.error(err); }
}

// ─── SORT / RESET ──────────────────────────────────────────────────────────
function toggleSort(column) {
  const activePanel = document.querySelector(".panel.active");
  if (!activePanel) return;
  const headers = activePanel.querySelectorAll(".data-table th");
  headers.forEach((th) => th.classList.remove("active-sort", "asc", "desc"));
  if (currentSortCol === column) isAscending = !isAscending;
  else { currentSortCol = column; isAscending = true; }
  const clicked = Array.from(headers).find((th) => th.innerText.toLowerCase().includes(column.toLowerCase()));
  if (clicked) clicked.classList.add("active-sort", isAscending ? "asc" : "desc");
  const sorted = [...allTasksData].sort((a, b) => {
    if (column === "MaintenanceAssignmentID") return isAscending ? a[column] - b[column] : b[column] - a[column];
    const va = (a[column] || "").toString().toLowerCase();
    const vb = (b[column] || "").toString().toLowerCase();
    return isAscending ? va.localeCompare(vb) : vb.localeCompare(va);
  });
  renderTables(sorted);
}

function resetTable() {
  currentSortCol = ""; isAscending = true;
  document.querySelectorAll(".data-table th").forEach((th) => th.classList.remove("active-sort", "asc", "desc"));
  renderTables(allTasksData);
}

async function refreshAllViews() {
  await loadTasks();
  await loadScheduleCalendar();
  await loadEmployeePerformance();
  initReports();
  loadNotifications();
}