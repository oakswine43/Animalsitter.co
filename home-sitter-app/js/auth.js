// js/pages/authPage.js
// Login / signup page using REAL backend API (/auth/*)

(function () {
  const TOKEN_KEY = "petcare_token";

  // Tabs & panels
  const authTabs = Array.from(document.querySelectorAll(".auth-tab"));
  const loginPanel = document.getElementById("loginPagePanel");
  const signupPanel = document.getElementById("signupPagePanel");

  // Forms
  const loginForm = document.getElementById("loginPageForm");
  const signupForm = document.getElementById("signupRealForm");

  // Login inputs
  const loginEmailInput = document.getElementById("loginPageEmail");
  const loginPasswordInput = document.getElementById("loginPagePassword");

  // Signup inputs
  const signupNameInput = document.getElementById("realSignupName");
  const signupEmailInput = document.getElementById("realSignupEmail");
  const signupPasswordInput = document.getElementById("realSignupPassword");
  const signupRoleInput = document.getElementById("realSignupRole");

  // Error box under the forms
  const authError = document.getElementById("authPageError");

  // -----------------------------
  // Helpers
  // -----------------------------

  function showError(msg) {
    if (!authError) return;
    authError.textContent = msg || "";
    authError.style.display = msg ? "block" : "none";
  }

  function clearError() {
    showError("");
  }

  function setAuthTab(which) {
    const isLogin = which === "login";

    authTabs.forEach((btn) => {
      const target = btn.getAttribute("data-auth-tab");
      const thisIsLogin = target === "loginPagePanel";
      btn.classList.toggle("active", isLogin ? thisIsLogin : !thisIsLogin);
    });

    if (loginPanel) loginPanel.style.display = isLogin ? "block" : "none";
    if (signupPanel) signupPanel.style.display = isLogin ? "none" : "block";
  }

  function handleAuthSuccess(data) {
    clearError();

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

    // Map API user -> frontend
    const mapped =
      typeof window.PetCareMapApiUser === "function"
        ? window.PetCareMapApiUser(apiUser)
        : apiUser;

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

    // Jump to dashboard after auth
    if (typeof window.setActivePage === "function") {
      window.setActivePage("dashboardPage");
    }
  }

  async function doLogin(email, password) {
    if (!window.API_BASE) {
      throw new Error("API base URL is not configured.");
    }

    const res = await fetch(`${window.API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name, email, password, role })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Could not create account.");
    }
    return data;
  }

  // -----------------------------
  // Tab click handling
  // -----------------------------
  authTabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-auth-tab");
      const which = target === "signupPagePanel" ? "signup" : "login";
      setAuthTab(which);
      clearError();
    });
  });

  // Default to login tab on first load
  setAuthTab("login");

  // -----------------------------
  // Login form submit
  // -----------------------------
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearError();

      const email = ((loginEmailInput && loginEmailInput.value) || "").trim();
      const password = (loginPasswordInput && loginPasswordInput.value) || "";

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

  // -----------------------------
  // Signup form submit
  // -----------------------------
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearError();

      const name = ((signupNameInput && signupNameInput.value) || "").trim();
      const email = ((signupEmailInput && signupEmailInput.value) || "").trim();
      const password =
        (signupPasswordInput && signupPasswordInput.value) || "";
      const role = (signupRoleInput && signupRoleInput.value) || "client";

      if (!name || !email || !password) {
        showError("Name, email and password are required.");
        return;
      }

      try {
        const data = await doSignup({
          full_name: name, // backend expects full_name
          email,
          password,
          role
        });
        handleAuthSuccess(data);
      } catch (err) {
        console.error("Signup error:", err);
        showError(err.message || "Signup failed.");
      }
    });
  }

  // -----------------------------
  // Helper for "Become a sitter / Book pet care" buttons
  // -----------------------------
  window.openSignupForRole = function (roleKey) {
    if (typeof window.setActivePage === "function") {
      window.setActivePage("authPage");
    }
    setAuthTab("signup");
    clearError();

    try {
      if (signupRoleInput && roleKey) {
        signupRoleInput.value = roleKey;
      }
      if (signupNameInput) signupNameInput.focus();
    } catch (_) {}
  };
})();
