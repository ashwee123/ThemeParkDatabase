const API = "https://hrmanager-39yw.onrender.com";

/** Base path when deployed under Vercel `/hr/*`; empty for same-dir local opens. */
function hrBasePath() {
    const p = window.location.pathname;
    if (p === "/hr" || p.startsWith("/hr/")) return "/hr";
    return "";
}

function hrUrl(path) {
    const base = hrBasePath();
    const clean = path.replace(/^\//, "");
    return base ? `${base}/${clean}` : clean;
}

function isHrAuthenticated() {
    return localStorage.getItem("loggedIn") === "true" || Boolean(localStorage.getItem("token"));
}

function formatDateOnly(value) {
    if (!value) return "—";
    const s = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toISOString().slice(0, 10);
}

/* ================= AUTH & LOGIN ================= */
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
            localStorage.setItem("loggedIn", "true");
            localStorage.setItem("userEmail", email);
            window.location.href = hrUrl("index.html");
        } else {
            alert(data.error || "Invalid Credentials");
        }
    } catch (err) {
        console.error("Login Error:", err);
        alert("Server is waking up... wait 30 seconds and try again.");
    }
}

/* ================= DATA LOADING ================= */
async function loadEmployees() {
    try {
        const res = await fetch(`${API}/employees`);
        const data = await res.json();
        const table = document.getElementById("empTable");
        if (table) {
            table.innerHTML = data.map(e => `
                <tr>
                    <td>${e.EmployeeID ?? "—"}</td>
                    <td>${e.Name || "Unknown"}</td>
                    <td>${e.Position && String(e.Position).trim() ? e.Position : '<span style="color:gray">N/A</span>'}</td>
                    <td>${e.Salary != null && e.Salary !== "" ? '$' + Number(e.Salary).toLocaleString() : '—'}</td>
                    <td>${formatDateOnly(e.HireDate)}</td>
                    <td>${Number.isFinite(Number(e.EmployeeID))
                        ? `
                          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                            <button class="btn btn-ghost" title="Delete employee" onclick="deleteEmployee(${Number(e.EmployeeID)})">Delete</button>
                          </div>`
                        : "—"}</td>
                </tr>
            `).join("");
        }
    } catch (err) { console.error("Employee Load Error:", err); }
}

function showEmployeeFormMessage(message, isError = true) {
    const el = document.getElementById("empFormMessage");
    if (!el) return;
    if (!message) {
        el.style.display = "none";
        el.textContent = "";
        el.style.color = "";
        return;
    }
    el.style.display = "block";
    el.textContent = message;
    el.style.color = isError ? "#ff9a9a" : "";
}

async function loadManagers() {
    try {
        const res = await fetch(`${API}/managers`);
        const data = await res.json();
        const table = document.getElementById("mgrTable");
        if (table) {
            table.innerHTML = data.map(m => `
                <tr>
                    <td>${m.ManagerID}</td>
                    <td>${m.ManagerName ?? "—"}</td>
                    <td>${m.ManagerEmail ?? "—"}</td>
                    <td>${Number.isFinite(Number(m.ManagerID))
                        ? `<button class="btn btn-ghost" onclick="deleteManager(${Number(m.ManagerID)})">-</button>`
                        : "—"}</td>
                </tr>
            `).join("");
        }
    } catch (err) { console.error(err); }
}

