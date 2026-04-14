// frontend/maintenancePortal/app.js

const API_BASE = "https://maintenance-4i7r.onrender.com";
const token = localStorage.getItem("token");

// =========================
// AUTH CHECK
// =========================
if (!token) {
  window.location.href = "index.html";
}

// =========================
// GLOBAL STATE
// =========================
let allTasksData = [];
let currentSortCol = '';
let isAscending = true;

// =========================
// RENDER TABLES  ← was missing entirely
// =========================
function renderTables(dataList) {
  const tbodyHistory = document.getElementById("tbody-tasks");
  const tbodySchedule = document.getElementById("tbody-active-schedule");

  if (tbodyHistory) tbodyHistory.innerHTML = "";
  if (tbodySchedule) tbodySchedule.innerHTML = "";

  dataList.forEach((task) => {
    const statusClass = `status-${task.Status.replace(/\s+/g, "").toLowerCase()}`;
    const cleanDesc = task.TaskDescription.replace(/'/g, "\\'");

    const rowHTML = `
      <tr onclick="showTaskDetails('${task.EmployeeName}', '${cleanDesc}')" style="cursor:pointer;">
        <td>${task.MaintenanceAssignmentID}</td>
        <td><strong>${task.EmployeeName}</strong></td>
        <td>${task.AreaName || ""}</td>
        <td>${task.TaskDescription.substring(0, 40)}...</td>
        <td><span class="${statusClass}">${task.Status}</span></td>
        <td>${task.DueDate || ""}</td>
      </tr>`;

    if (tbodyHistory) tbodyHistory.innerHTML += rowHTML;

    if (tbodySchedule && task.Status !== "Completed") {
      tbodySchedule.innerHTML += rowHTML;
    }
  });
}

// =========================
// LOAD TASKS
// =========================
async function loadTasks() {
  try {
    const res = await fetch(`${API_BASE}/tasks`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      logout();
      return;
    }

    const data = await res.json();
    allTasksData = data;
    renderTables(data);

  } catch (err) {
    console.error("loadTasks error:", err);
  }
}

// =========================
// FETCH EMPLOYEES
// =========================
async function fetchEmployees() {
  try {
    const res = await fetch(`${API_BASE}/employees`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Unauthorized");

    const data = await res.json();
    const tbody = document.getElementById("tbody-employees");
    if (!tbody) return;

    tbody.innerHTML = "";
    data.forEach((emp) => {
      tbody.innerHTML += `
        <tr>
          <td>${emp.EmployeeID || ""}</td>
          <td>${emp.Name || ""}</td>
          <td>${emp.Position || ""}</td>
          <td>${emp.Salary || ""}</td>
          <td><button onclick="deleteEmployee(${emp.EmployeeID})">Delete</button></td>
        </tr>`;
    });
  } catch (err) {
    console.error(err);
    logout();
  }
}

// =========================
// LOAD PERFORMANCE
// =========================
async function loadPerformance() {
  const container = document.getElementById("performance-reports");
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/attractions`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`/attractions returned ${res.status}`);

    const attractions = await res.json();
    container.innerHTML = "";

    attractions.forEach((att) => {
      const statusClass = `status-${att.Status.toLowerCase().replace(/\s+/g, "")}`;
      container.innerHTML += `
        <div class="perf-card">
          <h3>${att.AttractionName}</h3>
          <p>Status: <span class="${statusClass}">${att.Status}</span></p>
        </div>`;
    });
  } catch (err) {
    console.error("Performance Load Error:", err);
    container.innerHTML = "<p>Could not load attraction data.</p>";
  }
}

// =========================
// LOAD REPORTS
// =========================
async function loadReports() {
  const container = document.getElementById("reports-container");
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/reports`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    container.innerHTML = `
      <div class="perf-card">
        <h3>Overdue Tasks</h3>
        <p>${data.overdue[0].overdueTasks}</p>
      </div>
      <div class="perf-card">
        <h3>Task Breakdown</h3>
        ${data.taskStats.map((s) => `<p>${s.Status}: ${s.count}</p>`).join("")}
      </div>
      <div class="perf-card">
        <h3>Business Insights</h3>
        ${data.advice.map((a) => `<p>${a}</p>`).join("")}
      </div>`;
  } catch (err) {
    console.error("Reports error:", err);
  }
}

// =========================
// NOTIFICATIONS / TRIGGERS
// =========================
async function loadNotifications() {
  const container = document.getElementById("notifications-list");
  if (!container) return;

  container.innerHTML = "<p style='color:var(--text-dim)'>Loading alerts...</p>";

  try {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`/notifications returned ${res.status}`);

    const { notifications } = await res.json();

    if (!notifications.length) {
      container.innerHTML = "<p style='color:var(--text-dim)'>No active alerts.</p>";
      return;
    }

    // Update badge count
    const badge = document.getElementById("notif-badge");
    if (badge) {
      badge.textContent = notifications.length;
      badge.style.display = "inline-block";
    }

    container.innerHTML = notifications
      .map((n) => {
        const iconMap = {
          weather: "🌩",
          overdue: "⏰",
          shutdown: "🔴",
          inspection: "🔧",
        };
        const icon = iconMap[n.type] || "⚠️";
        return `
          <div class="notif-card notif-${n.severity}">
            <div class="notif-icon">${icon}</div>
            <div class="notif-body">
              <p class="notif-title">${n.title}</p>
              <p class="notif-detail">${n.detail}</p>
            </div>
            <span class="notif-severity">${n.severity.toUpperCase()}</span>
          </div>`;
      })
      .join("");

  } catch (err) {
    console.error("Notifications error:", err);
    container.innerHTML = "<p style='color:red'>Failed to load notifications.</p>";
  }
}

