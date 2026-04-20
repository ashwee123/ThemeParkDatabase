const API_BASE = "https://maintenance-4i7r.onrender.com";
const token = localStorage.getItem("token");

if (!token) window.location.href = "/";

// ─── SAFE AUTH FETCH ─────────────────────────────────────────────
async function authFetch(url, options = {}) {
  const res = await fetch(API_BASE + url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("Invalid JSON from server");
  }

  if (!res.ok) {
    console.error("API Error:", data);
    return null; // 🔥 prevent crashes
  }

  return data;
}

// ─── TASKS ─────────────────────────────────────────────
let allTasksData = [];

async function loadTasks() {
  try {
    const res = await authFetch("/tasks");

    if (!res || !Array.isArray(res.data)) {
      console.error("Invalid tasks response:", res);
      return;
    }

    allTasksData = res.data;

    renderTables(allTasksData);
  } catch (err) {
    console.error("loadTasks error:", err);
  }
}

// ─── RENDER TABLES ─────────────────────────────────────────────
function renderTables(data) {
  const tbody = document.getElementById("tbody-tasks");

  if (!tbody) return;

  tbody.innerHTML = data.map(t => `
    <tr>
      <td>${t.MaintenanceAssignmentID}</td>
      <td>${t.EmployeeName || ""}</td>
      <td>${t.AreaName || ""}</td>
      <td>${t.TaskDescription || ""}</td>
      <td>${t.Status}</td>
      <td>${t.DueDate}</td>
    </tr>
  `).join("");
}

// ─── DROPDOWNS ─────────────────────────────────────────────
async function populateDropdowns() {
  try {
    const safe = (x) => Array.isArray(x) ? x : [];

    const [employees, areas, attractions] = await Promise.all([
      authFetch("/employees"),
      authFetch("/areas"),
      authFetch("/attractions")
    ]);

    fillSelect("select-employee", safe(employees), "EmployeeID", e => e.Name);
    fillSelect("select-area", safe(areas), "AreaID", a => a.AreaName, true);
    fillSelect("select-attraction", safe(attractions), "AttractionID", a => a.AttractionName, true);

  } catch (err) {
    console.error("populateDropdowns error:", err);
  }
}

function fillSelect(id, data, valueKey, labelFn, addBlank = false) {
  const el = document.getElementById(id);
  if (!el) return;

  el.innerHTML = addBlank ? `<option value="">None</option>` : "";

  data.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item[valueKey];
    opt.textContent = labelFn(item);
    el.appendChild(opt);
  });
}

// ─── NOTIFICATIONS ─────────────────────────────────────────────
async function loadNotifications() {
  const container = document.getElementById("notifications-list");
  if (!container) return;

  const res = await authFetch("/notifications");
  const data = res?.data;

  if (!data || !data.notifications) {
    container.innerHTML = "No alerts";
    return;
  }

  container.innerHTML = data.notifications.map(n => `
    <div>
      <strong>${n.title}</strong><br/>
      ${n.detail}
    </div>
  `).join("");
}

// ─── ALERTS ─────────────────────────────────────────────
async function loadAlerts() {
  const res = await authFetch("/alerts");
  const alerts = res?.data;

  if (!Array.isArray(alerts)) return;

  alerts.forEach(alert => {
    showToast(alert.AlertMessage);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadTasks();
  populateDropdowns();
  loadNotifications();
});