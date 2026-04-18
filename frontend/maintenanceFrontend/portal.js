// frontend/maintenanceFrontend/portal.js

const API_BASE = "https://maintenance-4i7r.onrender.com";
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "/";
}

// =========================
// GLOBAL STATE
// =========================
let allTasksData = [];
let currentSortCol = "";
let isAscending = true;
let seenAlertIds = new Set(); // tracks which toast alerts already shown

// =========================
// TAB SWITCHING
// =========================
document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".panel");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");

      const panel = document.getElementById("panel-" + tab.dataset.tab);
      if (panel) {
        panel.classList.add("active");
        const t = tab.dataset.tab;
        if (t === "performance")   loadPerformance();
        else if (t === "reports")  { loadReports(); loadMaintenanceReport(); loadWeatherReport(); loadAreaWorkload(); loadAlertReport(); }
        else if (t === "schedule") loadScheduleCalendar();
        else if (t === "notifications") loadNotifications();
        else loadTasks();
      }
    });
  });

  // Initial load
  loadTasks();
  loadNotifications();

  // Auto-poll alerts (toast notifications) every 15s
  loadAlerts();
  setInterval(loadAlerts, 15000);

  document.querySelector('[data-tab="schedule"]').click();

  // Form submit
  const form = document.getElementById("form-add-task");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await fetch(`${API_BASE}/addTask`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          EmployeeID: fd.get("EmployeeID"),
          AreaID: fd.get("AreaID") || null,
          TaskDescription: fd.get("TaskDescription"),
          Status: fd.get("Status"),
          DueDate: fd.get("DueDate") || null,
        }),
      });
      showToast("Task assigned successfully.");
      e.target.reset();
      loadTasks();
    });
  }

  // Logout
  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
});

// =========================
// AUTH
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
  const tbodyAll  = document.getElementById("tbody-tasks");
  const tbodySched = document.getElementById("tbody-active-schedule");

  if (tbodyAll)   tbodyAll.innerHTML   = "";
  if (tbodySched) tbodySched.innerHTML = "";

  dataList.forEach((task) => {
    const statusClass = `status-${task.Status.replace(/\s+/g, "").toLowerCase()}`;
    const cleanDesc   = (task.TaskDescription || "").replace(/'/g, "\\'");

    const row = `
      <tr onclick="showTaskDetails('${task.EmployeeName}', '${cleanDesc}')" style="cursor:pointer;">
        <td>${task.MaintenanceAssignmentID}</td>
        <td><strong>${task.EmployeeName || ""}</strong></td>
        <td>${task.AreaName || ""}</td>
        <td>${(task.TaskDescription || "").substring(0, 40)}...</td>
        <td><span class="status ${statusClass}">${task.Status}</span></td>
        <td>${task.DueDate || ""}</td>
        <td onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-small" onclick="editTask(${task.MaintenanceAssignmentID})">Edit</button>
          <button class="btn btn-danger btn-small" onclick="deleteTask(${task.MaintenanceAssignmentID})">Delete</button>
        </td>
      </tr>`;

    if (tbodyAll)   tbodyAll.innerHTML   += row;
    if (tbodySched && task.Status !== "Completed") tbodySched.innerHTML += row;
  });
}

// =========================
// EDIT / DELETE
// =========================
async function editTask(id) {
  const newStatus = prompt("New status (Pending / In Progress / Completed):");
  const newDesc   = prompt("New description:");
  if (!newStatus || !newDesc) return;

  const task = allTasksData.find((t) => t.MaintenanceAssignmentID === id);
  await fetch(`${API_BASE}/updateTask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      MaintenanceAssignmentID: id,
      EmployeeID: task.EmployeeID,
      AreaID: task.AreaID,
      TaskDescription: newDesc,
      Status: newStatus,
      DueDate: task.DueDate,
    }),
  });
  showToast("Task updated.");
  loadTasks();
}

async function deleteTask(id) {
  if (!confirm("Delete this task?")) return;
  await fetch(`${API_BASE}/deleteTask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ MaintenanceAssignmentID: id }),
  });
  showToast("Task deleted.", "error");
  loadTasks();
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
    if (!attractions.length) { container.innerHTML = "<p style='color:var(--text-dim)'>No attraction data.</p>"; return; }
    attractions.forEach((att) => {
      const sc = `status-${att.Status.toLowerCase().replace(/\s+/g, "")}`;
      container.innerHTML += `
        <div class="perf-card">
          <h3>${att.AttractionName}</h3>
          <p style="font-size:0.8rem;color:var(--ash);margin-bottom:6px;">${att.AttractionType}</p>
          <p>Status: <span class="${sc}">${att.Status}</span></p>
          <p style="color:var(--text-dim);font-size:0.85rem;">Queue: ${att.QueueCount ?? 0}</p>
          ${att.SeverityLevel && att.SeverityLevel !== "None" ? `<p style="color:var(--ember);font-size:0.85rem;">Severity: ${att.SeverityLevel}</p>` : ""}
        </div>`;
    });
  } catch (err) { console.error(err); }
}

