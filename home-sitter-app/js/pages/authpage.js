// js/pages/authPage.js
// Full-page login / signup using REAL backend (/auth/login, /auth/register)

(function () {
  const loginTabBtn = document.querySelector(
    '.auth-tab[data-auth-tab="loginPagePanel"]'
  );
  const signupTabBtn = document.querySelector(
    '.auth-tab[data-auth-tab="signupPagePanel"]'
  );

  const loginPanel = document.getElementById("loginPagePanel");
  const signupPanel = document.getElementById("signupPagePanel");

  const loginForm = document.getElementById("loginPageForm");
  const signupForm = document.getElementById("signupRealForm");

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

  // Use the global mapper if available so we keep
  // first_name, last_name and avatar_url in sync with the rest of the app.
  function mapUser(apiUser) {
    if (!apiUser) return null;

    if (typeof window.PetCareMapApiUser === "function") {
      return window.PetCareMapApiUser(apiUser);
    }

    // Fallback mapper (if for some reason PetCareMapApiUser isn't loaded)
    const first = apiUser.first_name || "";
    const last = apiUser.last_name || "";
    const fullName =
      apiUser.full_name ||
      `${first} ${last}`.trim() ||
      apiUser.name ||
      "";

    return {
      id: apiUser.id,
      name: fullName,
      full_name: fullName,
      first_name: first || null,
      last_name: last || null,
      email: apiUser.email || "",
      role: apiUser.role || "client",
      phone: apiUser.phone || "",
      is_active: apiUser.is_active,
      avatar_url: apiUser.avatar_url || apiUser.photo_url || null,
      photo_url: apiUser.photo_url || apiUser.avatar_url || null
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

    // Save JWT
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (_) {}

    // Normalize user (keeps avatar_url, first_name, last_name, etc.)
    const user = mapUser(apiUser);

    try {
      if (
        window.PetCareState &&
        typeof window.PetCareState.setCurrentUser === "function"
      ) {
        window.PetCareState.setCurrentUser(user);
      }
      if (typeof window.updateHeaderUser === "function") {
        window.updateHeaderUser();
      }
    } catch (err) {
      console.warn("Failed to update current user:", err);
    }

    // Go to dashboard after login/signup
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

  // ---------- form handlers ----------

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
        const data = await apiPost("/auth/login", { email, password });
        handleAuthSuccess(data);
      } catch (err) {
        console.error("Login error:", err);
        showError(err.message || "Login failed.");
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      showError("");

      const full_name = (signupNameInput.value || "").trim();
      const email = (signupEmailInput.value || "").trim();
      const password = signupPasswordInput.value || "";
      const role = signupRoleInput.value || "client";

      if (!full_name || !email || !password) {
        showError("Name, email and password are required.");
        return;
      }

      // Split full name into first/last so it works with the new DB schema.
      const parts = full_name.split(/\s+/);
      const first_name = parts[0] || "";
      const last_name = parts.slice(1).join(" ");

      try {
        // Send BOTH full_name and first/last so backend can use whichever it expects
        const data = await apiPost("/auth/register", {
          full_name,
          first_name,
          last_name,
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

  // ---------- global helpers for "Become a sitter" buttons ----------

  window.openSignupForRole = function (role) {
    if (typeof window.setActivePage === "function") {
      window.setActivePage("authPage");
    }
    setTab("signup");
    if (signupRoleInput && role) {
      signupRoleInput.value = role;
    }
  };

  // Called from app.js when authPage is activated
  window.initAuthPage = function () {
    setTab("login"); // default tab
  };

  // Initialize once in case user lands directly on /#authPage
  document.addEventListener("DOMContentLoaded", () => {
    setTab("login");
  });
})();