// ===============================
// 🔹 GLOBAL STATE
// ===============================
let employees = [];
let editMode = false;
let editId = null;

// ===============================
// 🔹 DOM ELEMENTS
// ===============================
const formAdd = document.getElementById("form-add-employee");
const formEdit = document.getElementById("form-edit-employee");
const tbody = document.getElementById("tbody-employees");
const editCard = document.getElementById("card-edit-employee");
const toast = document.getElementById("toast");

// ===============================
// 🔹 TOAST MESSAGE
// ===============================
function showToast(msg, isError = false) {
  toast.textContent = msg;
  toast.className = "toast show" + (isError ? " error" : "");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// ===============================
// 🔹 TAB SWITCHING
// ===============================
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));

    tab.classList.add("active");
    document
      .getElementById("panel-" + tab.dataset.tab)
      .classList.add("active");
  });
});

// ===============================
// 🔹 RENDER EMPLOYEES TABLE
// ===============================
function renderEmployees() {
  tbody.innerHTML = "";

  employees.forEach(emp => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${emp.id}</td>
      <td>${emp.name}</td>
      <td>${emp.position}</td>
      <td>${emp.salary}</td>
      <td>${emp.hireDate}</td>
      <td>${emp.managerId || "-"}</td>
      <td>${emp.areaId || "-"}</td>
      <td>
        <button class="btn btn-small btn-ghost" onclick="editEmployee(${emp.id})">Edit</button>
        <button class="btn btn-small btn-danger" onclick="deleteEmployee(${emp.id})">Delete</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// ===============================
// 🔹 ADD EMPLOYEE
// ===============================
formAdd.addEventListener("submit", function (e) {
  e.preventDefault(); // 🔥 IMPORTANT FIX

  const data = new FormData(formAdd);

  const newEmp = {
    id: Date.now(),
    name: data.get("Name"),
    position: data.get("Position"),
    salary: data.get("Salary"),
    hireDate: data.get("HireDate"),
    managerId: data.get("ManagerID"),
    areaId: data.get("AreaID")
  };

  employees.push(newEmp);
  renderEmployees();

  formAdd.reset();
  showToast("Employee added successfully");
});

// ===============================
// 🔹 DELETE EMPLOYEE
// ===============================
function deleteEmployee(id) {
  employees = employees.filter(emp => emp.id !== id);
  renderEmployees();
  showToast("Employee deleted");
}

// ===============================
// 🔹 EDIT EMPLOYEE (LOAD INTO FORM)
// ===============================
function editEmployee(id) {
  const emp = employees.find(e => e.id === id);

  if (!emp) return;

  editMode = true;
  editId = id;

  editCard.classList.remove("hidden");

  formEdit.EmployeeID.value = emp.id;
  formEdit.Name.value = emp.name;
  formEdit.Position.value = emp.position;
  formEdit.Salary.value = emp.salary;
  formEdit.HireDate.value = emp.hireDate;
  formEdit.ManagerID.value = emp.managerId || "";
  formEdit.AreaID.value = emp.areaId || "";
}

// ===============================
// 🔹 SAVE EDIT
// ===============================
formEdit.addEventListener("submit", function (e) {
  e.preventDefault();

  const data = new FormData(formEdit);

  employees = employees.map(emp =>
    emp.id === editId
      ? {
          id: editId,
          name: data.get("Name"),
          position: data.get("Position"),
          salary: data.get("Salary"),
          hireDate: data.get("HireDate"),
          managerId: data.get("ManagerID"),
          areaId: data.get("AreaID")
        }
      : emp
  );

  renderEmployees();

  editCard.classList.add("hidden");
  formEdit.reset();

  editMode = false;
  editId = null;

  showToast("Employee updated");
});

// ===============================
// 🔹 CANCEL EDIT
// ===============================
document
  .getElementById("btn-cancel-edit")
  ?.addEventListener("click", () => {
    editCard.classList.add("hidden");
    formEdit.reset();
    editMode = false;
  });

// ===============================
// 🔹 INITIAL LOAD
// ===============================
renderEmployees();