// =========================
// REPORTS — STAT CARDS
// =========================
async function loadReports() {
  const container = document.getElementById("reports-container");
  if (!container) return;
  try {
    const res  = await authFetch("/reports");
    const data = await res.json();

    const total    = data.taskStats.reduce((s, r) => s + Number(r.count), 0);
    const done     = data.taskStats.find((r) => r.Status === "Completed");
    const doneCount = done ? Number(done.count) : 0;
    const rate     = total ? Math.round((doneCount / total) * 100) : 0;

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
  } catch (err) { console.error(err); }
}

// =========================
// REPORTS — MAINTENANCE HISTORY TABLE
// =========================
async function loadMaintenanceReport() {
  const tbody = document.getElementById("tbody-report");
  if (!tbody) return;

  const severity = document.getElementById("filter-severity")?.value || "";
  const from     = document.getElementById("filter-date-from")?.value || "";
  const to       = document.getElementById("filter-date-to")?.value   || "";

  const params = new URLSearchParams();
  if (severity) params.set("severity", severity);
  if (from)     params.set("startDate", from);
  if (to)       params.set("endDate",   to);

  try {
    const res  = await authFetch(`/maintenance-report?${params}`);
    const data = await res.json();
    tbody.innerHTML = "";
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="color:var(--text-dim);text-align:center;padding:20px;">No maintenance records found.</td></tr>`;
      return;
    }
    data.forEach((row) => {
      const sevClass = row.Severity === "High" ? "color:var(--blood-light)" :
                       row.Severity === "Medium" ? "color:var(--ember)" : "color:var(--gold)";
      tbody.innerHTML += `
        <tr>
          <td>${row.MaintenanceID}</td>
          <td>${row.EmployeeName || "—"}</td>
          <td>${row.AreaName || "—"}</td>
          <td>${row.AttractionName || "—"}</td>
          <td style="${sevClass}">${row.Severity || "—"}</td>
          <td>${row.Status || "—"}</td>
          <td>${row.DateStart || "—"}</td>
          <td>${row.DateEnd || "Ongoing"}</td>
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
      tbody.innerHTML = `<tr><td colspan="6" style="color:var(--text-dim);text-align:center;padding:20px;">No trigger alerts on record.</td></tr>`;
      return;
    }
    data.forEach((row) => {
      const handledColor = row.Handled === "Yes" ? "color:#2ecc71" : "color:var(--blood-light)";
      const sevColor     = row.SeverityLevel === "Severe" ? "color:var(--blood-light)" : "color:var(--ember)";
      tbody.innerHTML += `
        <tr>
          <td>${row.AlertID}</td>
          <td>${row.AttractionName || "—"}</td>
          <td style="${sevColor}">${row.SeverityLevel || "—"}</td>
          <td>${row.AlertMessage}</td>
          <td>${row.CreatedAt}</td>
          <td style="${handledColor}">${row.Handled}</td>
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
      tbody.innerHTML = `<tr><td colspan="5" style="color:var(--text-dim);text-align:center;padding:20px;">No weather events recorded.</td></tr>`;
      return;
    }
    data.forEach((row) => {
      const sevColor = row.SeverityLevel === "High" ? "color:var(--blood-light)" :
                       row.SeverityLevel === "Medium" ? "color:var(--ember)" : "color:var(--gold)";
      const opColor  = row.AttractionOperationStatus === "Closed" ? "color:var(--blood-light)" :
                       row.AttractionOperationStatus === "Restricted" ? "color:var(--ember)" : "color:#2ecc71";
      tbody.innerHTML += `
        <tr>
          <td>${row.WeatherDate}</td>
          <td style="${sevColor}">${row.SeverityLevel}</td>
          <td>${row.HighTemp ?? "—"}°</td>
          <td>${row.LowTemp ?? "—"}°</td>
          <td style="${opColor}">${row.AttractionOperationStatus}</td>
        </tr>`;
    });
  } catch (err) { console.error(err); }
}

// =========================
// REPORTS — AREA WORKLOAD TABLE
// =========================
async function loadAreaWorkload() {
  const tbody = document.getElementById("tbody-area-workload");
  if (!tbody) return;
  try {
    const res  = await authFetch("/area-workload");
    const data = await res.json();
    tbody.innerHTML = "";
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="color:var(--text-dim);text-align:center;padding:20px;">No area data.</td></tr>`;
      return;
    }
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
  } catch (err) { console.error(err); }
}

