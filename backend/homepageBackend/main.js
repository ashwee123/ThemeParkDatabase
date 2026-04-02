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

togglePw.addEventListener("click", () => {
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
  } else {
    passwordInput.type = "password";
  }
});

const form = document.getElementById("loginForm");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("emailInput").value;
  const password = document.getElementById("passwordInput").value;

  document.getElementById("loginLoading").style.display = "block";

  try {
    // This starts from 'localhost' and goes straight to the file
    const res = await fetch("/ThemeParkDatabase/backend/homepageBackend/php/login.php", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    document.getElementById("loginLoading").style.display = "none";

    if (data.success) {
    // We go up one level from 'homepageFrontend' to 'frontend', 
    // then into the specific portal folder.
    if (data.role === "Maintenance Manager") {
        window.location.href = "../maintenanceFrontend/index.html";
    } 
    else if (data.role === "Admin") {
        // Just a safeguard since you don't have this folder yet
        alert("Admin portal is still under construction!");
    } 
    else {
        window.location.href = "../visitorFrontend/index.html";
    }
  } else {
      // This will show "DB Error: Access Denied" directly on the page
      showError(data.message || "Invalid email or password.");
  }

  } catch (err) {
    console.error(err); // This prints the EXACT error to the console
    showError("Server error. Try again.");
  }
});

function showError(msg) {
  const errorBox = document.getElementById("loginError");
  errorBox.style.display = "block";
  errorBox.textContent = msg;
}