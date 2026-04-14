// frontend/maintenancePortal/app.js

async function fetchEmployees() {
    const res = await fetch(`${API_BASE}/tasks/employees`);
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

async function loadMaintenance() {
    const res = await fetch(`${API_BASE}/maintenance`);
    const data = await res.json();

    const tbody = document.getElementById('tbody-maint');
    tbody.innerHTML = '';

    data.forEach(task => {
        tbody.innerHTML += `
            <tr>
                <td>${task.MaintenanceAssignmentID}</td>
                <td>${task.EmployeeName}</td>
                <td>${task.AreaName || ''}</td>
                <td>${task.TaskDescription}</td>
                <td>${task.Status}</td>
                <td>${task.DueDate || ''}</td>
            </tr>
        `;
    });
}

// ✅ FORM SUBMIT
document.getElementById('form-add-task').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target);

  await fetch(`${API_BASE}/addTasks`, {
    method: 'POST',
    body: formData
  });

  // 1. Refresh the data
  loadTasks();
  
  // 2. Clear the form
  e.target.reset();

  // 3. OPTIONAL: Switch back to the "All Tasks" tab automatically
  document.querySelector('[data-tab="tasks"]').click(); 
});
