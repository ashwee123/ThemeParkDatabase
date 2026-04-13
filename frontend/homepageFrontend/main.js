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
    loginLoading.style.display = "none";

    if (data.message === "LOGIN SUCCESS") {

      // 🔐 SAVE JWT TOKEN
      localStorage.setItem("token", data.token);

      // redirect (for now default user flow)
      window.location.href = "/visitorFrontend/";

    } else {
      showError(data.error || data.message || "Invalid email or password.");
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
