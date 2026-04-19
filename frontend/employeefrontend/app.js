/**
 * Employee portal — front end only.
 * Set API_BASE when your Node (http) server exposes JSON routes; until then, mock data from the DB dump is used.
 *
 * Employee listing / profile match Section 3 SQL (see sql/section3-employees.sql):
 * - List order: ORDER BY AreaID IS NULL, AreaID, Name
 * - Profile row shape: employee columns + AreaName from LEFT JOIN area
 * - With the Node server, API routes live under /api (see server.js). Set API_BASE to "" to use mock data only (static demo).
 */
export const API_BASE = "/api";
const HR_EMPLOYEE_FALLBACK_API = "https://hrmanager-39yw.onrender.com";

const STORAGE_EMPLOYEE = "tp_employee_portal_id";

/** @type {Record<number, string>} */
const AREA_NAMES = {
  1: "Zone A",
  101: "rides zone",
  102: "food court",
  103: "kids area",
};

/**
 * Matches `employee` + `area.AreaName` (LEFT JOIN), per your second Section 3 query.
 * @typedef {{ EmployeeID: number, Name: string, Position: string, Salary: number, HireDate: string, ManagerID: number|null, AreaID: number|null, AreaName: string|null }} EmployeeRow
 */

/** @type {EmployeeRow[]} */
const MOCK_EMPLOYEES = [
  { EmployeeID: 1, Name: "sam", Position: "staff", Salary: 30000, HireDate: "2023-01-01", ManagerID: 5, AreaID: 101, AreaName: "rides zone" },
  { EmployeeID: 2, Name: "rita", Position: "supervisor", Salary: 40000, HireDate: "2022-06-15", ManagerID: 5, AreaID: 101, AreaName: "rides zone" },
  { EmployeeID: 3, Name: "tom", Position: "staff", Salary: 28000, HireDate: "2023-03-10", ManagerID: 5, AreaID: 102, AreaName: "food court" },
  { EmployeeID: 4, Name: "lisa", Position: "manager assistant", Salary: 35000, HireDate: "2022-11-20", ManagerID: 1, AreaID: 103, AreaName: "kids area" },
];

/** Cache the most recent employee option source for profile/header lookups. */
let employeeOptionsCache = [];

/** Same ordering as: ORDER BY AreaID IS NULL, AreaID, Name */
function compareEmployeeQueryOrder(a, b) {
  const aNull = a.AreaID == null ? 1 : 0;
  const bNull = b.AreaID == null ? 1 : 0;
  if (aNull !== bNull) return aNull - bNull;
  if ((a.AreaID ?? -1) !== (b.AreaID ?? -1)) return (a.AreaID ?? 0) - (b.AreaID ?? 0);
  return String(a.Name).localeCompare(String(b.Name), undefined, { sensitivity: "base" });
}

function employeesSortedForPortal() {
  return [...MOCK_EMPLOYEES].sort(compareEmployeeQueryOrder);
}

/** Last profile row from API or mock; used for header after async load. */
let cachedEmployeeDetail = null;

/** Demo rows for `shift` */
const MOCK_SHIFTS = [
  { ShiftID: 1, EmployeeID: 1, ShiftDate: "2026-04-10", StartTime: "09:00:00", EndTime: "17:00:00" },
  { ShiftID: 2, EmployeeID: 1, ShiftDate: "2026-04-11", StartTime: "10:00:00", EndTime: "18:00:00" },
  { ShiftID: 3, EmployeeID: 2, ShiftDate: "2026-04-10", StartTime: "08:00:00", EndTime: "16:00:00" },
  { ShiftID: 4, EmployeeID: 3, ShiftDate: "2026-04-12", StartTime: "12:00:00", EndTime: "20:00:00" },
  { ShiftID: 5, EmployeeID: 4, ShiftDate: "2026-04-09", StartTime: "09:30:00", EndTime: "17:30:00" },
];

/** Demo `timelog` */
const MOCK_TIMELOG = [
  { LogID: 1, EmployeeID: 1, ClockIn: "2026-04-08 08:55:00", ClockOut: "2026-04-08 17:02:00", HoursWorked: 8.12 },
  { LogID: 2, EmployeeID: 1, ClockIn: "2026-04-09 09:00:00", ClockOut: "2026-04-09 16:58:00", HoursWorked: 7.97 },
];