function formatMoney(n) {
    if (n == null || n === "") return "—";
    const num = Number(n);
    if (Number.isNaN(num)) return "—";
    return "$" + num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatActivityWhen(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
}

const HR_LOCAL_ACTIVITY_KEY = "hr_portal_activity_local";

function readLocalActivity() {
    try {
        const v = sessionStorage.getItem(HR_LOCAL_ACTIVITY_KEY);
        const parsed = v ? JSON.parse(v) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function appendLocalActivity(action, detail) {
    const list = readLocalActivity();
    list.unshift({
        created_at: new Date().toISOString(),
        action,
        detail: detail ?? "—"
    });
    sessionStorage.setItem(HR_LOCAL_ACTIVITY_KEY, JSON.stringify(list.slice(0, 100)));
}

function clearLocalActivity() {
    sessionStorage.removeItem(HR_LOCAL_ACTIVITY_KEY);
}

/** Merge server audit / legacy performance rows with a session fallback when the API is not yet deployed. */
function buildActivityRows(raw) {
    if (!Array.isArray(raw) || raw.length === 0) {
        return readLocalActivity();
    }

    const hasAudit = raw.some(
        (r) => r && typeof r.action === "string" && Object.prototype.hasOwnProperty.call(r, "detail")
    );
    if (hasAudit) {
        clearLocalActivity();
        return raw
            .filter((r) => r && typeof r.action === "string")
            .map((r) => ({
                created_at: r.created_at ?? r.CreatedAt,
                action: r.action,
                detail: r.detail ?? r.Detail ?? "—"
            }))
            .sort((a, b) => {
                const ta = new Date(a.created_at || 0).getTime();
                const tb = new Date(b.created_at || 0).getTime();
                return tb - ta;
            });
    }

    const hasPerf = raw.some((r) => r && r.Name != null && "PerformanceScore" in r);
    if (hasPerf) {
        return raw
            .filter((r) => r && r.Name != null)
            .map((r) => ({
                created_at: r.ReviewDate || r.review_date || null,
                action: "Performance review",
                detail: `${r.Name}: score ${r.PerformanceScore ?? "—"}${r.WorkloadNotes ? ` — ${r.WorkloadNotes}` : ""}`
            }))
            .sort((a, b) => {
                const ta = new Date(a.created_at || 0).getTime();
                const tb = new Date(b.created_at || 0).getTime();
                return tb - ta;
            });
    }

    return readLocalActivity();
}

async function loadActivity() {
    const table = document.getElementById("activityTable");
    if (!table) return;
    try {
        const res = await fetch(`${API}/activity`);
        const data = await res.json();
        if (!Array.isArray(data)) {
            table.innerHTML = "";
            return;
        }
        const rows = buildActivityRows(data);
        table.innerHTML = rows.length
            ? rows.map((row) => `
                <tr>
                    <td>${formatActivityWhen(row.created_at)}</td>
                    <td>${escapeHtml(row.action)}</td>
                    <td>${escapeHtml(row.detail || "—")}</td>
                </tr>
            `).join("")
            : `<tr><td colspan="3">No activity yet. Add an employee or manager, or log in again.</td></tr>`;
    } catch (err) {
        console.error(err);
        table.innerHTML = `<tr><td colspan="3">Could not load activity.</td></tr>`;
    }
}

function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function normalizeSalaryRow(row) {
    if (row.person_name != null || row.role_type != null) {
        return {
            person_name: row.person_name,
            role_type: row.role_type || "—",
            job_title: row.job_title || "—",
            salary_amount: row.salary_amount
        };
    }
    if (row.Name != null) {
        return {
            person_name: row.Name,
            role_type: "Employee",
            job_title: row.Position || row.position || "—",
            salary_amount: row.Salary != null ? row.Salary : row.salary
        };
    }
    return {
        person_name: "—",
        role_type: "—",
        job_title: "—",
        salary_amount: null
    };
}

async function loadSalary() {
    const table = document.getElementById("salaryTable");
    if (!table) return;
    try {
        const res = await fetch(`${API}/salary`);
        const data = await res.json();
        if (!Array.isArray(data)) {
            table.innerHTML = "";
            return;
        }
        const rows = data.map(normalizeSalaryRow);
        table.innerHTML = rows.length
            ? rows.map((row) => `
                <tr>
                    <td>${escapeHtml(row.person_name || "—")}</td>
                    <td>${escapeHtml(row.role_type || "—")}</td>
                    <td>${escapeHtml(row.job_title || "—")}</td>
                    <td>${formatMoney(row.salary_amount)}</td>
                </tr>
            `).join("")
            : `<tr><td colspan="4">No rows yet.</td></tr>`;
    } catch (err) {
        console.error(err);
        table.innerHTML = `<tr><td colspan="4">Could not load salary data.</td></tr>`;
    }
}

/* ================= DATA SUBMISSION ================= */
async function addEmployee() {
    const name = document.getElementById("empName").value.trim();
    const position = document.getElementById("empRole").value.trim();
    const salaryRaw = document.getElementById("empSalary").value;
    const hireDate = document.getElementById("empHireDate").value;
    const managerIdRaw = document.getElementById("empManager").value.trim();
    const areaIdRaw = document.getElementById("empArea").value.trim();
    const salary = Number(salaryRaw);

    showEmployeeFormMessage("");

    if (!name) {
        showEmployeeFormMessage("Please enter employee name.");
        return;
    }
    if (!position) {
        showEmployeeFormMessage("Please enter role/position.");
        return;
    }
    if (!salaryRaw || Number.isNaN(salary) || salary < 0) {
        showEmployeeFormMessage("Please enter a valid non-negative salary.");
        return;
    }
    if (!hireDate) {
        showEmployeeFormMessage("Please select hire date.");
        return;
    }
    if (managerIdRaw && (!Number.isInteger(Number(managerIdRaw)) || Number(managerIdRaw) < 1)) {
        showEmployeeFormMessage("Manager ID must be a positive whole number.");
        return;
    }
    if (areaIdRaw && (!Number.isInteger(Number(areaIdRaw)) || Number(areaIdRaw) < 1)) {
        showEmployeeFormMessage("Area ID must be a positive whole number.");
        return;
    }

    const body = {
        name,
        position,
        salary,
        hireDate,
        managerId: managerIdRaw ? Number(managerIdRaw) : null,
        areaId: areaIdRaw ? Number(areaIdRaw) : null
    };

    try {
        const res = await fetch(`${API}/employees`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            showEmployeeFormMessage("Employee added successfully.", false);
            alert("Employee added to the Nexus!");
            appendLocalActivity(
                "Employee added",
                `${body.name} — ${body.position || "position unset"}; salary ${body.salary || "—"}; hired ${body.hireDate}`
            );
            document.getElementById("empName").value = "";
            document.getElementById("empRole").value = "";
            document.getElementById("empSalary").value = "";
            document.getElementById("empHireDate").value = "";
            document.getElementById("empManager").value = "";
            document.getElementById("empArea").value = "";
            loadEmployees();
            loadActivity();
            loadSalary();
        } else {
            showEmployeeFormMessage(data.error || "Could not add employee.");
            alert(data.error || "Could not add employee.");
        }
    } catch (err) {
        console.error(err);
        showEmployeeFormMessage("Network error — try again.");
        alert("Network error — try again.");
    }
}

async function addManager() {
    const body = {
        id: document.getElementById("mgrId").value,
        name: document.getElementById("mgrName").value.trim(),
        email: document.getElementById("mgrEmail").value.trim(),
        username: document.getElementById("mgrUsername").value.trim(),
        password: document.getElementById("mgrPassword").value
    };

    try {
        const res = await fetch(`${API}/managers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            alert("Manager added to the Nexus!");
            appendLocalActivity(
                "Manager added",
                `${body.name} (ID ${body.id}) — ${body.email}`
            );
            document.getElementById("mgrId").value = "";
            document.getElementById("mgrName").value = "";
            document.getElementById("mgrEmail").value = "";
            document.getElementById("mgrUsername").value = "";
            document.getElementById("mgrPassword").value = "";
            loadManagers();
            loadActivity();
            loadSalary();
        } else {
            alert(data.error || "Could not add manager.");
        }
    } catch (err) {
        console.error(err);
        alert("Network error — try again.");
    }
}

async function deleteEmployee(employeeId) {
    if (!Number.isFinite(employeeId) || employeeId < 1) return;
    if (!confirm(`Delete employee #${employeeId}?`)) return;
    try {
        const res = await fetch(`${API}/employees/${employeeId}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            appendLocalActivity("Employee deleted", `Employee ID ${employeeId}`);
            loadEmployees();
            loadActivity();
            loadSalary();
        } else {
            alert(data.error || "Could not delete employee. This can happen when the employee is referenced by shifts, timelog, or assignments.");
        }
    } catch (err) {
        console.error(err);
        alert("Network error — try again.");
    }
}

async function deleteManager(managerId) {
    if (!Number.isFinite(managerId) || managerId < 1) return;
    if (!confirm(`Delete manager #${managerId}?`)) return;
    try {
        const res = await fetch(`${API}/managers/${managerId}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            appendLocalActivity("Manager deleted", `Manager ID ${managerId}`);
            loadManagers();
            loadActivity();
            loadSalary();
        } else {
            alert(data.error || "Could not delete manager.");
        }
    } catch (err) {
        console.error(err);
        alert("Network error — try again.");
    }
}

/* ================= TAB NAVIGATION ================= */
document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));

        btn.classList.add("active");
        const panelId = btn.getAttribute("data-target");
        const panel = document.getElementById(panelId);
        if (panel) panel.classList.add("active");
    };
});

/* ================= INITIALIZATION ================= */
window.onload = () => {
    const isDashboard = Boolean(document.getElementById("empTable"));
    const isLoginPage = Boolean(document.getElementById("email"));

    if (isLoginPage && isHrAuthenticated()) {
        window.location.href = hrUrl("index.html");
        return;
    }

    if (isDashboard) {
        if (!isHrAuthenticated()) {
            window.location.href = hrUrl("login.html");
        } else {
            loadEmployees();
            loadManagers();
            loadActivity();
            loadSalary();
        }
    }
};
