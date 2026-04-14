import { query } from "./db.js";

const MAINT_STATUSES = ["Pending", "In Progress", "Completed"];

export async function listManagers() {
  return query(
    `SELECT h.ManagerID, m.ManagerName, a.AreaName
     FROM hrmanager h
     INNER JOIN manager m ON m.ManagerID = h.ManagerID
     LEFT JOIN area a ON a.AreaID = h.AreaID
     ORDER BY h.ManagerID`
  );
}

export async function listEmployees() {
  return query(
    `SELECT EmployeeID, Name, Position, Salary, HireDate, ManagerID, AreaID
     FROM employee
     ORDER BY EmployeeID`
  );
}

export async function listEmployeesByArea() {
  const areas = await query(`SELECT AreaID, AreaName FROM area ORDER BY AreaID`);
  const emps = await query(
    `SELECT EmployeeID, Name, Position, Salary, HireDate, ManagerID, AreaID
     FROM employee
     ORDER BY EmployeeID`
  );
  const groups = areas.map((a) => ({
    AreaID: a.AreaID,
    AreaName: a.AreaName,
    employees: emps.filter((e) => e.AreaID === a.AreaID),
  }));
  const unassigned = emps.filter((e) => e.AreaID == null);
  if (unassigned.length) {
    groups.push({
      AreaID: null,
      AreaName: "Unassigned",
      employees: unassigned,
    });
  }
  return groups;
}

export async function insertEmployee({ Name, Position, Salary, HireDate, ManagerID, AreaID }) {
  const result = await query(
    `INSERT INTO employee (Name, Position, Salary, HireDate, ManagerID, AreaID)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [Name, Position, Salary, HireDate, ManagerID, AreaID]
  );
  return { EmployeeID: Number(result.insertId) };
}

export async function updateEmployee(id, { Name, Position, Salary, HireDate, ManagerID, AreaID }) {
  const result = await query(
    `UPDATE employee SET Name = ?, Position = ?, Salary = ?, HireDate = ?, ManagerID = ?, AreaID = ?
     WHERE EmployeeID = ?`,
    [Name, Position, Salary, HireDate, ManagerID, AreaID, id]
  );
  return result.affectedRows;
}

export async function deleteEmployee(id) {
  const result = await query("DELETE FROM employee WHERE EmployeeID = ?", [id]);
  return result.affectedRows;
}

export async function updateEmployeeManager(EmployeeID, ManagerID) {
  const result = await query("UPDATE employee SET ManagerID = ? WHERE EmployeeID = ?", [
    ManagerID,
    EmployeeID,
  ]);
  return result.affectedRows;
}

export async function listMaintenance(status) {
  let sql = `SELECT m.MaintenanceAssignmentID, m.EmployeeID, m.AreaID, m.TaskDescription, m.Status, m.DueDate, m.CreatedAt,
        e.Name AS EmployeeName, a.AreaName
      FROM maintenanceassignment m
      LEFT JOIN employee e ON e.EmployeeID = m.EmployeeID
      LEFT JOIN area a ON a.AreaID = m.AreaID`;
  const params = [];
  if (status) {
    sql += " WHERE m.Status = ?";
    params.push(status);
  }
  sql += " ORDER BY m.CreatedAt DESC";
  return query(sql, params);
}

export async function insertMaintenanceAssignment({
  EmployeeID,
  AreaID,
  TaskDescription,
  Status,
  DueDate,
}) {
  const result = await query(
    `INSERT INTO maintenanceassignment (EmployeeID, AreaID, TaskDescription, Status, DueDate)
     VALUES (?, ?, ?, ?, ?)`,
    [EmployeeID, AreaID, TaskDescription, Status, DueDate]
  );
  return { MaintenanceAssignmentID: Number(result.insertId) };
}

export async function updateMaintenanceAssignmentStatus(id, Status) {
  const result = await query(
    "UPDATE maintenanceassignment SET Status = ? WHERE MaintenanceAssignmentID = ?",
    [Status, id]
  );
  return result.affectedRows;
}

export async function deleteMaintenanceAssignment(id) {
  const result = await query("DELETE FROM maintenanceassignment WHERE MaintenanceAssignmentID = ?", [id]);
  return result.affectedRows;
}

export async function listPerformance() {
  return query(
    `SELECT p.PerformanceID, p.EmployeeID, p.ReviewDate, p.PerformanceScore, p.WorkloadNotes,
            e.Name AS EmployeeName
     FROM employeeperformance p
     LEFT JOIN employee e ON e.EmployeeID = p.EmployeeID
     ORDER BY p.ReviewDate DESC, p.PerformanceID DESC`
  );
}

export async function loadReportPayload() {
  const managers = await listManagers();
  const employees = await listEmployees();
  const areas = await query(`SELECT AreaID, AreaName FROM area ORDER BY AreaID`);
  const employeesByArea = areas.map((a) => ({
    AreaID: a.AreaID,
    AreaName: a.AreaName,
    employees: employees.filter((e) => e.AreaID === a.AreaID),
  }));
  const unassigned = employees.filter((e) => e.AreaID == null);
  if (unassigned.length) {
    employeesByArea.push({
      AreaID: null,
      AreaName: "Unassigned",
      employees: unassigned,
    });
  }
  const maintenance = await listMaintenance(null);
  const performance = await query(
    `SELECT p.PerformanceID, p.EmployeeID, p.ReviewDate, p.PerformanceScore, p.WorkloadNotes, e.Name AS EmployeeName
     FROM employeeperformance p
     LEFT JOIN employee e ON e.EmployeeID = p.EmployeeID
     ORDER BY p.ReviewDate DESC`
  );
  return {
    generatedAt: new Date().toISOString(),
    managers,
    employees,
    employeesByArea,
    maintenance,
    performance,
  };
}

export { MAINT_STATUSES };
