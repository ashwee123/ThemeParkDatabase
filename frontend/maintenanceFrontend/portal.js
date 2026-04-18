// frontend/maintenanceFrontend/portal.js

const API_BASE = "https://maintenance-4i7r.onrender.com";
const token    = localStorage.getItem("token");

if (!token) window.location.href = "/";

// =========================
// GLOBAL STATE
// =========================
let allTasksData  = [];
let currentSortCol = "";
let isAscending    = true;
let seenAlertIds   = new Set();
let hiddenTaskIds  = new Set(); // soft-delete: removed from view only
let pendingDeleteId = null;     // id staged for delete modal

// Chart instances (kept so we can destroy before re-render)
let pieChartInstance = null;
let barChartInstance = null;

// =========================
// BOOT
// =========================
document.addEventListener("DOMContentLoaded", () => {

  // Tab switching
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");

      const panel = document.getElementById("panel-" + tab.dataset.tab);
      if (!panel) return;
      panel.classList.add("active");

      const t = tab.dataset.tab;
      if      (t === "performance")   loadPerformance();
      else if (t === "reports")       loadAllReports();
      else if (t === "schedule")      loadScheduleCalendar();
      else if (t === "notifications") loadNotifications();
      else                            loadTasks();
    });
  });

  // Assign form — live dropdown population
  populateDropdowns();

  // Assign form submit
  const form = document.getElementById("form-add-task");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await authFetch("/addTask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          EmployeeID:    fd.get("EmployeeID")    || null,
          AreaID:        fd.get("AreaID")        || null,
          AttractionID:  fd.get("AttractionID")  || null,
          TaskDescription: fd.get("TaskDescription"),
          Status:        fd.get("Status"),
          DueDate:       fd.get("DueDate")       || null,
        }),
      });
      showToast("Task assigned successfully.");
      e.target.reset();
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
          EmployeeID:    document.getElementById("edit-employee").value  || task?.EmployeeID,
          AreaID:        document.getElementById("edit-area").value      || task?.AreaID,
          TaskDescription: document.getElementById("edit-description").value,
          Status:        document.getElementById("edit-status").value,
          DueDate:       document.getElementById("edit-due-date").value  || null,
        }),
      });

      showToast("Task updated.");
      closeModal("edit-modal");
      loadTasks();
    });
  }

  // Logout
  document.getElementById("btn-logout")?.addEventListener("click", logout);

  // Initial loads
  loadTasks();
  loadNotifications();
  loadAlerts();
  setInterval(loadAlerts, 15000);

  document.querySelector('[data-tab="schedule"]').click();
});

// =========================
// AUTH HELPERS
// =========================
function logout() {
  localStorage.removeItem("token");
  window.location.href = "/";
}

async function authFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (res.status === 401) { logout(); throw new Error("Unauthorized"); }
  return res;
}

// =========================
// POPULATE DROPDOWNS (live from DB)
// =========================
async function populateDropdowns() {
  try {
    const [empRes, areaRes, attRes] = await Promise.all([
      authFetch("/employees"),
      authFetch("/areas"),
      authFetch("/attractions"),
    ]);
    const [employees, areas, attractions] = await Promise.all([
      empRes.json(), areaRes.json(), attRes.json(),
    ]);

    // Assign form
    fillSelect("select-employee",  employees,   "EmployeeID", (e) => `${e.Name} (${e.Position || "Staff"})`);
    fillSelect("select-area",      areas,        "AreaID",     (a) => a.AreaName, true);
    fillSelect("select-attraction", attractions, "AttractionID", (a) => a.AttractionName, true);

    // Edit modal (same employees + areas)
    fillSelect("edit-employee", employees, "EmployeeID", (e) => `${e.Name} (${e.Position || "Staff"})`);
    fillSelect("edit-area",     areas,     "AreaID",     (a) => a.AreaName, true);
  } catch (err) { console.error("populateDropdowns:", err); }
}

function fillSelect(id, data, valueKey, labelFn, addBlank = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = addBlank ? `<option value="">None</option>` : "";
  data.forEach((item) => {
    const opt = document.createElement("option");
    opt.value       = item[valueKey];
    opt.textContent = labelFn(item);
    el.appendChild(opt);
  });
}

// =========================
// TASKS
// =========================
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
    const sc       = `status-${task.Status.replace(/\s+/g, "").toLowerCase()}`;
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

// =========================
// EDIT MODAL
// =========================
function openEditModal(id) {
  const task = allTasksData.find((t) => t.MaintenanceAssignmentID === id);
  if (!task) return;

  document.getElementById("edit-task-id").value    = id;
  document.getElementById("edit-description").value = task.TaskDescription || "";
  document.getElementById("edit-due-date").value    = task.DueDate || "";

  // Set status dropdown
  const statusSel = document.getElementById("edit-status");
  [...statusSel.options].forEach((opt) => {
    opt.selected = opt.value === task.Status;
  });

  // Pre-select employee (if EmployeeID is available on the task object)
  if (task.EmployeeID) {
    const empSel = document.getElementById("edit-employee");
    [...empSel.options].forEach((opt) => { opt.selected = opt.value == task.EmployeeID; });
  }

  openModal("edit-modal");
}