/** Demo `employeeperformance` */
const MOCK_PERFORMANCE = [
  { PerformanceID: 1, EmployeeID: 1, ReviewDate: "2025-12-01", PerformanceScore: 4.5, WorkloadNotes: "Reliable on floor." },
  { PerformanceID: 2, EmployeeID: 2, ReviewDate: "2025-12-01", PerformanceScore: 4.8, WorkloadNotes: "Strong leadership." },
];

/** Demo `maintenanceassignment` */
const MOCK_TASKS = [
  {
    MaintenanceAssignmentID: 1,
    EmployeeID: 1,
    AreaID: 101,
    TaskDescription: "Inspect queue rails — Zone A rides",
    Status: "Pending",
    DueDate: "2026-04-15",
    CreatedAt: "2026-04-01 10:00:00",
  },
  {
    MaintenanceAssignmentID: 2,
    EmployeeID: 3,
    AreaID: 102,
    TaskDescription: "Check refrigeration signage",
    Status: "In progress",
    DueDate: "2026-04-12",
    CreatedAt: "2026-04-02 14:30:00",
  },
];

function $(sel, root = document) {
  const el = root.querySelector(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
  return el;
}

function showToast(message, isError = false) {
  const t = $("#toast");
  t.textContent = message;
  t.classList.toggle("error", isError);
  t.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove("show"), 3200);
}

function getCurrentEmployeeId() {
  const v = sessionStorage.getItem(STORAGE_EMPLOYEE);
  return v ? parseInt(v, 10) : null;
}

function setCurrentEmployeeId(id) {
  if (id == null) sessionStorage.removeItem(STORAGE_EMPLOYEE);
  else sessionStorage.setItem(STORAGE_EMPLOYEE, String(id));
}

function clockStorageKey(employeeId) {
  return `tp_clock_open_${employeeId}`;
}

