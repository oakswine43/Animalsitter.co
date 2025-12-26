// js/pages/settings.js
// Settings page: left sidebar with grouped items, right detail panel.

(function () {
  // Sidebar structure
  const SETTINGS_SECTIONS = [
    {
      key: "settings",
      label: "Settings",
      items: [
        { key: "notifications", label: "Notifications" },
        { key: "system_updates", label: "System updates", badge: "4" },
        { key: "network_devices", label: "Network" },
        { key: "password_security", label: "Password & Security" },
        { key: "verification", label: "Verification check" }
      ]
    },
    {
      key: "addresses",
      label: "Addresses",
      items: [] // future items
    },
    {
      key: "personal_info",
      label: "Personal info",
      items: [] // future items
    }
  ];

  // Right-side views
  const SETTINGS_VIEWS = {
    password_security: {
      title: "Password & Security",
      body: `
        <p class="text-muted" style="margin-bottom:12px;">
          Manage how you sign in and keep your AnimalSitter account secure.
        </p>

        <div class="settings-toggle-card">
          <div class="settings-toggle-main">
            <div class="settings-toggle-title">Login alerts</div>
            <div class="settings-toggle-subtitle">
              Get an email whenever someone signs in from a new device.
            </div>
          </div>
          <label class="toggle">
            <input type="checkbox" checked />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="settings-toggle-card">
          <div class="settings-toggle-main">
            <div class="settings-toggle-title">Two-factor authentication</div>
            <div class="settings-toggle-subtitle">
              Add an extra step at login using a code from your phone (demo only).
            </div>
          </div>
          <label class="toggle">
            <input type="checkbox" />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="settings-toggle-card">
          <div class="settings-toggle-main">
            <div class="settings-toggle-title">Remember this device</div>
            <div class="settings-toggle-subtitle">
              Reduce how often we ask for your password on trusted devices.
            </div>
          </div>
          <label class="toggle">
            <input type="checkbox" checked />
            <span class="toggle-slider"></span>
          </label>
        </div>
      `
    },

    notifications: {
      title: "Notifications",
      body: `
        <p class="text-muted" style="margin-bottom:12px;">
          Choose how you’d like to hear about bookings, messages, and updates.
        </p>

        <div class="settings-toggle-card">
          <div class="settings-toggle-main">
            <div class="settings-toggle-title">Booking updates</div>
            <div class="settings-toggle-subtitle">
              Requests, confirmations, and changes to upcoming stays.
            </div>
          </div>
          <label class="toggle">
            <input type="checkbox" checked />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="settings-toggle-card">
          <div class="settings-toggle-main">
            <div class="settings-toggle-title">Messages</div>
            <div class="settings-toggle-subtitle">
              New messages from sitters and pet parents.
            </div>
          </div>
          <label class="toggle">
            <input type="checkbox" checked />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="settings-toggle-card">
          <div class="settings-toggle-main">
            <div class="settings-toggle-title">Product tips & news</div>
            <div class="settings-toggle-subtitle">
              Occasional tips, feature announcements, and promotions.
            </div>
          </div>
          <label class="toggle">
            <input type="checkbox" />
            <span class="toggle-slider"></span>
          </label>
        </div>
      `
    },

    system_updates: {
      title: "System updates",
      body: `
        <p class="text-muted" style="margin-bottom:12px;">
          Control when we notify you about app and policy changes.
        </p>

        <div class="settings-toggle-card">
          <div class="settings-toggle-main">
            <div class="settings-toggle-title">Important updates</div>
            <div class="settings-toggle-subtitle">
              Changes that may affect your bookings, payments, or security.
            </div>
          </div>
          <label class="toggle">
            <input type="checkbox" checked />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="settings-toggle-card">
          <div class="settings-toggle-main">
            <div class="settings-toggle-title">Feature previews</div>
            <div class="settings-toggle-subtitle">
              Hear about new tools for sitters and pet parents before they launch.
            </div>
          </div>
          <label class="toggle">
            <input type="checkbox" />
            <span class="toggle-slider"></span>
          </label>
        </div>
      `
    },

    network_devices: {
      title: "Network & devices",
      body: `
        <p class="text-muted" style="margin-bottom:12px;">
          See where you’re signed in and manage trusted devices (demo only).
        </p>

        <div class="settings-toggle-card">
          <div class="settings-toggle-main">
            <div class="settings-toggle-title">This device</div>
            <div class="settings-toggle-subtitle">
              MacBook · Knoxville, TN · Active session
            </div>
          </div>
          <label class="toggle">
            <input type="checkbox" checked />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="settings-toggle-card">
          <div class="settings-toggle-main">
            <div class="settings-toggle-title">Sign out of other devices</div>
            <div class="settings-toggle-subtitle">
              For security, sign out everywhere else with one click (demo).
            </div>
          </div>
          <button type="button" class="btn-small-outline">
            Sign out other sessions
          </button>
        </div>
      `
    },

    verification: {
      title: "Verification check",
      body: `
        <p class="text-muted">
          In a real app, this is where you’d see ID verification and background check status.
        </p>
      `
    }
  };

  // ---------- Rendering helpers ----------

  function renderSidebar(activeKey) {
    const container = document.getElementById("settingsSidebarList");
    if (!container) return;

    container.innerHTML = "";

    SETTINGS_SECTIONS.forEach((section) => {
      const group = document.createElement("div");
      group.className = "settings-sidebar-group";

      const heading = document.createElement("div");
      heading.className = "settings-sidebar-group-title";
      heading.textContent = section.label;
      group.appendChild(heading);

      if (section.items && section.items.length) {
        section.items.forEach((item) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "settings-sidebar-link";
          btn.setAttribute("data-settings-view", item.key);
          btn.textContent = item.label;

          if (item.badge) {
            const badge = document.createElement("span");
            badge.className = "settings-sidebar-link-badge";
            badge.textContent = item.badge;
            btn.appendChild(badge);
          }

          if (item.key === activeKey) {
            btn.classList.add("active");
          }

          group.appendChild(btn);
        });
      }

      container.appendChild(group);
    });
  }

  function renderView(key) {
    const titleEl = document.getElementById("settingsDetailTitle");
    const bodyEl = document.getElementById("settingsDetailBody");
    if (!titleEl || !bodyEl) return;

    const view = SETTINGS_VIEWS[key];
    if (!view) {
      titleEl.textContent = "Settings";
      bodyEl.innerHTML = `
        <p class="text-muted">
          Select an item on the left to view and update its settings.
        </p>
      `;
      return;
    }

    titleEl.textContent = view.title;
    bodyEl.innerHTML = view.body;
  }

  // ---------- Page init ----------

  window.initSettingsPage = function () {
    const defaultKey = "password_security";

    renderSidebar(defaultKey);
    renderView(defaultKey);

    const container = document.getElementById("settingsSidebarList");
    if (!container) return;

    container.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-settings-view]");
      if (!btn) return;

      const key = btn.getAttribute("data-settings-view");
      if (!key) return;

      renderSidebar(key);
      renderView(key);
    });
  };
})();