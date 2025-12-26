 // js/pages/settings.js
// Settings page: left sidebar list, right-side detail panel.
// Layout is similar to desktop app settings (like the screenshot).

(function () {
  // ----- Config: sidebar items + views -----

  const SETTINGS_ITEMS = [
    {
      key: "password_security",
      label: "Password & Security",
      section: "Settings",
    },
    {
      key: "notifications",
      label: "Notifications",
      section: "Settings",
    },
    {
      key: "system_updates",
      label: "System updates",
      section: "Settings",
    },
    {
      key: "network_devices",
      label: "Network & devices",
      section: "Settings",
    },
  ];

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
      `,
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
      `,
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
      `,
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
              For security, you can sign out everywhere else with one click (demo).
            </div>
          </div>
          <button type="button" class="btn-small-outline">
            Sign out other sessions
          </button>
        </div>
      `,
    },
  };

  // ----- Rendering helpers -----

  function renderSidebar(activeKey) {
    const listEl = document.getElementById("settingsSidebarList");
    if (!listEl) return;

    listEl.innerHTML = "";

    SETTINGS_ITEMS.forEach((item) => {
      const li = document.createElement("li");
      li.className = "settings-sidebar-item";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "settings-sidebar-link";
      if (item.key === activeKey) {
        btn.classList.add("active");
      }
      btn.textContent = item.label;
      btn.setAttribute("data-settings-view", item.key);

      li.appendChild(btn);
      listEl.appendChild(li);
    });
  }

  function renderView(key) {
    const view = SETTINGS_VIEWS[key] || null;
    const titleEl = document.getElementById("settingsDetailTitle");
    const bodyEl = document.getElementById("settingsDetailBody");

    if (!titleEl || !bodyEl) return;

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

  // ----- Page init -----

  window.initSettingsPage = function () {
    const defaultKey = "password_security";

    renderSidebar(defaultKey);
    renderView(defaultKey);

    const listEl = document.getElementById("settingsSidebarList");
    if (!listEl) return;

    listEl.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-settings-view]");
      if (!btn) return;

      const key = btn.getAttribute("data-settings-view");
      if (!key) return;

      renderSidebar(key);
      renderView(key);
    });
  };
})();