// =========================
// SORTING
// =========================
function toggleSort(column) {
  const activePanel = document.querySelector(".panel.active");
  const headers = activePanel.querySelectorAll(".data-table th");

  headers.forEach((th) => th.classList.remove("active-sort", "asc", "desc"));

  if (currentSortCol === column) {
    isAscending = !isAscending;
  } else {
    currentSortCol = column;
    isAscending = true;
  }

  const clickedHeader = Array.from(headers).find((th) =>
    th.innerText.toLowerCase().includes(column.toLowerCase())
  );
  if (clickedHeader) {
    clickedHeader.classList.add("active-sort", isAscending ? "asc" : "desc");
  }

  const sorted = [...allTasksData].sort((a, b) => {
    if (column === "MaintenanceAssignmentID") {
      return isAscending ? a[column] - b[column] : b[column] - a[column];
    }
    const valA = (a[column] || "").toString().toLowerCase();
    const valB = (b[column] || "").toString().toLowerCase();
    return isAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
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
// ADD TASK FORM
// =========================
const form = document.getElementById("form-add-task");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      EmployeeID: formData.get("EmployeeID"),
      AreaID: formData.get("AreaID"),
      TaskDescription: formData.get("TaskDescription"),
      Status: formData.get("Status"),
      DueDate: formData.get("DueDate"),
    };

    await fetch(`${API_BASE}/addTask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    alert("Task assigned!");
    e.target.reset();
    loadTasks();
    loadNotifications(); // refresh alerts after new task
  });
}

// =========================
// LOGIN
// =========================
async function login() {
  const email = document.getElementById("email")?.value;
  const password = document.getElementById("password")?.value;

  const loginLoading = document.getElementById("loginLoading");
  if (loginLoading) loginLoading.style.display = "block";

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (loginLoading) loginLoading.style.display = "none";

    if (!res.ok) {
      alert(data.error || "Login failed");
      return;
    }

    localStorage.setItem("token", data.token);
    window.location.href = "/maintenance";
  } catch (err) {
    console.error(err);
    if (loginLoading) loginLoading.style.display = "none";
    alert("Server error");
  }
}

// =========================
// LOGOUT
// =========================
function logout() {
  localStorage.removeItem("token");
  window.location.href = "/";
}

const logoutBtn = document.getElementById("btn-logout");
if (logoutBtn) {
  logoutBtn.addEventListener("click", logout);
}

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

        if (tab.dataset.tab === "performance") loadPerformance();
        else if (tab.dataset.tab === "reports") loadReports();
        else if (tab.dataset.tab === "notifications") loadNotifications();
        else loadTasks();
      }
    });
  });

  // Initial loads
  loadTasks();
  loadNotifications();

  document.querySelector('[data-tab="schedule"]').click();
});