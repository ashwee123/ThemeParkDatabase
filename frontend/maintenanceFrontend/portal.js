// frontend/maintenancePortal/app.js
const API_BASE = "https://maintenance-4i7r.onrender.com";

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "index.html";
}

async function fetchEmployees() {
  const res = await fetch(`${API_BASE}/employees`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });
  const data = await res.json();

  const tbody = document.getElementById("tbody-employees");
  tbody.innerHTML = "";

  data.forEach((emp) => {
    tbody.innerHTML += `
            <tr>
                <td>${emp.ID}</td>
                <td>${emp.Name}</td>
                <td>${emp.Position}</td>
                <td>${emp.Salary}</td>
                <td>
                    <button onclick="deleteEmployee(${emp.ID})">Delete</button>
                </td>
            </tr>
        `;
  });
}

async function loadTasks() {
  const res = await fetch(`${API_BASE}/tasks`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });
  const data = await res.json();

  const tbody = document.getElementById("tbody-maint");
  tbody.innerHTML = "";

  data.forEach((task) => {
    tbody.innerHTML += `
            <tr>
                <td>${task.MaintenanceAssignmentID}</td>
                <td>${task.EmployeeName}</td>
                <td>${task.AreaName || ""}</td>
                <td>${task.TaskDescription}</td>
                <td>${task.Status}</td>
                <td>${task.DueDate || ""}</td>
            </tr>
        `;
  });
}

// ✅ FORM SUBMIT
document.getElementById("form-add-task").addEventListener("submit", async (e) => {
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
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify(data),
  });

  e.target.reset();
  loadTasks();
});

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (res.ok) {
    localStorage.setItem("token", data.token);
    window.location.href = "portal.html";
  } else {
    alert("Login failed");
  }
}
