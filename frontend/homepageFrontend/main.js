// LOGIN MODAL CONTROLS
const loginOverlay = document.getElementById("loginOverlay");
const openBtns = [
  document.getElementById("openLogin"),
  document.getElementById("openLoginHero"),
  document.getElementById("openLoginPlan")
];
const closeBtn = document.getElementById("closeLogin");

// Open modal
openBtns.forEach(btn => {
  if (btn) {
    btn.addEventListener("click", () => {
      loginOverlay.classList.add("is-open");
    });
  }
});

// Close modal
closeBtn.addEventListener("click", () => {
  loginOverlay.classList.remove("is-open");
});

// Close on outside click
loginOverlay.addEventListener("click", (e) => {
  if (e.target === loginOverlay) {
    loginOverlay.classList.remove("is-open");
  }
});

// Toggle password visibility
const togglePw = document.getElementById("togglePw");
const passwordInput = document.getElementById("passwordInput");

if (togglePw && passwordInput) {
  togglePw.addEventListener("click", () => {
    passwordInput.type = passwordInput.type === "password" ? "text" : "password";
  });
}

const form = document.getElementById("loginForm");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("emailInput").value.trim().toLowerCase();
    const password = document.getElementById("passwordInput").value;
    const loginLoading = document.getElementById("loginLoading");
    const submitLogin = document.getElementById("submitLogin");
    const isVisitorLogin =
      !email.includes("admin") &&
      !email.includes("manager") &&
      !email.includes("employee") &&
      !email.includes("retail") &&
      !email.includes("hr") &&
      email !== "maintenance@nightmarenexus.com";

    loginLoading.style.display = "block";
    if (submitLogin) submitLogin.disabled = true;
    showError("");

    try {
      const apiBase = isVisitorLogin
        ? "https://visitors-portal-backend.onrender.com"
        : "https://themeparkdatabase-w2b6.onrender.com";
      const endpoint = isVisitorLogin ? "/api/visitor/login" : "/login";
      const payload = isVisitorLogin
        ? { Email: email, Password: password }
        : { email, password };

      const res = await fetch(`${apiBase}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) {
        showError(data.error || "Invalid email or password.");
        return;
      }

      localStorage.setItem("token", data.token);

      if (isVisitorLogin) {
        window.location.href = "/visitor";
      } else if (email === "maintenance@nightmarenexus.com") {
        window.location.href = "/maintenance";
      } else if (email.includes("admin")) {
        window.location.href = "/admin";
      } else if (email.includes("manager")) {
        window.location.href = "/admin";
      } else if (email.includes("employee")) {
        window.location.href = "/employee";
      } else if (email.includes("retail")) {
        const areaId =
          data.areaID ??
          data.areaId ??
          data.AreaID ??
          data.user?.areaID ??
          data.user?.areaId ??
          data.user?.AreaID ??
          (email.match(/retail(\d+)/)?.[1] ?? null);
 
        const areaName =
          data.areaName ??
          data.AreaName ??
          data.user?.areaName ??
          "";
 
        const managerName =
          data.managerName ??
          data.ManagerName ??
          data.user?.managerName ??
          data.user?.name ??
          "";
 
        const params = new URLSearchParams({
          token: data.token,
          ...(areaId !== null ? { areaID: String(areaId) } : {}),
          ...(areaName ? { areaName } : {}),
          ...(managerName ? { managerName } : {}),
        });
 
        const retailPath = areaId !== null ? `/retail/${areaId}` : "/retail";
        window.location.href = `https://retail-portal-backend-pg0i.onrender.com${retailPath}?${params.toString()}`;

      } else if (email.includes("hr")) {
        window.location.href = "/hr";
      } else {
        showError("Unknown account type.");
      }
    } catch (err) {
      console.error(err);
      showError("Server error. Try again.");
    } finally {
      loginLoading.style.display = "none";
      if (submitLogin) submitLogin.disabled = false;
    }
  });
}

function showError(msg) {
  const errorBox = document.getElementById("loginError");
  if (errorBox) {
    errorBox.style.display = msg ? "block" : "none";
    errorBox.textContent = msg || "";
  }
}


window.ENV = {
  HOME_API: "https://themeparkdatabase-w2b6.onrender.com",
  MAINTENANCE_API: "https://maintenance-4i7r.onrender.com"
};
