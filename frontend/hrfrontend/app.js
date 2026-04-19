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
                    <td>${e.Name || "Unknown"}</td>
                    <td>${e.Position || '<span style="color:gray">N/A</span>'}</td>
                    <td>${e.Salary ? '$' + Number(e.Salary).toLocaleString() : '—'}</td>
                </tr>
            `).join("");
        }
    } catch (err) { console.error("Employee Load Error:", err); }
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
                </tr>
            `).join("");
        }
    } catch (err) { console.error(err); }
}

// Add similar loaders for Activity and Salary if needed...

/* ================= DATA SUBMISSION ================= */
async function addEmployee() {
    const body = {
        name: document.getElementById("empName").value,
        position: document.getElementById("empRole").value,
        salary: document.getElementById("empSalary").value,
        managerId: document.getElementById("empManager").value,
        areaId: document.getElementById("empArea").value
    };

    try {
        const res = await fetch(`${API}/employees`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            alert("Employee added to the Nexus!");
            loadEmployees();
        } else {
            alert(data.error || "Could not add employee.");
        }
    } catch (err) {
        console.error(err);
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
            document.getElementById("mgrId").value = "";
            document.getElementById("mgrName").value = "";
            document.getElementById("mgrEmail").value = "";
            document.getElementById("mgrUsername").value = "";
            document.getElementById("mgrPassword").value = "";
            loadManagers();
        } else {
            alert(data.error || "Could not add manager.");
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
        document.getElementById(panelId).classList.add("active");
    };
});

/* ================= INITIALIZATION ================= */
window.onload = () => {
    const isDashboard = Boolean(document.getElementById("empTable"));
    const isLoginPage = Boolean(document.getElementById("email"));

    if (isLoginPage && localStorage.getItem("loggedIn")) {
        window.location.href = hrUrl("index.html");
        return;
    }

    if (isDashboard) {
        if (!localStorage.getItem("loggedIn")) {
            window.location.href = hrUrl("login.html");
        } else {
            loadEmployees();
            loadManagers();
        }
    }
};

