// js/pages/authPage.js
(function () {
  const API_BASE = window.PETCARE_API_BASE || "http://localhost:4000";

  function showError(msg) {
    const el = document.getElementById("authPageError");
    if (!el) return;
    el.style.display = msg ? "block" : "none";
    el.textContent = msg || "";
  }

  function switchTab(panelId) {
    const tabs = document.querySelectorAll("#authPage .auth-tab");
    const panels = document.querySelectorAll("#authPage .auth-panel");

    tabs.forEach((t) => {
      t.classList.toggle("active", t.getAttribute("data-auth-tab") === panelId);
    });

    panels.forEach((p) => {
      p.style.display = p.id === panelId ? "block" : "none";
    });

    showError("");
  }

  function bindTabs() {
    const tabs = document.querySelectorAll("#authPage .auth-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const panelId = tab.getAttribute("data-auth-tab");
        if (panelId) switchTab(panelId);
      });
    });
  }

  function mapApiUser(apiUser) {
    if (!apiUser) return null;

    return {
      id: apiUser.id,
      name: apiUser.full_name || apiUser.name || "",
      email: apiUser.email,
      role: apiUser.role,
      phone: apiUser.phone || "",
      is_active: apiUser.is_active
    };
  }

  async function postJson(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data.error || data.message || "Request failed";
      throw new Error(msg);
    }

    return data;
  }

  function bindLogin() {
    const form = document.getElementById("loginPageForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      showError("");

      const email = document.getElementById("loginPageEmail")?.value?.trim();
      const password = document.getElementById("loginPagePassword")?.value;

      if (!email || !password) {
        showError("Please enter your email and password.");
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const data = await postJson("/auth/login", { email, password });

        if (data.token) {
          localStorage.setItem("petcare_token", data.token);
        }

        const user = mapApiUser(data.user);

        if (user && window.PetCareState?.setCurrentUser) {
          window.PetCareState.setCurrentUser(user);
        }

        window.updateHeaderUser?.();
        window.setActivePage?.("profilePage");
      } catch (err) {
        showError(err.message || "Invalid email or password.");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  function bindSignup() {
    const form = document.getElementById("signupRealForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      showError("");

      const name = document.getElementById("realSignupName")?.value?.trim();
      const email = document.getElementById("realSignupEmail")?.value?.trim();
      const password = document.getElementById("realSignupPassword")?.value;
      const role = document.getElementById("realSignupRole")?.value || "client";

      if (!name || !email || !password) {
        showError("Please fill out name, email, and password.");
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const data = await postJson("/auth/register", {
          name,
          email,
          password,
          role
        });

        if (data.token) {
          localStorage.setItem("petcare_token", data.token);
        }

        const user = mapApiUser(data.user);

        if (user && window.PetCareState?.setCurrentUser) {
          window.PetCareState.setCurrentUser(user);
        }

        window.updateHeaderUser?.();
        window.setActivePage?.("profilePage");
      } catch (err) {
        showError(err.message || "That email is already registered.");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  function initAuthPage() {
    bindTabs();
    bindLogin();
    bindSignup();
    switchTab("loginPagePanel");
  }

  window.initAuthPage = initAuthPage;

  // expose mapping for reuse
  window.PetCareMapApiUser = mapApiUser;

  // ===============================
  // Open Auth page pre-set for role
  // ===============================
  window.openSignupForRole = function (role) {
    // 1. Go to the Auth page
    if (typeof window.setActivePage === "function") {
      window.setActivePage("authPage");
    }

    // 2. Switch tabs to "Sign up"
    switchTab("signupPagePanel");

    // 3. Pre-select the account type in the dropdown
    const roleSelect = document.getElementById("realSignupRole");
    if (roleSelect && (role === "sitter" || role === "client")) {
      roleSelect.value = role;
    }

    // 4. Optional: focus name input
    const nameInput = document.getElementById("realSignupName");
    if (nameInput) nameInput.focus();
  };
})();
