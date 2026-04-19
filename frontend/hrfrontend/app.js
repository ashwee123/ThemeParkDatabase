const API = "http://localhost:5000"; // change after deploy

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
  const body = {
    name: empName.value,
    position: empRole.value,
    salary: empSalary.value,
    managerId: empManager.value,
    areaId: empArea.value
  };

  await fetch(`${API}/employees`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body)
  });

  loadEmployees();
}

async function loadEmployees() {
  const res = await fetch(`${API}/employees`);
  const data = await res.json();

  empTable.innerHTML = data.map(e =>
    `<tr><td>${e.Name}</td><td>${e.Position}</td><td>${e.Salary}</td></tr>`
  ).join("");
}

/* -------- Managers -------- */
async function addManager() {
  const body = {
    id: mgrId.value,
    name: mgrName.value
  };

  await fetch(`${API}/managers`, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify(body)
  });

  loadManagers();
}

async function loadManagers() {
  const res = await fetch(`${API}/managers`);
  const data = await res.json();

  mgrTable.innerHTML = data.map(m =>
    `<tr><td>${m.ManagerID}</td><td>${m.ManagerName}</td></tr>`
  ).join("");
}

/* -------- Activity -------- */
async function addActivity() {
  const body = {
    employeeId: actEmpId.value,
    score: actScore.value,
    notes: actNotes.value
  };

  await fetch(`${API}/activity`, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify(body)
  });

  loadActivity();
}

async function loadActivity() {
  const res = await fetch(`${API}/activity`);
  const data = await res.json();

  actTable.innerHTML = data.map(a =>
    `<tr><td>${a.Name}</td><td>${a.PerformanceScore}</td><td>${a.WorkloadNotes}</td></tr>`
  ).join("");
}

/* -------- Salary -------- */
async function loadSalary() {
  const res = await fetch(`${API}/salary`);
  const data = await res.json();

  salTable.innerHTML = data.map(s =>
    `<tr><td>${s.Name}</td><td>${s.Salary}</td></tr>`
  ).join("");
}

/* -------- Init -------- */
loadEmployees();
loadManagers();
loadActivity();
loadSalary();