function getOpenClock(employeeId) {
  try {
    const raw = sessionStorage.getItem(clockStorageKey(employeeId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setOpenClock(employeeId, payload) {
  if (!payload) sessionStorage.removeItem(clockStorageKey(employeeId));
  else sessionStorage.setItem(clockStorageKey(employeeId), JSON.stringify(payload));
}

function timelogStorageKey(employeeId) {
  return `tp_timelog_local_${employeeId}`;
}

function getLocalTimelog(employeeId) {
  try {
    const raw = sessionStorage.getItem(timelogStorageKey(employeeId));
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function setLocalTimelog(employeeId, rows) {
  sessionStorage.setItem(timelogStorageKey(employeeId), JSON.stringify(rows));
}

function appendLocalTimelog(employeeId, row) {
  const existing = getLocalTimelog(employeeId);
  existing.push(row);
  setLocalTimelog(employeeId, existing);
}

function parseSqlDateTime(value) {
  if (!value) return null;
  const dt = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * @param {string} path
 * @returns {Promise<unknown>}
 */
async function apiGet(path) {
  if (!API_BASE) return null;
  const base = API_BASE.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${base}${p}`, { credentials: "same-origin" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchShifts(employeeId) {
  const data = await apiGet(`/employees/${employeeId}/shifts`);
  if (Array.isArray(data)) return data;
  return MOCK_SHIFTS.filter((s) => s.EmployeeID === employeeId);
}

async function fetchTimelog(employeeId) {
  const data = await apiGet(`/employees/${employeeId}/timelog`);
  if (Array.isArray(data)) return data;
  return MOCK_TIMELOG.filter((r) => r.EmployeeID === employeeId);
}

async function fetchPerformance(employeeId) {
  const data = await apiGet(`/employees/${employeeId}/performance`);
  if (Array.isArray(data)) return data;
  return MOCK_PERFORMANCE.filter((r) => r.EmployeeID === employeeId);
}

async function fetchTasks(employeeId) {
  const data = await apiGet(`/employees/${employeeId}/maintenance-assignments`);
  if (Array.isArray(data)) return data;
  return MOCK_TASKS.filter((r) => r.EmployeeID === employeeId);
}

/**
 * One employee with AreaName (Section 3 joined query). Backend: run your LEFT JOIN and map one row to JSON.
 * @param {number} employeeId
 * @returns {Promise<EmployeeRow|null>}
 */
async function fetchEmployeeDetail(employeeId) {
  const data = await apiGet(`/employees/${employeeId}`);
  if (data && typeof data === "object" && data.EmployeeID != null) {
    const row = /** @type {EmployeeRow} */ (data);
    if (row.AreaName == null && row.AreaID != null && AREA_NAMES[row.AreaID])
      row.AreaName = AREA_NAMES[row.AreaID];
    return row;
  }
  return MOCK_EMPLOYEES.find((e) => e.EmployeeID === employeeId) ?? null;
}

function employeeById(id) {
  return employeeOptionsCache.find((e) => e.EmployeeID === id) ?? MOCK_EMPLOYEES.find((e) => e.EmployeeID === id) ?? null;
}

function formatMoney(n) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(Number(n));
}

function formatTime(t) {
  if (t == null || t === "") return "—";
  const s = String(t);
  return s.length >= 8 ? s.slice(0, 5) : s;
}

async function renderProfile(employeeId) {
  const dl = $("#profile-dl");
  dl.innerHTML = "";
  const emp = await fetchEmployeeDetail(employeeId);
  cachedEmployeeDetail = emp;
  if (!emp) {
    dl.innerHTML = "<p class=\"hint\">No profile in demo data.</p>";
    return;
  }
  const rows = [
    ["Employee ID", emp.EmployeeID],
    ["Name", emp.Name],
    ["Position", emp.Position],
    ["Salary", formatMoney(emp.Salary)],
    ["Hire date", emp.HireDate],
    ["Manager ID", emp.ManagerID ?? "—"],
    ["Area ID", emp.AreaID ?? "—"],
    ["Area name", emp.AreaName ?? "—"],
  ];
  for (const [k, v] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = String(v);
    dl.append(dt, dd);
  }
}

async function renderShifts(employeeId) {
  const tbody = $("#tbody-shifts");
  const rows = await fetchShifts(employeeId);
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = "<tr><td colspan=\"4\" class=\"hint\">No shifts scheduled.</td></tr>";
    return;
  }
  for (const s of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="num">${s.ShiftID}</td>
      <td>${s.ShiftDate ?? "—"}</td>
      <td>${formatTime(s.StartTime)}</td>
      <td>${formatTime(s.EndTime)}</td>`;
    tbody.append(tr);
  }
}

async function renderTimelog(employeeId) {
  const tbody = $("#tbody-timelog");
  let rows = await fetchTimelog(employeeId);
  const localRows = getLocalTimelog(employeeId);
  if (localRows.length) rows = [...rows, ...localRows];
  const open = getOpenClock(employeeId);
  if (open && open.ClockIn) {
    rows = [
      ...rows,
      {
        LogID: "—",
        ClockIn: open.ClockIn,
        ClockOut: null,
        HoursWorked: null,
      },
    ];
  }
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = "<tr><td colspan=\"4\" class=\"hint\">No time entries yet.</td></tr>";
    return;
  }
  const sorted = [...rows].sort((a, b) => String(b.ClockIn).localeCompare(String(a.ClockIn)));
  for (const r of sorted) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="num">${r.LogID}</td>
      <td>${r.ClockIn ?? "—"}</td>
      <td>${r.ClockOut ?? (open && r.ClockIn === open.ClockIn ? "… in progress" : "—")}</td>
      <td class="num">${r.HoursWorked != null ? r.HoursWorked : "—"}</td>`;
    tbody.append(tr);
  }
}

async function renderPerformance(employeeId) {
  const tbody = $("#tbody-performance");
  const rows = await fetchPerformance(employeeId);
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = "<tr><td colspan=\"4\" class=\"hint\">No reviews on file.</td></tr>";
    return;
  }
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="num">${r.PerformanceID}</td>
      <td>${r.ReviewDate}</td>
      <td class="num">${r.PerformanceScore}</td>
      <td>${r.WorkloadNotes ?? "—"}</td>`;
    tbody.append(tr);
  }
}

async function renderTasks(employeeId) {
  const tbody = $("#tbody-tasks");
  const rows = await fetchTasks(employeeId);
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = "<tr><td colspan=\"6\" class=\"hint\">No maintenance assignments.</td></tr>";
    return;
  }
  for (const r of rows) {
    const areaLabel = r.AreaID != null ? `${AREA_NAMES[r.AreaID] ?? "Area"} (${r.AreaID})` : "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="num">${r.MaintenanceAssignmentID}</td>
      <td>${areaLabel}</td>
      <td>${r.TaskDescription}</td>
      <td>${r.Status}</td>
      <td>${r.DueDate ?? "—"}</td>
      <td>${r.CreatedAt ?? "—"}</td>`;
    tbody.append(tr);
  }
}

function updateClockUI(employeeId) {
  const open = getOpenClock(employeeId);
  const status = $("#clock-status");
  const btnIn = $("#btn-clock-in");
  const btnOut = $("#btn-clock-out");
  if (open && open.ClockIn) {
    status.textContent = `Clocked in since ${open.ClockIn}`;
    btnIn.disabled = true;
    btnOut.disabled = false;
  } else {
    status.textContent = "Not clocked in";
    btnIn.disabled = false;
    btnOut.disabled = true;
  }
}

function setTabsSignedIn(signedIn) {
  const tabs = document.querySelectorAll("#main-tabs .tab[data-tab]");
  tabs.forEach((btn) => {
    const tab = btn.getAttribute("data-tab");
    if (tab === "session") {
      btn.disabled = false;
      return;
    }
    btn.disabled = !signedIn;
  });
  $("#btn-sign-out").classList.toggle("hidden", !signedIn);
}

function activateTab(name) {
  document.querySelectorAll(".tab").forEach((b) => {
    const on = b.getAttribute("data-tab") === name;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  document.querySelectorAll(".panel").forEach((p) => {
    const id = p.id.replace("panel-", "");
    const on = id === name;
    p.classList.toggle("active", on);
    p.hidden = !on;
  });
}

async function refreshAllPanels() {
  const id = getCurrentEmployeeId();
  if (id == null) return;
  await renderProfile(id);
  await renderShifts(id);
  await renderTimelog(id);
  updateClockUI(id);
  await renderPerformance(id);
  await renderTasks(id);
}

function updateHeader() {
  const id = getCurrentEmployeeId();
  const tag = $("#header-tagline");
  if (id == null) {
    cachedEmployeeDetail = null;
    tag.textContent = "Theme Park · sign in to view your schedule and tasks";
    return;
  }
  const emp =
    cachedEmployeeDetail && cachedEmployeeDetail.EmployeeID === id ? cachedEmployeeDetail : employeeById(id);
  tag.textContent = emp
    ? `Signed in as ${emp.Name} · ${emp.Position} · Employee #${id}`
    : `Signed in · Employee #${id}`;
}

async function fetchEmployeeOptionsFromApi() {
  const sources = [];
  if (API_BASE) {
    const base = API_BASE.replace(/\/$/, "");
    sources.push(`${base}/employees`);
  }
  // Fallback source when running static-only local routes with no /api proxy.
  sources.push(`${HR_EMPLOYEE_FALLBACK_API}/employees`);

  for (const url of sources) {
    try {
      const res = await fetch(url, { credentials: "same-origin" });
      if (res.status === 404) continue;
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data)) continue;
      const normalized = data
        .map((row) => {
          if (!row || row.EmployeeID == null) return null;
          const areaId = row.AreaID != null ? Number(row.AreaID) : null;
          const areaName = row.AreaName ?? (areaId != null ? AREA_NAMES[areaId] ?? null : null);
          return {
            EmployeeID: Number(row.EmployeeID),
            Name: row.Name ?? "Unknown",
            Position: row.Position ?? "",
            Salary: row.Salary ?? null,
            HireDate: row.HireDate ?? null,
            ManagerID: row.ManagerID ?? null,
            AreaID: areaId,
            AreaName: areaName,
          };
        })
        .filter(Boolean);
      if (normalized.length) return normalized;
    } catch {
      // try next source
    }
  }

  try {
    // no-op fallback below
  } catch {
    return null;
  }
  return null;
}

async function populateEmployeeSelect() {
  const sel = $("#select-employee-id");
  sel.innerHTML = '<option value="">— Select —</option>';
  let list = await fetchEmployeeOptionsFromApi();
  if (!list || !list.length) list = employeesSortedForPortal();
  else list = [...list].sort(compareEmployeeQueryOrder);
  employeeOptionsCache = [...list];
  for (const e of list) {
    const opt = document.createElement("option");
    opt.value = String(e.EmployeeID);
    const areaBit = e.AreaName ? ` · ${e.AreaName}` : "";
    opt.textContent = `#${e.EmployeeID} — ${e.Name} (${e.Position})${areaBit}`;
    sel.append(opt);
  }
  const current = getCurrentEmployeeId();
  if (current != null) sel.value = String(current);
}

function wireTabs() {
  document.querySelectorAll(".tab[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      activateTab(btn.getAttribute("data-tab"));
    });
  });
}

