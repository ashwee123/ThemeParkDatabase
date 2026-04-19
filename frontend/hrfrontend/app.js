// 🔥 IMPORTANT: replace with your actual Render backend URL
const API = "https://your-backend.onrender.com";

/* ================= TAB SWITCHING ================= */
document.querySelectorAll(".tab").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  };
});

/* ================= LOGIN ================= */
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (res.ok) {
      alert("Login successful");
      localStorage.setItem("loggedIn", "true");

      // redirect to dashboard
      window.location.href = "index.html";
    } else {
      alert(data.error || "Login failed");
    }
  } catch (err) {
    console.error(err);
    alert("Server error");
  }
}

/* ================= EMPLOYEES ================= */
async function addEmployee() {
  const body = {
    name: document.getElementById("empName").value,
    position: document.getElementById("empRole").value,
    salary: document.getElementById("empSalary").value,
    managerId: document.getElementById("empManager").value,
    areaId: document.getElementById("empArea").value
  };

  await fetch(`${API}/employees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  loadEmployees();
}

async function loadEmployees() {
  const res = await fetch(`${API}/employees`);
  const data = await res.json();

  document.getElementById("empTable").innerHTML = data.map(e => `
    <tr>
      <td>${e.Name}</td>
      <td>${e.Position}</td>
      <td>${e.Salary}</td>
    </tr>
  `).join("");
}

/* ================= MANAGERS ================= */
async function addManager() {
  const body = {
    id: document.getElementById("mgrId").value,
    name: document.getElementById("mgrName").value
  };

  await fetch(`${API}/managers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  loadManagers();
}

async function loadManagers() {
  const res = await fetch(`${API}/managers`);
  const data = await res.json();

  document.getElementById("mgrTable").innerHTML = data.map(m => `
    <tr>
      <td>${m.ManagerID}</td>
      <td>${m.ManagerName}</td>
    </tr>
  `).join("");
}

/* ================= ACTIVITY ================= */
async function addActivity() {
  const body = {
    employeeId: document.getElementById("actEmpId").value,
    score: document.getElementById("actScore").value,
    notes: document.getElementById("actNotes").value
  };

  await fetch(`${API}/activity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  loadActivity();
}

async function loadActivity() {
  const res = await fetch(`${API}/activity`);
  const data = await res.json();

  document.getElementById("actTable").innerHTML = data.map(a => `
    <tr>
      <td>${a.Name}</td>
      <td>${a.PerformanceScore}</td>
      <td>${a.WorkloadNotes}</td>
    </tr>
  `).join("");
}

/* ================= SALARY ================= */
async function loadSalary() {
  const res = await fetch(`${API}/salary`);
  const data = await res.json();

  document.getElementById("salTable").innerHTML = data.map(s => `
    <tr>
      <td>${s.Name}</td>
      <td>${s.Salary}</td>
    </tr>
  `).join("");
}

/* ================= AUTH CHECK ================= */
function checkAuth() {
  if (!localStorage.getItem("loggedIn")) {
    window.location.href = "login.html";
  }
}

/* ================= INIT ================= */
if (window.location.pathname.includes("index.html")) {
  checkAuth();

  loadEmployees();
  loadManagers();
  loadActivity();
  loadSalary();
}
