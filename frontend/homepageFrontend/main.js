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

  const email = document.getElementById("emailInput").value;
  const password = document.getElementById("passwordInput").value;

  const loginLoading = document.getElementById("loginLoading");
  loginLoading.style.display = "block";

  try {
    const API_BASE = "https://themeparkdatabase-w2b6.onrender.com";

    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    // 🔐 SAVE TOKEN
    localStorage.setItem("token", data.token);

    // ✅ SIMPLE ROLE DETECTION (for now via email)
    if (email === "maintenance@nightmarenexus.com") {
      window.location.href = "/maintenance";
    } 
    else if (email.includes("admin")) {
      window.location.href = "/admin";
    }
    else if (email.includes("employee")) {
      window.location.href = "/employee";
    }
    else if (email.includes("retail")) {
      window.location.href = "/retail";
    }
    else if (email.includes("hr")) {
      window.location.href = "/hr";
    }
    else {
      window.location.href = "/visitor";
    }

  } catch (err) {
    console.error(err);
    loginLoading.style.display = "none";
    showError("Server error. Try again.");
  }
});
}

function showError(msg) {
  const errorBox = document.getElementById("loginError");
  if (errorBox) {
    errorBox.style.display = "block";
    errorBox.textContent = msg;
  }
}

window.ENV = {
  HOME_API: "https://themeparkdatabase-w2b6.onrender.com",
  MAINTENANCE_API: "https://maintenance-4i7r.onrender.com"
};