// =========================
// DELETE MODAL (soft — frontend only)
// =========================
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
  showToast("Task removed from view. Database record kept.", "error");
  pendingDeleteId = null;
  closeModal("delete-modal");
  renderTables(allTasksData); // re-render with updated hidden set
}

// =========================
// MODAL HELPERS
// =========================
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

// =========================
// PERFORMANCE
// =========================
async function loadPerformance() {
  const container = document.getElementById("performance-reports");
  if (!container) return;
  try {
    const res = await authFetch("/attractions");
    const attractions = await res.json();
    container.innerHTML = "";
    if (!attractions.length) { container.innerHTML = "<p style='color:var(--text-dim)'>No data.</p>"; return; }
    attractions.forEach((att) => {
      const sc = `status-${att.Status.toLowerCase().replace(/\s+/g, "")}`;
      container.innerHTML += `
        <div class="perf-card">
          <h3>${att.AttractionName}</h3>
          <p style="font-size:0.8rem;color:var(--ash);margin-bottom:6px;">${att.AttractionType}</p>
          <p>Status: <span class="${sc}">${att.Status}</span></p>
          <p style="color:var(--text-dim);font-size:0.85rem;margin-top:4px;">Queue: ${att.QueueCount ?? 0}</p>
          ${att.SeverityLevel && att.SeverityLevel !== "None" ? `<p style="color:var(--ember);font-size:0.85rem;">Severity: ${att.SeverityLevel}</p>` : ""}
        </div>`;
    });
  } catch (err) { console.error(err); }
}

// =========================
// ALL REPORTS LOADER
// =========================
function loadAllReports() {
  loadReports();
  loadMaintenanceReport();
  loadWeatherReport();
  loadAreaWorkload();
  loadAlertReport();
}

// =========================
// REPORTS — STAT CARDS + CHARTS
// =========================
async function loadReports() {
  const container = document.getElementById("reports-container");
  if (!container) return;
  try {
    const res  = await authFetch("/reports");
    const data = await res.json();

    const total     = data.taskStats.reduce((s, r) => s + Number(r.count), 0);
    const done      = data.taskStats.find((r) => r.Status === "Completed");
    const doneCount = done ? Number(done.count) : 0;
    const rate      = total ? Math.round((doneCount / total) * 100) : 0;

    container.innerHTML = `
      <div class="perf-card">
        <h3>Overdue Tasks</h3>
        <p class="stat-number" style="color:var(--blood-light)">${data.overdue[0].overdueTasks}</p>
      </div>
      <div class="perf-card">
        <h3>Total Tasks</h3>
        <p class="stat-number">${total}</p>
      </div>
      <div class="perf-card">
        <h3>Completion Rate</h3>
        <p class="stat-number" style="color:#2ecc71">${rate}%</p>
      </div>
      <div class="perf-card">
        <h3>Task Breakdown</h3>
        ${data.taskStats.map((s) => `<p style="font-size:0.9rem">${s.Status}: <strong>${s.count}</strong></p>`).join("")}
      </div>
      <div class="perf-card">
        <h3>Insights</h3>
        ${data.advice.length ? data.advice.map((a) => `<p style="font-size:0.9rem">${a}</p>`).join("") : "<p style='color:var(--text-dim);font-size:0.9rem'>All clear.</p>"}
      </div>`;

    // --- PIE CHART ---
    renderPieChart(data.taskStats);
  } catch (err) { console.error(err); }
}

function renderPieChart(taskStats) {
  const ctx = document.getElementById("chart-status-pie");
  if (!ctx) return;

  if (pieChartInstance) { pieChartInstance.destroy(); pieChartInstance = null; }

  const colorMap = {
    "Pending":     "#d4580a",
    "In Progress": "#c9a84c",
    "Completed":   "#2ecc71",
  };

  const labels = taskStats.map((s) => s.Status);
  const values = taskStats.map((s) => Number(s.count));
  const colors = labels.map((l) => colorMap[l] || "#5a4a3a");

  pieChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderColor: "#120e0a", borderWidth: 3, hoverBorderColor: "#1c1510" }],
    },
    options: {
      responsive: true,
      cutout: "65%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#b0a898", font: { family: "'Crimson Text', serif", size: 13 }, padding: 16 },
        },
        tooltip: {
          backgroundColor: "#211a14",
          titleColor: "#c9a84c",
          bodyColor: "#d6cdb8",
          borderColor: "rgba(139,0,0,0.4)",
          borderWidth: 1,
        },
      },
    },
  });
}

