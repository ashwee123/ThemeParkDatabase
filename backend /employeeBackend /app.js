(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const loginView = $("#loginView");
  const appView = $("#appView");
  const toastEl = $("#toast");

  function showToast(message, isError) {
    toastEl.textContent = message;
    toastEl.classList.toggle("error", !!isError);
    toastEl.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.remove("show"), 4200);
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: text || "Invalid response" };
    }
    if (!res.ok) {
      const err = new Error(data?.error || res.statusText);
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  function formatDate(d) {
    if (d == null) return "—";
    const s = String(d);
    return s.length >= 10 ? s.slice(0, 10) : s;
  }

  function formatDateTime(d) {
    if (d == null) return "—";
    return String(d).replace("T", " ").slice(0, 19);
  }

  function formatTime(t) {
    if (t == null) return "—";
    const s = String(t);
    return s.length >= 8 ? s.slice(0, 8) : s;
  }

  function setSignedInUi(signedIn) {
    loginView.classList.toggle("hidden", signedIn);
    appView.classList.toggle("hidden", !signedIn);
  }

  function renderProfile(p) {
    const hire = formatDate(p.HireDate);
    const salary =
      p.Salary != null
        ? Number(p.Salary).toLocaleString(undefined, {
            style: "currency",
            currency: "USD",
          })
        : "—";
    $("#profileCard").innerHTML = `
      <div class="grid-form" style="margin:0;">
        <div><span class="hint">Name</span><br /><strong>${escapeHtml(p.Name || "")}</strong></div>
        <div><span class="hint">Position</span><br /><strong>${escapeHtml(p.Position || "—")}</strong></div>
        <div><span class="hint">Area</span><br /><strong>${escapeHtml(p.AreaName || "—")}</strong></div>
        <div><span class="hint">Manager</span><br /><strong>${escapeHtml(p.ManagerName || "—")}</strong></div>
        <div><span class="hint">Hire date</span><br /><strong>${hire}</strong></div>
        <div><span class="hint">Salary</span><br /><strong class="num">${salary}</strong></div>
      </div>
    `;
    $("#welcomeLine").textContent = `Welcome, ${p.Name || "employee"}.`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function tbodyClear(tableId) {
    const tb = $(`#${tableId} tbody`);
    if (tb) tb.innerHTML = "";
    return tb;
  }

  function emptyRow(tb, cols, text) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="${cols}" class="hint">${text}</td>`;
    tb.appendChild(tr);
  }

  async function loadDashboard() {
    const p = await api("/api/me");
    renderProfile(p);
  }

  async function loadShifts() {
    const tb = tbodyClear("shiftsTable");
    const rows = await api("/api/shifts");
    if (!rows.length) return emptyRow(tb, 4, "No shifts scheduled.");
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="num">${r.ShiftID}</td>
        <td>${formatDate(r.ShiftDate)}</td>
        <td>${formatTime(r.StartTime)}</td>
        <td>${formatTime(r.EndTime)}</td>`;
      tb.appendChild(tr);
    });
  }

  async function loadTimelog() {
    const tb = tbodyClear("timelogTable");
    const rows = await api("/api/timelogs");
    if (!rows.length) return emptyRow(tb, 4, "No time entries.");
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="num">${r.LogID}</td>
        <td>${formatDateTime(r.ClockIn)}</td>
        <td>${formatDateTime(r.ClockOut)}</td>
        <td class="num">${r.HoursWorked != null ? r.HoursWorked : "—"}</td>`;
      tb.appendChild(tr);
    });
  }

  async function loadPerformance() {
    const tb = tbodyClear("perfTable");
    const rows = await api("/api/performance");
    if (!rows.length) return emptyRow(tb, 3, "No reviews yet.");
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formatDate(r.ReviewDate)}</td>
        <td class="num">${r.PerformanceScore}</td>
        <td>${escapeHtml(r.WorkloadNotes || "—")}</td>`;
      tb.appendChild(tr);
    });
  }

  async function loadMaintenance() {
    const tb = tbodyClear("maintTable");
    const rows = await api("/api/maintenance-assignments");
    if (!rows.length) return emptyRow(tb, 5, "No assignments.");
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(r.TaskDescription || "")}</td>
        <td>${escapeHtml(r.AreaName || "—")}</td>
        <td>${escapeHtml(r.Status || "")}</td>
        <td>${formatDate(r.DueDate)}</td>
        <td>${formatDateTime(r.CreatedAt)}</td>`;
      tb.appendChild(tr);
    });
  }

  async function loadIncidentLookups() {
    const [attractions, items] = await Promise.all([
      api("/api/lookups/attractions"),
      api("/api/lookups/retail-items"),
    ]);
    const as = $("#attractionSelect");
    const is = $("#itemSelect");
    as.innerHTML = '<option value="">—</option>';
    is.innerHTML = '<option value="">—</option>';
    attractions.forEach((a) => {
      const o = document.createElement("option");
      o.value = a.AttractionID;
      o.textContent = `${a.AttractionName} (${a.AttractionType})`;
      as.appendChild(o);
    });
    items.forEach((it) => {
      const o = document.createElement("option");
      o.value = it.ItemID;
      o.textContent = it.ItemName;
      is.appendChild(o);
    });
  }

  async function loadIncidents() {
    const tb = tbodyClear("incidentsTable");
    const rows = await api("/api/incidents");
    if (!rows.length) return emptyRow(tb, 6, "No reports filed.");
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="num">${r.ReportID}</td>
        <td>${escapeHtml(r.ReportType || "—")}</td>
        <td>${escapeHtml(r.Description || "")}</td>
        <td class="num">${r.AttractionID != null ? r.AttractionID : "—"}</td>
        <td class="num">${r.ItemID != null ? r.ItemID : "—"}</td>
        <td>${formatDateTime(r.ReportDate)}</td>`;
      tb.appendChild(tr);
    });
  }

  const loaders = {
    dashboard: loadDashboard,
    shifts: loadShifts,
    timelog: loadTimelog,
    performance: loadPerformance,
    maintenance: loadMaintenance,
    incidents: async () => {
      await loadIncidentLookups();
      await loadIncidents();
    },
  };

  let currentPanel = "dashboard";

  async function activatePanel(name) {
    currentPanel = name;
    $$(".tab").forEach((btn) => {
      const on = btn.dataset.panel === name;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    $$(".panel").forEach((p) => {
      p.classList.toggle("active", p.id === `panel-${name}`);
    });
    const fn = loaders[name];
    if (fn) {
      try {
        await fn();
      } catch (e) {
        showToast(e.message || "Failed to load", true);
      }
    }
  }

  $$(".tab").forEach((btn) => {
    btn.addEventListener("click", () => activatePanel(btn.dataset.panel));
  });

  $("#loginForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const employeeId = Number(fd.get("employeeId"));
    const name = String(fd.get("name") || "").trim();
    try {
      await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ employeeId, name }),
      });
      setSignedInUi(true);
      showToast("Signed in.");
      await activatePanel("dashboard");
    } catch (e) {
      showToast(e.message || "Login failed", true);
    }
  });

  $("#btnLogout").addEventListener("click", async () => {
    try {
      await api("/api/logout", { method: "POST" });
    } catch (_) {}
    setSignedInUi(false);
    showToast("Signed out.");
  });

  $("#incidentForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const body = {
      reportType: fd.get("reportType"),
      description: fd.get("description"),
      attractionId: fd.get("attractionId") || null,
      itemId: fd.get("itemId") || null,
    };
    try {
      await api("/api/incidents", { method: "POST", body: JSON.stringify(body) });
      ev.target.reset();
      showToast("Report submitted.");
      await loadIncidents();
    } catch (e) {
      showToast(e.message || "Submit failed", true);
    }
  });

  async function boot() {
    try {
      const s = await api("/api/session");
      if (s.signedIn) {
        setSignedInUi(true);
        await activatePanel("dashboard");
      } else {
        setSignedInUi(false);
      }
    } catch {
      setSignedInUi(false);
    }
  }

  boot();
})();
