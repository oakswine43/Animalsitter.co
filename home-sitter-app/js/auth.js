// js/auth.js
// Login / signup overlay that talks to the real backend API (/auth/*)

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

  // Use the shared mapper from app.js to normalize user
  function mapUser(apiUser) {
    if (window.PetCareMapApiUser) {
      return window.PetCareMapApiUser(apiUser);
    }
    return apiUser;
  }

  function applyUserToUI(user) {
    if (window.PetCareState && typeof window.PetCareState.setCurrentUser === "function") {
      window.PetCareState.setCurrentUser(user);
    }
    if (window.updateHeaderUser) {
      window.updateHeaderUser();
    }
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    showError("");

    const email = (loginEmailInput.value || "").trim();
    const password = loginPasswordInput.value || "";

    if (!email || !password) {
      showError("Please enter email and password.");
      return;
    }

    try {
      const res = await fetch(`${window.API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.token || !data.user) {
        const msg = data.error || "Invalid email or password.";
        showError(msg);
        return;
      }

      // Save JWT token
      localStorage.setItem(TOKEN_KEY, data.token);

      const user = mapUser(data.user);
      applyUserToUI(user);

      if (overlay) overlay.style.display = "none";
    } catch (err) {
      console.error("LOGIN_ERROR", err);
      showError("Could not reach server. Please try again.");
    }
  }

  async function handleSignupSubmit(e) {
    e.preventDefault();
    showError("");

    const name = (signupNameInput.value || "").trim();
    const email = (signupEmailInput.value || "").trim();
    const password = signupPasswordInput.value || "";
    const role = signupRoleInput.value || "client";

    if (!email || !password) {
      showError("Please enter email and password.");
      return;
    }

    try {
      const res = await fetch(`${window.API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.token || !data.user) {
        const msg = data.error || "Could not create account.";
        showError(msg);
        return;
      }

      // Save JWT token
      localStorage.setItem(TOKEN_KEY, data.token);

      const user = mapUser(data.user);
      applyUserToUI(user);

      if (overlay) overlay.style.display = "none";
    } catch (err) {
      console.error("SIGNUP_ERROR", err);
      showError("Could not reach server. Please try again.");
    }
  }

  function handleLogoutClick() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (_) {}
    if (window.PetCareState && window.PetCareState.logout) {
      window.PetCareState.logout();
    }
    if (window.updateHeaderUser) {
      window.updateHeaderUser();
    }
  }

  // ----- PUBLIC API (for "Log in / Sign up" button) -----
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

  
  if (closeBtn) {
    closeBtn.addEventListener("click", () => PetCareAuth.hide());
  }


  authTabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-auth-tab");
      setActiveTab(tab);
      showError("");
    });
  });


  if (loginForm) {
    loginForm.addEventListener("submit", handleLoginSubmit);
  }

  if (signupForm) {
    signupForm.addEventListener("submit", handleSignupSubmit);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogoutClick);
  }
})();
