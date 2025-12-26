// js/pages/settings.js
// Settings page: left nav = Settings items, right = stacked content for that item

(function () {
  function getState() {
    return window.PetCareState || null;
  }

  // ----------------- VIEWS ON THE RIGHT -----------------
  const SETTINGS_VIEWS = {
    account_overview: {
      title: "Account",
      description:
        "Manage your basic profile info that sitters and clients will see.",
      body: `
        <div class="settings-section-block">
          <h3>Profile</h3>
          <p class="text-muted small">
            Your name and profile photo help people recognize you in bookings and messages.
          </p>
          <form class="form-grid" autocomplete="off">
            <div class="field-group">
              <label>
                <span>First name</span>
                <input type="text" class="input" placeholder="First name" />
              </label>
            </div>
            <div class="field-group">
              <label>
                <span>Last name</span>
                <input type="text" class="input" placeholder="Last name" />
              </label>
            </div>
            <div class="field-group form-grid-full" style="margin-top:8px;">
              <button type="button" class="btn-primary btn-sm">
                Save name (demo)
              </button>
            </div>
          </form>
        </div>

        <div class="settings-section-divider"></div>

        <div class="settings-section-block">
          <h3>Contact</h3>
          <p class="text-muted small">
            We’ll use this info for booking confirmations and important alerts.
          </p>
          <form class="form-grid" autocomplete="off">
            <div class="field-group form-grid-full">
              <label>
                <span>Email</span>
                <input type="email" class="input" placeholder="you@example.com" />
              </label>
            </div>
            <div class="field-group form-grid-full">
              <label>
                <span>Phone</span>
                <input type="tel" class="input" placeholder="(555) 555-5555" />
              </label>
            </div>
            <div class="form-grid-full" style="margin-top:8px;">
              <button type="button" class="btn-primary btn-sm">
                Save contact info (demo)
              </button>
            </div>
          </form>
        </div>
      `,
    },

    password_security: {
      title: "Password & security",
      description:
        "Keep your AnimalSitter account secure with a strong password and extra protection.",
      body: `
        <div class="settings-section-block">
          <h3>Password</h3>
          <p class="text-muted small">
            Use a unique password you don’t reuse on other websites.
          </p>
          <form class="form-grid" autocomplete="off">
            <div class="field-group form-grid-full">
              <label>
                <span>Current password</span>
                <input type="password" class="input" placeholder="Current password" />
              </label>
            </div>
            <div class="field-group form-grid-full">
              <label>
                <span>New password</span>
                <input type="password" class="input" placeholder="New password" />
              </label>
            </div>
            <div class="field-group form-grid-full">
              <label>
                <span>Confirm new password</span>
                <input type="password" class="input" placeholder="Repeat new password" />
              </label>
            </div>
            <div class="form-grid-full" style="margin-top:8px;">
              <button type="button" class="btn-primary btn-sm">
                Update password (demo)
              </button>
            </div>
          </form>
        </div>

        <div class="settings-section-divider"></div>

        <div class="settings-section-block">
          <h3>Two-factor authentication</h3>
          <p class="text-muted small">
            Add an extra step at sign-in by confirming a code from your phone.
          </p>

          <form class="form-grid" autocomplete="off">
            <div class="field-group form-grid-full">
              <label style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" />
                <span>Require a code when logging in (demo toggle)</span>
              </label>
            </div>
            <div class="field-group form-grid-full">
              <label>
                <span>Phone number</span>
                <input type="tel" class="input" placeholder="(555) 555-5555" />
              </label>
            </div>
            <div class="form-grid-full" style="margin-top:8px;">
              <button type="button" class="btn-primary btn-sm">
                Save security settings (demo)
              </button>
            </div>
          </form>
        </div>

        <!-- Later we can add more blocks under Password & security here -->
      `,
    },

    notifications: {
      title: "Notifications",
      description:
        "Choose how AnimalSitter contacts you about bookings, messages, and updates.",
      body: `
        <div class="settings-section-block">
          <h3>Push notifications</h3>
          <form class="form-grid" autocomplete="off">
            <div class="field-group form-grid-full">
              <label style="display:flex; gap:8px; align-items:center;">
                <input type="checkbox" checked />
                <span>Allow push notifications on this device</span>
              </label>
            </div>
            <p class="text-muted small">
              In a real app this would ask the browser or phone for permission.
            </p>
          </form>
        </div>

        <div class="settings-section-divider"></div>

        <div class="settings-section-block">
          <h3>Email notifications</h3>
          <form class="form-grid" autocomplete="off">
            <div class="field-group form-grid-full">
              <label style="display:flex; gap:8px; align-items:center;">
                <input type="checkbox" checked />
                <span>Bookings &amp; schedule changes</span>
              </label>
            </div>
            <div class="field-group form-grid-full">
              <label style="display:flex; gap:8px; align-items:center;">
                <input type="checkbox" checked />
                <span>Messages from sitters or clients</span>
              </label>
            </div>
            <div class="field-group form-grid-full">
              <label style="display:flex; gap:8px; align-items:center;">
                <input type="checkbox" />
                <span>Product news &amp; occasional tips</span>
              </label>
            </div>
          </form>
        </div>

        <div class="settings-section-divider"></div>

        <div class="settings-section-block">
          <h3>SMS updates</h3>
          <form class="form-grid" autocomplete="off">
            <div class="field-group form-grid-full">
              <label style="display:flex; gap:8px; align-items:center;">
                <input type="checkbox" />
                <span>Text me about time-sensitive booking changes (demo)</span>
              </label>
            </div>
            <p class="text-muted small">
              Carrier rates may apply in a real app.
            </p>
          </form>
        </div>
      `,
    },
  };

  // Left-nav list: one “Settings” group, like the screenshot
  const SETTINGS_GROUPS = [
    {
      heading: "Settings",
      items: [
        { key: "account_overview", label: "Account" },
        { key: "password_security", label: "Password & security" },
        { key: "notifications", label: "Notifications" },
      ],
    },
  ];

  // -------------- rendering helpers --------------

  function renderMainView(viewKey) {
    const titleEl = document.getElementById("settingsContentTitle");
    const bodyEl = document.getElementById("settingsContentBody");
    if (!titleEl || !bodyEl) return;

    const view = viewKey ? SETTINGS_VIEWS[viewKey] : null;

    if (!view) {
      titleEl.textContent = "Account settings";
      bodyEl.innerHTML = `
        <p class="text-muted">
          Choose a setting on the left to manage your profile,
          security, or notifications.
        </p>
      `;
    } else {
      titleEl.textContent = view.title;
      bodyEl.innerHTML = `
        <p class="text-muted" style="margin-bottom:8px;">
          ${view.description || ""}
        </p>
        ${view.body || ""}
      `;
    }

    // highlight active button
    const nav = document.getElementById("settingsNavCard");
    if (!nav) return;
    const buttons = nav.querySelectorAll("[data-settings-key]");
    buttons.forEach((btn) => {
      const key = btn.getAttribute("data-settings-key");
      btn.classList.toggle("settings-nav-item-active", key === viewKey);
    });
  }

  function buildLeftNav() {
    const navCard = document.getElementById("settingsNavCard");
    const navList = document.getElementById("settingsNavList");
    if (!navCard || !navList) return;

    const state = getState();
    const user =
      state && typeof state.getCurrentUser === "function"
        ? state.getCurrentUser()
        : null;

    const displayName =
      (user && (user.name || user.full_name || user.email)) || "Your account";

    // header with initial + name
    navCard.querySelector(".settings-nav-header").innerHTML = `
      <div class="settings-nav-initial-circle">
        ${displayName.charAt(0).toUpperCase()}
      </div>
      <div class="settings-nav-user">
        <div class="settings-nav-name">${displayName}</div>
        <div class="settings-nav-role small text-muted">${
          user?.role ? user.role.toUpperCase() : "GUEST"
        }</div>
      </div>
    `;

    navList.innerHTML = SETTINGS_GROUPS.map(
      (group) => `
      <li class="settings-nav-section">
        <div class="settings-nav-heading">${group.heading}</div>
        <ul class="settings-nav-items">
          ${group.items
            .map(
              (item) => `
            <li>
              <button
                type="button"
                class="settings-nav-item"
                data-settings-key="${item.key}"
              >
                ${item.label}
              </button>
            </li>
          `
            )
            .join("")}
        </ul>
      </li>
    `
    ).join("");
  }

  // -------------- page init --------------

  window.initSettingsPage = function () {
    buildLeftNav();
    // default to Account, like clicking "Settings" in the screenshot
    renderMainView("account_overview");

    const navCard = document.getElementById("settingsNavCard");
    if (!navCard) return;

    navCard.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-settings-key]");
      if (!btn) return;
      const key = btn.getAttribute("data-settings-key");
      renderMainView(key);
    });
  };
})();
