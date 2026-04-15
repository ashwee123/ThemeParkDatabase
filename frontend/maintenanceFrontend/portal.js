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

// =========================
// FETCH EMPLOYEES
// =========================
async function fetchEmployees() {
  try {
    const res = await fetch(`${API_BASE}/employees`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
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
          <td>
            <button onclick="deleteEmployee(${emp.EmployeeID})">Delete</button>
          </td>
        </tr>
      `;
    });

  } catch (err) {
    console.error(err);
    logout();
  }
}

// =========================
// LOAD TASKS
// =========================
async function loadTasks() {
  try {
    const res = await fetch(`${API_BASE}/tasks`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      logout();
      return;
    }

    const data = await res.json();

    allTasksData = data;
    renderTables(data);

  } catch (err) {
    console.error(err);
  }
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

    e.target.reset();
    loadTasks();
  });
}

// =========================
// LOGIN FUNCTION (FIXED)
// =========================
async function login() {
  const email = document.getElementById("email")?.value;
  const password = document.getElementById("password")?.value;

  const loginLoading = document.getElementById("loginLoading");
  if (loginLoading) loginLoading.style.display = "block";

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (loginLoading) loginLoading.style.display = "none";

    if (!res.ok) {
      alert(data.error || "Login failed");
      return;
    }

    localStorage.setItem("token", data.token);

    // 👉 IMPORTANT: redirect to correct portal route
    window.location.href = "/maintenance";

  } catch (err) {
    console.error(err);
    if (loginLoading) loginLoading.style.display = "none";
    alert("Server error");
  }
}

// =========================
// LOGOUT (optional but needed)
// =========================
function logout() {
  localStorage.removeItem("token");
  window.location.href = "/";
}

// =========================
// INITIAL LOAD
// =========================
loadTasks();