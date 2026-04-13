// frontend/maintenancePortal/app.js
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "index.html";
}

async function fetchEmployees() {
    const res = await fetch(`${API_BASE}/employees`, {
    headers: {
        "Authorization": `Bearer ${localStorage.getItem("token")}`
    }
    });
    const data = await res.json();

    const tbody = document.getElementById('tbody-employees');
    tbody.innerHTML = '';

    data.forEach(emp => {
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
    try {
        const res = await fetch(`${API_BASE}/tasks`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!res.ok) {
            console.error("Unauthorized or error");
            localStorage.removeItem("token");
            window.location.href = "/";
            return;
        }

        const data = await res.json();
        allTasksData = data;
        renderTables(allTasksData);

    } catch (err) {
        console.error(err);
    }
}

// ✅ FORM SUBMIT
document.getElementById('form-add-task').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target);

    const data = {
    EmployeeID: formData.get("EmployeeID"),
    AreaID: formData.get("AreaID"),
    TaskDescription: formData.get("TaskDescription"),
    Status: formData.get("Status"),
    DueDate: formData.get("DueDate")
    };

    await fetch(`${API_BASE}/addTask`, {
    method: 'POST',
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
    },
    body: JSON.stringify(data)
});});

const API_BASE = "https://maintenance-4i7r.onrender.com";

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await fetch(`${API}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

    loginLoading.style.display = "none";

    if (!res.ok) {
        showError(data.error || "Login failed");
        return;
    }

    localStorage.setItem("token", data.token);
}