function wireSession() {
  $("#btn-sign-in").addEventListener("click", async () => {
    const sel = $("#select-employee-id");
    const id = parseInt(sel.value, 10);
    if (!id) {
      showToast("Choose an employee ID.", true);
      return;
    }
    setCurrentEmployeeId(id);
    setTabsSignedIn(true);
    activateTab("profile");
    await refreshAllPanels();
    updateHeader();
    showToast("Welcome to the employee portal.");
  });

  $("#btn-sign-out").addEventListener("click", () => {
    const id = getCurrentEmployeeId();
    if (id != null) setOpenClock(id, null);
    setCurrentEmployeeId(null);
    cachedEmployeeDetail = null;
    $("#select-employee-id").value = "";
    setTabsSignedIn(false);
    updateHeader();
    activateTab("session");
    showToast("Signed out.");
  });
}

function wireRefresh() {
  $("#btn-refresh-profile").addEventListener("click", async () => {
    const id = getCurrentEmployeeId();
    if (id != null) {
      await renderProfile(id);
      updateHeader();
    }
  });
  $("#btn-refresh-shifts").addEventListener("click", () => {
    const id = getCurrentEmployeeId();
    if (id != null) renderShifts(id);
  });
  $("#btn-refresh-performance").addEventListener("click", () => {
    const id = getCurrentEmployeeId();
    if (id != null) renderPerformance(id);
  });
  $("#btn-refresh-tasks").addEventListener("click", () => {
    const id = getCurrentEmployeeId();
    if (id != null) renderTasks(id);
  });
}

