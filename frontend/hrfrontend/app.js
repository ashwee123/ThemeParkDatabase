const API = "https://hrmanager-39yw.onrender.com";

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
            // Save login state
            localStorage.setItem("loggedIn", "true");
            localStorage.setItem("userEmail", email);
            // Move to the dashboard
            window.location.href = "index.html";
        } else {
            alert(data.error || "Invalid Credentials");
        }
    } catch (err) {
        console.error("Login Error:", err);
        alert("Server is waking up... wait 30 seconds and try again.");
    }
}

/* ================= DATA LOADING ================= */
async function loadDashboardData() {
    // Load Employees
    try {
        const res = await fetch(`${API}/employees`);
        const data = await res.json();
        const table = document.getElementById("empTable");
        if (table) {
            table.innerHTML = data.map(e => `
                <tr>
                    <td>${e.Name}</td>
                    <td>${e.Position}</td>
                    <td>$${Number(e.Salary).toLocaleString()}</td>
                </tr>
            `).join("");
        }
    } catch (err) { console.error("Data Load Error:", err); }
}

/* ================= TAB NAVIGATION ================= */
document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));

        btn.classList.add("active");
        const panelId = btn.getAttribute("data-tab");
        document.getElementById(panelId).classList.add("active");
    };
});

/* ================= INITIALIZATION ================= */
window.onload = () => {
    // Only check auth and load data if we are on the dashboard (index.html)
    if (window.location.pathname.includes("index.html") || window.location.pathname === "/") {
        if (!localStorage.getItem("loggedIn")) {
            window.location.href = "login.html";
        } else {
            loadDashboardData();
            // Call other loaders (Managers, Activity, etc.) here
        }
    }
};
