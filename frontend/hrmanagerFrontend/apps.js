"use strict";

const api = (path, options = {}) =>
  fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  }).then(async (res) => {
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }
    if (!res.ok) {
      let msg = data && data.error ? data.error : res.statusText;
      if (data && data.hint) msg += " — " + data.hint;
      if (data && data.sqlMessage) msg += " — " + data.sqlMessage;
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return data;
  });

function showToast(message, isError) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.toggle("error", !!isError);
  el.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove("show"), 3800);
}

async function downloadReport(path, filename) {
  const res = await fetch(path);
  const blob = await res.blob();
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const t = await blob.text();
      const j = JSON.parse(t);
      if (j.error) msg = j.error;
      if (j.hint) msg += " — " + j.hint;
      if (j.sqlMessage) msg += " — " + j.sqlMessage;
    } catch {
      /* keep msg */
    }
    showToast(msg, true);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`Saved ${filename}`);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtSalary(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (d == null) return "—";
  return String(d).slice(0, 10);
}

let managers = [];
let employees = [];

function showPanel(tab) {
  ["employees", "by-area", "assign", "maintenance", "performance"].forEach((id) => {
    const p = document.getElementById(`panel-${id}`);
    const on = id === tab;
    p.classList.toggle("active", on);
    p.toggleAttribute("hidden", !on);
  });
}

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === btn));
    showPanel(btn.dataset.tab);
  });
});

async function loadManagers() {
  managers = await api("/managers");
}

function managerSelectOptions(selectedId) {
  const sel = selectedId == null ? "" : String(selectedId);
  let html = '<option value="">— Unassigned —</option>';
  for (const m of managers) {
    const id = m.ManagerID ?? m.managerid;
    const name = m.ManagerName ?? m.managername ?? "";
    const area = m.AreaName ?? m.areaname ?? "";
    const label = `${id}${name ? " — " + name : ""}${area ? " (" + area + ")" : ""}`;
    const isSel = String(id) === sel ? " selected" : "";
    html += `<option value="${id}"${isSel}>${escapeHtml(label)}</option>`;
  }
  return html;
}

async function refreshEmployees() {
  employees = await api("/employees");
  const tbody = document.getElementById("tbody-employees");
  tbody.innerHTML = employees
    .map(
      (e) => `
    <tr data-id="${e.EmployeeID ?? e.employeeid}">
      <td class="num">${e.EmployeeID ?? e.employeeid}</td>
      <td>${escapeHtml(e.Name ?? e.name)}</td>
      <td>${escapeHtml(e.Position ?? e.position)}</td>
      <td class="num">${fmtSalary(e.Salary ?? e.salary)}</td>
      <td>${escapeHtml(fmtDate(e.HireDate ?? e.hiredate))}</td>
      <td class="num">${e.ManagerID ?? e.managerid ?? "—"}</td>
      <td class="num">${e.AreaID ?? e.areaid ?? "—"}</td>
      <td>
        <button type="button" class="btn btn-ghost btn-small btn-edit">Edit</button>
        <button type="button" class="btn btn-danger btn-small btn-del">Delete</button>
      </td>
    </tr>`
    )
    .join("");
}

document.getElementById("tbody-employees").addEventListener("click", async (ev) => {
  const edit = ev.target.closest(".btn-edit");
  const del = ev.target.closest(".btn-del");
  if (edit) {
    const tr = edit.closest("tr");
    const id = tr.dataset.id;
    const e = employees.find((x) => String(x.EmployeeID ?? x.employeeid) === String(id));
    if (!e) return;
    const card = document.getElementById("card-edit-employee");
    const f = document.getElementById("form-edit-employee");
    f.EmployeeID.value = e.EmployeeID ?? e.employeeid;
    f.Name.value = e.Name ?? e.name;
    f.Position.value = e.Position ?? e.position;
    f.Salary.value = e.Salary ?? e.salary;
    f.HireDate.value = fmtDate(e.HireDate ?? e.hiredate);
    f.ManagerID.value = e.ManagerID ?? e.managerid ?? "";
    f.AreaID.value = e.AreaID ?? e.areaid ?? "";
    card.classList.remove("hidden");
    return;
  }
  if (del) {
    const id = del.closest("tr").dataset.id;
    if (!confirm(`Delete employee ${id}?`)) return;
    try {
      await api(`/employees/${id}`, { method: "DELETE" });
      showToast("Deleted");
      await refreshEmployees();
      await refreshAssignTable();
    } catch (err) {
      showToast(err.message, true);
    }
  }
});

