const API = "https://your-render-url.onrender.com"; // replace later

/* -------- Tabs -------- */
document.querySelectorAll(".tab").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  };
});

/* -------- Employees -------- */
async function addEmployee() {
  const name = document.getElementById("empName").value;
  const role = document.getElementById("empRole").value;

  await fetch(`${API}/employees`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({name, role})
  });

  loadEmployees();
}

async function loadEmployees() {
  const res = await fetch(`${API}/employees`);
  const data = await res.json();

  document.getElementById("empTable").innerHTML =
    data.map(e => `<tr><td>${e.name}</td><td>${e.role}</td></tr>`).join("");
}

/* -------- Managers -------- */
async function addManager() {
  const name = document.getElementById("mgrName").value;

  await fetch(`${API}/managers`, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({name})
  });

  loadManagers();
}

async function loadManagers() {
  const res = await fetch(`${API}/managers`);
  const data = await res.json();

  document.getElementById("mgrTable").innerHTML =
    data.map(m => `<tr><td>${m.name}</td></tr>`).join("");
}

/* -------- Activity -------- */
async function addActivity() {
  const desc = document.getElementById("actDesc").value;

  await fetch(`${API}/activities`, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({desc})
  });

  loadActivity();
}

async function loadActivity() {
  const res = await fetch(`${API}/activities`);
  const data = await res.json();

  document.getElementById("actTable").innerHTML =
    data.map(a => `<tr><td>${a.desc}</td></tr>`).join("");
}

/* -------- Salary -------- */
async function addSalary() {
  const name = document.getElementById("salName").value;
  const amount = document.getElementById("salAmount").value;

  await fetch(`${API}/salary`, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({name, amount})
  });

  loadSalary();
}

async function loadSalary() {
  const res = await fetch(`${API}/salary`);
  const data = await res.json();

  document.getElementById("salTable").innerHTML =
    data.map(s => `<tr><td>${s.name}</td><td>${s.amount}</td></tr>`).join("");
}

/* -------- Init -------- */
loadEmployees();
loadManagers();
loadActivity();
loadSalary();