function wireClock() {
  $("#btn-clock-in").addEventListener("click", () => {
    const id = getCurrentEmployeeId();
    if (id == null) return;
    if (getOpenClock(id)) {
      showToast("Already clocked in.", true);
      return;
    }
    const now = new Date();
    const iso = now.toISOString().slice(0, 19).replace("T", " ");
    setOpenClock(id, { ClockIn: iso });
    updateClockUI(id);
    renderTimelog(id);
    showToast("Clocked in.");
  });

  $("#btn-clock-out").addEventListener("click", () => {
    const id = getCurrentEmployeeId();
    if (id == null) return;
    const open = getOpenClock(id);
    if (!open) return;
    const out = new Date();
    const clockOut = out.toISOString().slice(0, 19).replace("T", " ");
    const clockInDate = parseSqlDateTime(open.ClockIn);
    const hoursWorked =
      clockInDate != null ? Math.max(0, (out.getTime() - clockInDate.getTime()) / 3_600_000) : null;
    appendLocalTimelog(id, {
      LogID: `L-${Date.now()}`,
      ClockIn: open.ClockIn,
      ClockOut: clockOut,
      HoursWorked: hoursWorked != null ? Number(hoursWorked.toFixed(2)) : null,
    });
    setOpenClock(id, null);
    updateClockUI(id);
    renderTimelog(id);
    showToast("Clocked out successfully.");
  });
}

function wireIncident() {
  $("#form-incident").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const id = getCurrentEmployeeId();
    if (id == null) {
      showToast("Sign in first.", true);
      return;
    }
    const fd = new FormData(ev.target);
    const payload = {
      EmployeeID: id,
      ReportType: fd.get("ReportType"),
      Description: fd.get("Description"),
      AttractionID: fd.get("AttractionID") ? parseInt(String(fd.get("AttractionID")), 10) : null,
      ItemID: fd.get("ItemID") ? parseInt(String(fd.get("ItemID")), 10) : null,
    };

    if (API_BASE) {
      try {
        const base = API_BASE.replace(/\/$/, "");
        const res = await fetch(`${base}/incident-reports`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
        showToast("Incident report submitted.");
        ev.target.reset();
        return;
      } catch (e) {
        showToast(e.message || "Submit failed", true);
        return;
      }
    }

    console.info("Incident report (demo, not saved):", payload);
    showToast("Report recorded locally (connect API_BASE to persist).");
    ev.target.reset();
  });
}

async function init() {
  await populateEmployeeSelect();
  wireTabs();
  wireSession();
  wireRefresh();
  wireClock();
  wireIncident();

  const id = getCurrentEmployeeId();
  if (id != null) {
    setTabsSignedIn(true);
    activateTab("profile");
    refreshAllPanels().then(() => updateHeader());
  } else {
    setTabsSignedIn(false);
    activateTab("session");
  }
}

init();
