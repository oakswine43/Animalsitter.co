// js/auth.js
// Handles login / signup overlay using REAL backend API (/auth/*)

(function () {
  const overlay = document.getElementById("authOverlay");
  const closeBtn = document.getElementById("authCloseBtn");
  const authTabs = Array.from(document.querySelectorAll(".auth-tab"));
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const authError = document.getElementById("authError");
  const logoutBtn = document.getElementById("logoutBtn");

  const loginEmailInput = document.getElementById("loginEmail");
  const loginPasswordInput = document.getElementById("loginPassword");

  const signupNameInput = document.getElementById("overlaySignupName");
  const signupEmailInput = document.getElementById("overlaySignupEmail");
  const signupPasswordInput = document.getElementById("overlaySignupPassword");
  const signupRoleInput = document.getElementById("overlaySignupRole");

  const TOKEN_KEY = "petcare_token";

  function showError(msg) {
    if (!authError) return;
    authError.textContent = msg || "";
    authError.style.display = msg ? "block" : "none";
  }

  function setActiveTab(tabName) {
    authTabs.forEach((btn) => {
      const target = btn.getAttribute("data-auth-tab");
      const active = target === tabName;
      btn.classList.toggle("active", active);
    });

    if (tabName === "login") {
      if (loginForm) loginForm.style.display = "block";
      if (signupForm) signupForm.style.display = "none";
    } else {
      if (loginForm) loginForm.style.display = "none";
      if (signupForm) signupForm.style.display = "block";
    }
  }

  function handleAuthSuccess(data) {
    showError("");

    const apiUser = data.user || null;
    const token = data.token || data.jwt || null;

    if (!apiUser || !token) {
      showError("Bad response from server.");
      return;
    }

    // Save JWT
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (_) {}

    // Map API user -> frontend user object
    const mapped =
      typeof window.PetCareMapApiUser === "function"
        ? window.PetCareMapApiUser(apiUser)
        : apiUser;

    // Update global state + header pill
    try {
      if (window.PetCareState && window.PetCareState.setCurrentUser) {
        window.PetCareState.setCurrentUser(mapped);
      }
      if (typeof window.updateHeaderUser === "function") {
        window.updateHeaderUser();
      }
    } catch (err) {
      console.warn("Failed to update current user:", err);
    }

    if (overlay) overlay.style.display = "none";
  }

  async function doLogin(email, password) {
    if (!window.API_BASE) {
      throw new Error("API base URL is not configured.");
    }
    const res = await fetch(`${window.API_BASE}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Invalid email or password.");
    }
    return data;
  }

async function doSignup({ full_name, email, password, role }) {
  if (!window.API_BASE) {
    throw new Error("API base URL is not configured.");
  }

  const res = await fetch(`${window.API_BASE}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    // 👇 send full_name so the backend gets what it expects
    body: JSON.stringify({ full_name, email, password, role })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Could not create account.");
  }
  return data;
}

  // ----- PUBLIC API (for openAuthBtn inline onclick) -----
  const PetCareAuth = {
    show(whichTab) {
      if (!overlay) return;
      overlay.style.display = "block";
      showError("");
      setActiveTab(whichTab === "signup" ? "signup" : "login");
    },
    hide() {
      if (overlay) overlay.style.display = "none";
    }
  };
  window.PetCareAuth = PetCareAuth;

  // ----- EVENT HOOKS -----

  // Close button
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      PetCareAuth.hide();
    });
  }

  // Switch tabs
  authTabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-auth-tab");
      setActiveTab(tab);
      showError("");
    });
  });

  // Login submit (REAL backend)
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      showError("");

      const email = (loginEmailInput.value || "").trim();
      const password = loginPasswordInput.value || "";

      if (!email || !password) {
        showError("Email and password are required.");
        return;
      }

      try {
        const data = await doLogin(email, password);
        handleAuthSuccess(data);
      } catch (err) {
        console.error("Login error:", err);
        showError(err.message || "Login failed.");
      }
    });
  }

 // Signup submit (REAL backend)
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");

// inside signupForm.addEventListener("submit", async (e) => { ... })

const name = (signupNameInput.value || "").trim();
const email = (signupEmailInput.value || "").trim();
const password = signupPasswordInput.value || "";
const role = signupRoleInput.value || "client";

if (!name || !email || !password) {
  showError("Name, email and password are required.");
  return;
}

try {
  const data = await doSignup({
    full_name: name,   // 👈 map from form “name” to full_name
    email,
    password,
    role,
  });
  handleAuthSuccess(data);
} catch (err) {
  console.error("Signup error:", err);
  showError(err.message || "Signup failed.");
}

    // ✅ Frontend validation matches backend message
    if (!name || !email || !password) {
      showError("Name, email and password are required.");
      return;
    }

    try {
      // ✅ Send full_name so the backend is happy
      const data = await doSignup({
        full_name: name,
        email,
        password,
        role,
      });

      handleAuthSuccess(data);
    } catch (err) {
      console.error("Signup error:", err);
      showError(err.message || "Signup failed.");
    }
  });
}

  // Logout button
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch (_) {}

      try {
        if (window.PetCareState && window.PetCareState.logout) {
          window.PetCareState.logout();
        } else if (window.PetCareState && window.PetCareState.setCurrentUser) {
          window.PetCareState.setCurrentUser(null);
        }
        if (typeof window.updateHeaderUser === "function") {
          window.updateHeaderUser();
        }
      } catch (err) {
        console.warn("Logout error:", err);
      }
    });
  }

  // NOTE: restoring the JWT session from TOKEN_KEY
  // is handled in app.js via window.restoreSession()
})();