// =========================
// NOTIFICATIONS PANEL
// =========================
async function loadNotifications() {
  const container = document.getElementById("notifications-list");
  if (!container) return;
  container.innerHTML = "<p style='color:var(--text-dim)'>Loading alerts...</p>";

  try {
    const res  = await authFetch("/notifications");
    const { notifications } = await res.json();

    // Update badge
    const badge = document.getElementById("notif-badge");
    if (badge) {
      if (notifications.length > 0) {
        badge.textContent = notifications.length;
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }
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

  } catch (err) {
    console.error(err);
    if (container) container.innerHTML = "<p style='color:var(--blood-light)'>Failed to load notifications.</p>";
  }
}

// =========================
// TOAST ALERTS (polling — trg_ride_maintenance output)
// Shows only NEW alerts the user hasn't seen this session
// =========================
async function loadAlerts() {
  try {
    const res    = await authFetch("/alerts");
    const alerts = await res.json();

    alerts.forEach((alert) => {
      const id = alert.AlertID;
      if (!seenAlertIds.has(id)) {
        seenAlertIds.add(id);
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
  div.innerText = message;
  container.appendChild(div);

  // Trigger the .show class on next frame so CSS transition fires
  requestAnimationFrame(() => {
    requestAnimationFrame(() => div.classList.add("show"));
  });

  setTimeout(() => {
    div.classList.remove("show");
    setTimeout(() => div.remove(), 300);
  }, 5000);
}

// =========================
// SCHEDULE CALENDAR
// =========================
async function loadScheduleCalendar() {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;

  try {
    const res   = await authFetch("/tasks");
    const tasks = await res.json();

    const zoneColors = {
      "Zone A": "#8b0000", "rides zone": "#c0392b",
      "food court": "#d4580a", "kids area": "#c9a84c",
    };

    const events = tasks
      .filter((t) => t.DueDate)
      .map((t) => ({
        title: `${(t.TaskDescription || "").substring(0, 30)} (${t.EmployeeName})`,
        start: t.DueDate,
        color: zoneColors[t.AreaName] || "#5a4a3a",
      }));

    // Destroy previous instance if it exists
    if (calendarEl._fcInstance) calendarEl._fcInstance.destroy();

    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      events,
      height: "auto",
      themeSystem: "standard",
      eventClick: (info) => {
        showToast(info.event.title);
      },
    });

    calendar.render();
    calendarEl._fcInstance = calendar;

  } catch (err) { console.error(err); }
}

// =========================
// MODAL
// =========================
function showTaskDetails(employee, description) {
  const modal = document.getElementById("task-modal");
  if (!modal) return;
  document.getElementById("modal-employee").innerText = `DATA FILE: ${employee.toUpperCase()}`;
  document.getElementById("modal-description").innerText = description;
  modal.style.display = "flex";
}

function closeModal() {
  const modal = document.getElementById("task-modal");
  if (modal) modal.style.display = "none";
}

// =========================
// SORT
// =========================
function toggleSort(column) {
  const activePanel = document.querySelector(".panel.active");
  if (!activePanel) return;
  const headers = activePanel.querySelectorAll(".data-table th");

  headers.forEach((th) => th.classList.remove("active-sort", "asc", "desc"));

  if (currentSortCol === column) { isAscending = !isAscending; }
  else { currentSortCol = column; isAscending = true; }

  const clicked = Array.from(headers).find((th) =>
    th.innerText.toLowerCase().includes(column.toLowerCase())
  );
  if (clicked) clicked.classList.add("active-sort", isAscending ? "asc" : "desc");

  const sorted = [...allTasksData].sort((a, b) => {
    if (column === "MaintenanceAssignmentID")
      return isAscending ? a[column] - b[column] : b[column] - a[column];
    const va = (a[column] || "").toString().toLowerCase();
    const vb = (b[column] || "").toString().toLowerCase();
    return isAscending ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  renderTables(sorted);
}

function resetTable() {
  currentSortCol = "";
  isAscending = true;
  document.querySelectorAll(".data-table th").forEach((th) =>
    th.classList.remove("active-sort", "asc", "desc")
  );
  renderTables(allTasksData);
}