document.getElementById("form-add-employee").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  const body = {
    Name: f.Name.value.trim(),
    Position: f.Position.value.trim(),
    Salary: f.Salary.value,
    HireDate: f.HireDate.value,
    ManagerID: f.ManagerID.value === "" ? null : f.ManagerID.value,
    AreaID: f.AreaID.value === "" ? null : f.AreaID.value,
  };
  try {
    await api("/employees", { method: "POST", body: JSON.stringify(body) });
    showToast("Employee added");
    f.reset();
    await refreshEmployees();
    await refreshAssignTable();
  } catch (err) {
    showToast(err.message, true);
  }
});

document.getElementById("form-edit-employee").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  const id = f.EmployeeID.value;
  const body = {
    Name: f.Name.value.trim(),
    Position: f.Position.value.trim(),
    Salary: f.Salary.value,
    HireDate: f.HireDate.value,
    ManagerID: f.ManagerID.value === "" ? null : f.ManagerID.value,
    AreaID: f.AreaID.value === "" ? null : f.AreaID.value,
  };
  try {
    await api(`/employees/${id}`, { method: "PUT", body: JSON.stringify(body) });
    showToast("Saved");
    document.getElementById("card-edit-employee").classList.add("hidden");
    await refreshEmployees();
    await refreshAssignTable();
  } catch (err) {
    showToast(err.message, true);
  }
});

document.getElementById("btn-cancel-edit").addEventListener("click", () => {
  document.getElementById("card-edit-employee").classList.add("hidden");
});

document.getElementById("btn-refresh-employees").addEventListener("click", () => {
  refreshEmployees().catch((e) => showToast(e.message, true));
});

document.getElementById("btn-report-md").addEventListener("click", () => {
  downloadReport("/report?format=md", "hr-data-report.md").catch((e) => showToast(e.message, true));
});

document.getElementById("btn-report-json").addEventListener("click", () => {
  downloadReport("/report?format=json&download=1", "hr-data-report.json").catch((e) =>
    showToast(e.message, true)
  );
});

async function refreshByArea() {
  const groups = await api("/employees/by-area");
  const root = document.getElementById("by-area-content");
  root.innerHTML = groups
    .map((g) => {
      const aid = g.AreaID ?? g.areaid;
      const an = g.AreaName ?? g.areaname ?? "—";
      const rows = (g.employees || [])
        .map(
          (e) => `
        <tr>
          <td class="num">${e.EmployeeID ?? e.employeeid}</td>
          <td>${escapeHtml(e.Name ?? e.name)}</td>
          <td>${escapeHtml(e.Position ?? e.position)}</td>
          <td class="num">${fmtSalary(e.Salary ?? e.salary)}</td>
          <td>${escapeHtml(fmtDate(e.HireDate ?? e.hiredate))}</td>
          <td class="num">${e.ManagerID ?? e.managerid ?? "—"}</td>
        </tr>`
        )
        .join("");
      return `<div class="area-block">
        <h3>${escapeHtml(an)} <span class="hint">(AreaID: ${aid ?? "—"})</span></h3>
        <div class="table-wrap"><table class="data-table"><thead><tr>
          <th>ID</th><th>Name</th><th>Position</th><th>Salary</th><th>Hire</th><th>Mgr</th>
        </tr></thead><tbody>${rows || '<tr><td colspan="6" class="hint">No employees</td></tr>'}</tbody></table></div>
      </div>`;
    })
    .join("");
}

document.getElementById("btn-refresh-by-area").addEventListener("click", () => {
  refreshByArea().catch((e) => showToast(e.message, true));
});

async function refreshAssignTable() {
  await refreshEmployees();
  if (!managers.length) await loadManagers();
  const tbody = document.getElementById("tbody-assign");
  tbody.innerHTML = employees
    .map((e) => {
      const id = e.EmployeeID ?? e.employeeid;
      const mid = e.ManagerID ?? e.managerid;
      return `<tr>
        <td class="num">${id}</td>
        <td>${escapeHtml(e.Name ?? e.name)}</td>
        <td class="num">${mid ?? "—"}</td>
        <td><select class="sel-assign-mgr" data-emp="${id}">${managerSelectOptions(mid)}</select></td>
        <td><button type="button" class="btn btn-primary btn-small btn-save-assign" data-emp="${id}">Save</button></td>
      </tr>`;
    })
    .join("");
}