// =========================
// REPORTS — AREA WORKLOAD TABLE + BAR CHART
// =========================
async function loadAreaWorkload() {
  const tbody = document.getElementById("tbody-area-workload");
  if (!tbody) return;
  try {
    const res  = await authFetch("/area-workload");
    const data = await res.json();

    tbody.innerHTML = "";
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:20px;">No area data.</td></tr>`;
    } else {
      data.forEach((row) => {
        tbody.innerHTML += `
          <tr>
            <td>${row.AreaName}</td>
            <td>${row.total}</td>
            <td style="color:var(--ember)">${row.pending}</td>
            <td style="color:var(--gold)">${row.inProgress}</td>
            <td style="color:#2ecc71">${row.completed}</td>
          </tr>`;
      });
    }

    // --- BAR CHART ---
    renderBarChart(data);
  } catch (err) { console.error(err); }
}

function renderBarChart(data) {
  const ctx = document.getElementById("chart-area-bar");
  if (!ctx) return;

  if (barChartInstance) { barChartInstance.destroy(); barChartInstance = null; }

  barChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map((d) => d.AreaName),
      datasets: [
        { label: "Pending",     data: data.map((d) => d.pending),    backgroundColor: "rgba(212,88,10,0.75)",  borderRadius: 3 },
        { label: "In Progress", data: data.map((d) => d.inProgress), backgroundColor: "rgba(201,168,76,0.75)", borderRadius: 3 },
        { label: "Completed",   data: data.map((d) => d.completed),  backgroundColor: "rgba(46,204,113,0.75)", borderRadius: 3 },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: "#b0a898", font: { family: "'Crimson Text', serif", size: 13 }, padding: 14 },
        },
        tooltip: {
          backgroundColor: "#211a14",
          titleColor: "#c9a84c",
          bodyColor: "#d6cdb8",
          borderColor: "rgba(139,0,0,0.4)",
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          stacked: false,
          ticks: { color: "#b0a898", font: { family: "'Crimson Text', serif" } },
          grid:  { color: "rgba(139,0,0,0.1)" },
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#b0a898", font: { family: "'Crimson Text', serif" }, stepSize: 1 },
          grid:  { color: "rgba(139,0,0,0.1)" },
        },
      },
    },
  });
}

// =========================
// REPORTS — MAINTENANCE HISTORY
// =========================
async function loadMaintenanceReport() {
  const tbody = document.getElementById("tbody-report");
  if (!tbody) return;

  const severity = document.getElementById("filter-severity")?.value || "";
  const from     = document.getElementById("filter-date-from")?.value || "";
  const to       = document.getElementById("filter-date-to")?.value   || "";

  const params = new URLSearchParams();
  if (severity) params.set("severity",  severity);
  if (from)     params.set("startDate", from);
  if (to)       params.set("endDate",   to);

  try {
    const res  = await authFetch(`/maintenance-report?${params}`);
    const data = await res.json();
    tbody.innerHTML = "";
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-dim);padding:20px;">No records found.</td></tr>`;
      return;
    }
    data.forEach((row) => {
      const sc = row.Severity === "High" ? "color:var(--blood-light)" :
                 row.Severity === "Medium" ? "color:var(--ember)" : "color:var(--gold)";
      tbody.innerHTML += `
        <tr>
          <td>${row.MaintenanceID}</td>
          <td>${row.EmployeeName  || "—"}</td>
          <td>${row.AreaName      || "—"}</td>
          <td>${row.AttractionName || "—"}</td>
          <td style="${sc}">${row.Severity || "—"}</td>
          <td>${row.Status        || "—"}</td>
          <td>${row.DateStart     || "—"}</td>
          <td>${row.DateEnd       || "Ongoing"}</td>
        </tr>`;
    });
  } catch (err) { console.error(err); }
}

// =========================
// REPORTS — TRIGGER ALERTS TABLE
// =========================
async function loadAlertReport() {
  const tbody = document.getElementById("tbody-alerts");
  if (!tbody) return;
  try {
    const res  = await authFetch("/alert-report");
    const data = await res.json();
    tbody.innerHTML = "";
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:20px;">No trigger alerts on record.</td></tr>`;
      return;
    }
    data.forEach((row) => {
      const hc = row.Handled === "Yes" ? "color:#2ecc71" : "color:var(--blood-light)";
      const sc = row.SeverityLevel === "Severe" ? "color:var(--blood-light)" : "color:var(--ember)";
      tbody.innerHTML += `
        <tr>
          <td>${row.AlertID}</td>
          <td>${row.AttractionName || "—"}</td>
          <td style="${sc}">${row.SeverityLevel || "—"}</td>
          <td>${row.AlertMessage}</td>
          <td>${row.CreatedAt}</td>
          <td style="${hc}">${row.Handled}</td>
        </tr>`;
    });
  } catch (err) { console.error(err); }
}

