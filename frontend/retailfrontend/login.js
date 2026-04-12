const API = "https://retail-portal-backend-pg0i.onrender.com";

function showToast(msg, isError = false) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.className = "toast show" + (isError ? " error" : "");
    setTimeout(() => toast.className = "toast", 3000);
}

document.getElementById("btn-login").addEventListener("click", async () => {
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value.trim();

    if (!username || !password) return showToast("Please enter your username and password", true);

    try {
        const res  = await fetch(`${API}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (res.status === 401 || data.error) return showToast("Invalid username or password", true);

        sessionStorage.setItem("managerID",   data.ManagerID);
        sessionStorage.setItem("managerName", data.ManagerName);
        sessionStorage.setItem("areaID",      data.AreaID);
        sessionStorage.setItem("areaName",    data.AreaName);

        window.location.href = "index.html";

    } catch (err) {
        showToast("Could not connect to server", true);
    }
});

document.getElementById("login-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btn-login").click();
});