document.getElementById("tbody-assign").addEventListener("click", async (ev) => {
  const btn = ev.target.closest(".btn-save-assign");
  if (!btn) return;
  const empid = btn.dataset.emp;
  const row = btn.closest("tr");
  const sel = row.querySelector(".sel-assign-mgr");
  const newMid = sel.value === "" ? null : Number(sel.value);
  try {
    await api("/assign-manager", {
      method: "PUT",
      body: JSON.stringify({ EmployeeID: Number(empid), ManagerID: newMid }),
    });
    showToast("Manager assigned");
    await refreshEmployees();
    await refreshAssignTable();
  } catch (err) {
    showToast(err.message, true);
  }
});

document.getElementById("btn-refresh-assign").addEventListener("click", () => {
  loadManagers().then(() => refreshAssignTable()).catch((e) => showToast(e.message, true));
});

async function refreshMaintenance() {
  const st = document.getElementById("filter-maint-status").value;
  const q = st ? `?status=${encodeURIComponent(st)}` : "";
  const rows = await api(`/maintenance${q}`);
  const tbody = document.getElementById("tbody-maint");
  const statusOptions = (current) => {
    const o = ["Pending", "In Progress", "Completed"];
    return o
      .map(
        (s) =>
          `<option value="${s}"${current === s ? " selected" : ""}>${escapeHtml(s)}</option>`
      )
      .join("");
  };
  tbody.innerHTML = rows
    .map((m) => {
      const id = m.MaintenanceAssignmentID ?? m.maintenanceassignmentid;
      const stVal = m.Status ?? m.status;
      return `<tr data-id="${id}">
        <td class="num">${id}</td>
        <td>${escapeHtml(m.EmployeeName ?? m.employeename ?? m.employeeid)}</td>
        <td>${escapeHtml(m.AreaName ?? m.areaname ?? "—")}</td>
        <td>${escapeHtml(m.TaskDescription ?? m.taskdescription)}</td>
        <td><select class="sel-maint-st">${statusOptions(stVal)}</select></td>
        <td>${escapeHtml(fmtDate(m.DueDate ?? m.duedate))}</td>
        <td>
          <button type="button" class="btn btn-ghost btn-small btn-upd-maint">Update</button>
          <button type="button" class="btn btn-danger btn-small btn-del-maint">Delete</button>
        </td>
      </tr>`;
    })
    .join("");
  if (!rows.length) tbody.innerHTML = '<tr><td colspan="7" class="hint">No rows</td></tr>';
}

document.getElementById("tbody-maint").addEventListener("click", async (ev) => {
  const upd = ev.target.closest(".btn-upd-maint");
  const del = ev.target.closest(".btn-del-maint");
  const tr = ev.target.closest("tr");
  if (!tr) return;
  const id = tr.dataset.id;
  if (upd) {
    const status = tr.querySelector(".sel-maint-st").value;
    try {
      await api(`/maintenance/${id}`, { method: "PUT", body: JSON.stringify({ Status: status }) });
      showToast("Updated");
      await refreshMaintenance();
      await refreshPerformanceDashboard();
    } catch (err) {
      showToast(err.message, true);
    }
  }
  if (del) {
    if (!confirm("Delete this assignment?")) return;
    try {
      await api(`/maintenance/${id}`, { method: "DELETE" });
      showToast("Deleted");
      await refreshMaintenance();
      await refreshPerformanceDashboard();
    } catch (err) {
      showToast(err.message, true);
    }
  }
});

document.getElementById("form-maint").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  const body = {
    EmployeeID: f.EmployeeID.value,
    AreaID: f.AreaID.value === "" ? null : f.AreaID.value,
    TaskDescription: f.TaskDescription.value.trim(),
    Status: f.Status.value,
    DueDate: f.DueDate.value === "" ? null : f.DueDate.value,
  };
  try {
    await api("/maintenance", { method: "POST", body: JSON.stringify(body) });
    showToast("Created");
    f.TaskDescription.value = "";
    f.DueDate.value = "";
    await refreshMaintenance();
    await refreshPerformanceDashboard();
  } catch (err) {
    showToast(err.message, true);
  }
});