// =========================
// REPORTS — WEATHER TABLE
// =========================
async function loadWeatherReport() {
  const tbody = document.getElementById("tbody-weather");
  if (!tbody) return;
  try {
    const res  = await authFetch("/weather-report");
    const data = await res.json();
    tbody.innerHTML = "";
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:20px;">No weather events recorded.</td></tr>`;
      return;
    }
    data.forEach((row) => {
      const sc = row.SeverityLevel === "High"   ? "color:var(--blood-light)" :
                 row.SeverityLevel === "Medium" ? "color:var(--ember)"       : "color:var(--gold)";
      const oc = row.AttractionOperationStatus === "Closed"     ? "color:var(--blood-light)" :
                 row.AttractionOperationStatus === "Restricted" ? "color:var(--ember)"       : "color:#2ecc71";
      tbody.innerHTML += `
        <tr>
          <td>${row.WeatherDate}</td>
          <td style="${sc}">${row.SeverityLevel}</td>
          <td>${row.HighTemp ?? "—"}°</td>
          <td>${row.LowTemp  ?? "—"}°</td>
          <td style="${oc}">${row.AttractionOperationStatus}</td>
        </tr>`;
    });
  } catch (err) { console.error(err); }
}

// =========================
// NOTIFICATIONS PANEL
// =========================
async function loadNotifications() {
  const container = document.getElementById("notifications-list");
  if (!container) return;
  container.innerHTML = "<p style='color:var(--text-dim)'>Loading alerts…</p>";
  try {
    const res  = await authFetch("/notifications");
    const { notifications } = await res.json();

    const badge = document.getElementById("notif-badge");
    if (badge) {
      badge.textContent = notifications.length || "";
      badge.style.display = notifications.length ? "inline-block" : "none";
    }

    if (!notifications.length) {
      container.innerHTML = "<p style='color:var(--text-dim);font-style:italic;'>No active alerts. All systems operational.</p>";
      return;
    }

    const iconMap = { weather: "🌩", overdue: "⏰", shutdown: "🔴", inspection: "🔧" };
    container.innerHTML = notifications.map((n) => `
      <div class="notif-card notif-${n.severity}">
        <div class="notif-icon">${iconMap[n.type] || "⚠️"}</div>
        <div class="notif-body">
          <p class="notif-title">${n.title}</p>
          <p class="notif-detail">${n.detail}</p>
        </div>
        <span class="notif-severity">${n.severity.toUpperCase()}</span>
      </div>`).join("");
  } catch (err) { console.error(err); if (container) container.innerHTML = "<p style='color:var(--blood-light)'>Failed to load.</p>"; }
}

// =========================
// TOAST ALERTS (polling)
// =========================
async function loadAlerts() {
  try {
    const res    = await authFetch("/alerts");
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

// =========================
// SCHEDULE CALENDAR
// =========================
let calendarInstance = null;

async function loadScheduleCalendar() {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;
  try {
    const res   = await authFetch("/tasks");
    const tasks = await res.json();

    if (calendarInstance) { calendarInstance.destroy(); calendarInstance = null; }

    // Map area names to blood-palette colours
    const areaColors = {
      "Zone A":       "#8b0000",
      "rides zone":   "#c0392b",
      "food court":   "#d4580a",
      "kids area":    "#c9a84c",
    };

    const events = tasks
      .filter((t) => t.DueDate && !hiddenTaskIds.has(t.MaintenanceAssignmentID))
      .map((t) => ({
        id:    t.MaintenanceAssignmentID,
        title: `${(t.TaskDescription || "Task").substring(0, 28)} · ${t.EmployeeName || ""}`,
        start: t.DueDate,
        color: areaColors[t.AreaName] || "#5a4a3a",
        extendedProps: { task: t },
      }));

    calendarInstance = new FullCalendar.Calendar(calendarEl, {
      initialView:   "dayGridMonth",
      events,
      height:        "auto",
      headerToolbar: {
        left:   "prev,next today",
        center: "title",
        right:  "dayGridMonth,listWeek",
      },
      buttonText: { today: "Today", month: "Month", list: "List" },
      eventClick: (info) => {
        const t = info.event.extendedProps.task;
        showTaskDetails(t.EmployeeName || "Unknown", t.TaskDescription || "");
      },
      eventDidMount: (info) => {
        // Pulse dot on events due today
        const today = new Date().toISOString().split("T")[0];
        if (info.event.startStr === today) {
          info.el.classList.add("fc-event-today");
        }
      },
      dayMaxEvents:  3,
    });

    calendarInstance.render();
  } catch (err) { console.error(err); }
}

// =========================
// SORTING
// =========================
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