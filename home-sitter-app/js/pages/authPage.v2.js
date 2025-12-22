// js/pages/authPage.v2.js
// Full-page login / signup using REAL backend

(function () {
  console.log("[AuthPage] v2 loaded");

  // Tabs
  const loginTabBtn = document.querySelector('.auth-tab[data-auth-tab="loginPagePanel"]');
  const signupTabBtn = document.querySelector('.auth-tab[data-auth-tab="signupPagePanel"]');

  const loginPanel = document.getElementById("loginPagePanel");
  const signupPanel = document.getElementById("signupPagePanel");

  // Forms
  const loginForm = document.getElementById("loginPageForm");
  const signupForm = document.getElementById("signupRealForm");

  // Inputs
  const loginEmailInput = document.getElementById("loginPageEmail");
  const loginPasswordInput = document.getElementById("loginPagePassword");

  const signupNameInput = document.getElementById("realSignupName");
  const signupEmailInput = document.getElementById("realSignupEmail");
  const signupPasswordInput = document.getElementById("realSignupPassword");
  const signupRoleInput = document.getElementById("realSignupRole");

  const authError = document.getElementById("authPageError");
  const TOKEN_KEY = "petcare_token";

  // ---------- helpers ----------

  function showError(msg) {
    if (!authError) return;
    authError.textContent = msg || "";
    authError.style.display = msg ? "block" : "none";
  }

  function setTab(tab) {
    const loginActive = tab === "login";
    if (loginTabBtn) loginTabBtn.classList.toggle("active", loginActive);
    if (signupTabBtn) signupTabBtn.classList.toggle("active", !loginActive);

    if (loginPanel) loginPanel.style.display = loginActive ? "block" : "none";
    if (signupPanel) signupPanel.style.display = loginActive ? "none" : "block";

    showError("");
  }

  function mapUser(apiUser) {
    if (!apiUser) return null;
    return {
      id: apiUser.id,
      name: apiUser.full_name || apiUser.name || "",
      email: apiUser.email,
      role: apiUser.role || "client",
      is_active: apiUser.is_active
    };
  }

  function handleAuthSuccess(data) {
    showError("");

    const apiUser = data && data.user;
    const token = data && (data.token || data.jwt);

    if (!apiUser || !token) {
      showError("Bad response from server.");
      return;
    }

    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (_) {}

    const user = mapUser(apiUser);

    try {
      if (window.PetCareState && typeof window.PetCareState.setCurrentUser === "function") {
        window.PetCareState.setCurrentUser(user);
      }
      if (typeof window.updateHeaderUser === "function") {
        window.updateHeaderUser();
      }
    } catch (err) {
      console.warn("Failed to update current user:", err);
    }

    if (typeof window.setActivePage === "function") {
      window.setActivePage("dashboardPage");
    }
  }

  async function apiPost(path, body) {
    if (!window.API_BASE) {
      throw new Error("API base URL is not configured.");
    }
    const res = await fetch(`${window.API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body || {})
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Request failed.");
    }
    return data;
  }

  function val(el) {
    return (el && el.value ? el.value : "").trim();
  }

  // ---------- login ----------

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      showError("");

      const email = val(loginEmailInput);
      const password = loginPasswordInput ? loginPasswordInput.value : "";

      if (!email || !password) {
        showError("Email and password are required.");
        return;
      }

      console.log("[AuthPage] login values:", { email, passwordLength: password.length });

      try {
        const data = await apiPost("/auth/login", { email, password });
        handleAuthSuccess(data);
      } catch (err) {
        console.error("Login error:", err);
        showError(err.message || "Login failed.");
      }
    });
  }

  // ---------- signup ----------

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      showError("");

      const full_name = val(signupNameInput);
      const email = val(signupEmailInput);
      const password = signupPasswordInput ? signupPasswordInput.value : "";
      const role = signupRoleInput ? signupRoleInput.value || "client" : "client";

      console.log("[AuthPage] signup values:", {
        full_name,
        email,
        passwordLength: password.length,
        role
      });

      if (!full_name || !email || !password) {
        showError("Name, email and password are required.");
        return;
      }

      try {
        const data = await apiPost("/auth/register", {
          full_name,
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

  // ---------- tab buttons ----------

  if (loginTabBtn) {
    loginTabBtn.addEventListener("click", () => setTab("login"));
  }
  if (signupTabBtn) {
    signupTabBtn.addEventListener("click", () => setTab("signup"));
  }

  // Helpers for "Become a sitter" buttons
  window.openSignupForRole = function (role) {
    if (typeof window.setActivePage === "function") {
      window.setActivePage("authPage");
    }
    setTab("signup");
    if (signupRoleInput && role) signupRoleInput.value = role;
  };

  window.initAuthPage = function () {
    setTab("login");
  };

  document.addEventListener("DOMContentLoaded", () => {
    setTab("login");
  });
})();