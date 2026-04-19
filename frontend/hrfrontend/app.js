// 🔥 API URL (Ensure Render instance is active, it might take 50s to spin up)
const API = "https://hrmanager-39yw.onrender.com";

/* ================= TAB SWITCHING ================= */
document.querySelectorAll(".tab").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));

    btn.classList.add("active");
    const targetPanel = document.getElementById(btn.dataset.tab);
    if (targetPanel) targetPanel.classList.add("active");
  };
});

/* ================= LOGIN ================= */
async function login() {
  const email = document.getElementById("email")?.value;
  const password = document.getElementById("password")?.value;

  if (!email || !password) return alert("Please enter credentials");

  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (res.ok) {
      localStorage.setItem("loggedIn", "true");
      window.location.href = "index.html";
    } else {
      alert(data.error || "Login failed");
    }
  } catch (err) {
    console.error(err);
    alert("Server error - check if the Render backend is awake.");
  }
}

/* ================= EMPLOYEES ================= */
async function addEmployee() {
  const inputs = {
    name: document.getElementById("empName"),
    pos: document.getElementById("empRole"),
    sal: document.getElementById("empSalary"),
    mgr: document.getElementById("empManager"),
    area: document.getElementById("empArea")
  };

  const body = {
    name: inputs.name.value,
    position: inputs.pos.value,
    salary: inputs.sal.value,
    managerId: inputs.mgr.value,
    areaId: inputs.area.value
  };

  try {
    const res = await fetch(`${API}/employees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      // Clear inputs
      Object.values(inputs).forEach(i => i.value = "");
      loadEmployees();
    }
  } catch (err) {
    console.error("Add employee failed", err);
  }
}

async function loadEmployees() {
  try {
    const res = await fetch(`${API}/employees`);
    const data = await res.json();
    const table = document.getElementById("empTable");
    
    if (table) {
      table.innerHTML = data.map(e => `
        <tr>
          <td>${e.Name || 'N/A'}</td>
          <td>${e.Position || 'N/A'}</td>
          <td>${e.Salary ? '$' + Number(e.Salary).toLocaleString() : '0'}</td>
        </tr>
      `).join("");
    }
  } catch (err) {
    console.error("Employee load failed", err);
  }
}

/* ================= MANAGERS ================= */
async function addManager() {
  const idInput = document.getElementById("mgrId");
  const nameInput = document.getElementById("mgrName");

  const body = { id: idInput.value, name: nameInput.value };

  const res = await fetch(`${API}/managers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (res.ok) {
    idInput.value = "";
    nameInput.value = "";
    loadManagers();
  }
}

async function loadManagers() {
  try {
    const res = await fetch(`${API}/managers`);
    const data = await res.json();
    document.getElementById("mgrTable").innerHTML = data.map(m => `
      <tr>
        <td>${m.ManagerID}</td>
        <td>${m.ManagerName}</td>
      </tr>
    `).join("");
  } catch (err) { console.error(err); }
}

/* ================= ACTIVITY & SALARY (Simplified Load) ================= */
async function loadActivity() {
  try {
    const res = await fetch(`${API}/activity`);
    const data = await res.json();
    document.getElementById("actTable").innerHTML = data.map(a => `
      <tr>
        <td>${a.Name}</td>
        <td>${a.PerformanceScore}</td>
        <td>${a.WorkloadNotes}</td>
      </tr>
    `).join("");
  } catch (err) { console.error(err); }
}

async function loadSalary() {
  try {
    const res = await fetch(`${API}/salary`);
    const data = await res.json();
    document.getElementById("salTable").innerHTML = data.map(s => `
      <tr>
        <td>${s.Name}</td>
        <td>${s.Salary ? '$' + Number(s.Salary).toLocaleString() : '0'}</td>
      </tr>
    `).join("");
  } catch (err) { console.error(err); }
}

/* ================= INIT ================= */
window.onload = () => {
  // Check if we are on the main dashboard page
  const isDashboard = window.location.pathname.endsWith("index.html") || window.location.pathname === "/";
  
  if (isDashboard) {
    if (!localStorage.getItem("loggedIn")) {
      window.location.href = "login.html";
      return;
    }

    // Load all data
    loadEmployees();
    loadManagers();
    loadActivity();
    loadSalary();
  }
};