document.getElementById("filter-maint-status").addEventListener("change", () => {
  refreshMaintenance().catch((e) => showToast(e.message, true));
});

document.getElementById("btn-refresh-maint").addEventListener("click", () => {
  refreshMaintenance().then(() => refreshPerformanceDashboard()).catch((e) => showToast(e.message, true));
});

function buildSummary(empList, maintList, perfList) {
  const map = new Map();
  for (const e of empList) {
    const id = e.EmployeeID ?? e.employeeid;
    map.set(id, {
      EmployeeID: id,
      Name: e.Name ?? e.name,
      AreaID: e.AreaID ?? e.areaid,
      ManagerID: e.ManagerID ?? e.managerid,
      openMaint: 0,
      doneMaint: 0,
      scores: [],
    });
  }
  for (const m of maintList) {
    const eid = m.EmployeeID ?? m.employeeid;
    if (!map.has(eid)) continue;
    const st = m.Status ?? m.status;
    if (st === "Completed") map.get(eid).doneMaint++;
    else map.get(eid).openMaint++;
  }
  for (const p of perfList) {
    const eid = p.EmployeeID ?? p.employeeid;
    if (!map.has(eid)) continue;
    const sc = Number(p.PerformanceScore ?? p.performancescore);
    if (Number.isFinite(sc)) map.get(eid).scores.push(sc);
  }
  return [...map.values()].map((row) => {
    const avg =
      row.scores.length > 0
        ? row.scores.reduce((a, b) => a + b, 0) / row.scores.length
        : null;
    return { ...row, AvgPerformanceScore: avg, ReviewCount: row.scores.length };
  });
}

async function refreshPerformanceDashboard() {
  const [emps, maint, perf] = await Promise.all([
    api("/employees"),
    api("/maintenance"),
    api("/performance"),
  ]);
  employees = emps;
  const summary = buildSummary(emps, maint, perf);
  const tbody = document.getElementById("tbody-summary");
  tbody.innerHTML = summary
    .map((r) => {
      const areaLabel = r.AreaID != null ? `Area ${r.AreaID}` : "—";
      const avg =
        r.AvgPerformanceScore != null ? r.AvgPerformanceScore.toFixed(2) : "—";
      return `<tr>
        <td>${escapeHtml(r.Name)}</td>
        <td>${escapeHtml(areaLabel)}</td>
        <td class="num">${r.ManagerID ?? "—"}</td>
        <td class="num">${r.openMaint}</td>
        <td class="num">${r.doneMaint}</td>
        <td class="num">${avg}</td>
        <td class="num">${r.ReviewCount}</td>
      </tr>`;
    })
    .join("");

  const tperf = document.getElementById("tbody-performance");
  tperf.innerHTML = perf
    .map(
      (p) => `
    <tr>
      <td class="num">${p.PerformanceID ?? p.performanceid}</td>
      <td>${escapeHtml(p.EmployeeName ?? p.employeename ?? p.EmployeeID)}</td>
      <td>${escapeHtml(fmtDate(p.ReviewDate ?? p.reviewdate))}</td>
      <td class="num">${p.PerformanceScore ?? p.performancescore ?? "—"}</td>
      <td>${escapeHtml(p.WorkloadNotes ?? p.workloadnotes ?? "—")}</td>
    </tr>`
    )
    .join("");
  if (!perf.length) tperf.innerHTML = '<tr><td colspan="5" class="hint">No reviews</td></tr>';
}

document.getElementById("btn-refresh-perf").addEventListener("click", () => {
  refreshPerformanceDashboard().catch((e) => showToast(e.message, true));
});

(async function init() {
  try {
    await loadManagers();
  } catch (e) {
    showToast("Managers: " + e.message, true);
  }
  try {
    await refreshEmployees();
    await refreshByArea();
    await refreshAssignTable();
  } catch (e) {
    showToast("Employees: " + e.message, true);
  }
  try {
    await refreshMaintenance();
  } catch (e) {
    showToast("Maintenance: " + e.message, true);
  }
  try {
    await refreshPerformanceDashboard();
  } catch (e) {
    showToast("Performance & workload: " + e.message, true);
  }
})();
