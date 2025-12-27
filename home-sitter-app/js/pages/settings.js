// home-sitter-app/js/pages/settings.js
// Settings page: left sidebar menu + detail panel on the right

(function () {
  function getState() {
    return window.PetCareState || null;
  }

  // --------- DETAIL VIEWS (RIGHT PANEL) ---------
  const SETTINGS_VIEWS = {
    password_security: {
      title: "Password & Security",
      subtitle: "Control how you sign in and keep your AnimalSitter account safe.",
      body: `
        <div class="settings-detail-list">
          <div class="settings-detail-row">
            <div>
              <div class="settings-row-title">Account password</div>
              <div class="settings-row-subtitle">
                Change your password to keep your account secure.
              </div>
            </div>
            <button type="button" class="btn-small-outline">Change</button>
          </div>

          <div class="settings-detail-row">
            <div>
              <div class="settings-row-title">Two-factor authentication</div>
              <div class="settings-row-subtitle">
                Add a one-time code from your phone each time you sign in.
              </div>
            </div>
            <button type="button" class="toggle-switch toggle-on" data-demo-toggle>
              <span class="toggle-thumb"></span>
            </button>
          </div>

          <div class="settings-detail-row">
            <div>
              <div class="settings-row-title">Login alerts</div>
              <div class="settings-row-subtitle">
                Get an email when we notice a new device or location.
              </div>
            </div>
            <button type="button" class="toggle-switch toggle-on" data-demo-toggle>
              <span class="toggle-thumb"></span>
            </button>
          </div>
        </div>
      `,
    },

    notifications: {
      title: "Notifications",
      subtitle: "Choose how you hear about bookings, messages, and updates.",
      body: `
        <div class="settings-detail-list">
          <div class="settings-detail-row">
            <div>
              <div class="settings-row-title">Booking updates</div>
              <div class="settings-row-subtitle">
                New requests, changes, and cancellations.
              </div>
            </div>
            <button type="button" class="toggle-switch toggle-on" data-demo-toggle>
              <span class="toggle-thumb"></span>
            </button>
          </div>

          <div class="settings-detail-row">
            <div>
              <div class="settings-row-title">Messages</div>
              <div class="settings-row-subtitle">
                New messages from sitters and pet parents.
              </div>
            </div>
            <button type="button" class="toggle-switch toggle-on" data-demo-toggle>
              <span class="toggle-thumb"></span>
            </button>
          </div>

          <div class="settings-detail-row">
            <div>
              <div class="settings-row-title">Product news</div>
              <div class="settings-row-subtitle">
                Tips, feature updates, and occasional promos.
              </div>
            </div>
            <button type="button" class="toggle-switch" data-demo-toggle>
              <span class="toggle-thumb"></span>
            </button>
          </div>
        </div>
      `,
    },

    system_updates: {
      title: "System updates",
      subtitle: "Stay informed about important changes to the AnimalSitter app.",
      body: `
        <div class="settings-detail-list">
          <div class="settings-detail-row">
            <div>
              <div class="settings-row-title">Critical updates</div>
              <div class="settings-row-subtitle">
                Required updates and security notices. Always on.
              </div>
            </div>
            <button type="button" class="toggle-switch toggle-on" disabled>
              <span class="toggle-thumb"></span>
            </button>
          </div>

          <div class="settings-detail-row">
            <div>
              <div class="settings-row-title">New features</div>
              <div class="settings-row-subtitle">
                Learn when we launch something new for sitters and pet parents.
              </div>
            </div>
            <button type="button" class="toggle-switch" data-demo-toggle>
              <span class="toggle-thumb"></span>
            </button>
          </div>
        </div>
      `,
    },

    network: {
      title: "Network",
      subtitle: "Basic connection settings for the AnimalSitter web app (demo only).",
      body: `
        <div class="settings-detail-list">
          <div class="settings-detail-row">
            <div>
              <div class="settings-row-title">Use secure connection (HTTPS)</div>
              <div class="settings-row-subtitle">
                Required to protect your data in transit.
              </div>
            </div>
            <button type="button" class="toggle-switch toggle-on" disabled>
              <span class="toggle-thumb"></span>
            </button>
          </div>

          <div class="settings-detail-row">
            <div>
              <div class="settings-row-title">Background data</div>
              <div class="settings-row-subtitle">
                Allow AnimalSitter to refresh data in the background.
              </div>
            </div>
            <button type="button" class="toggle-switch" data-demo-toggle>
              <span class="toggle-thumb"></span>
            </button>
          </div>
        </div>
      `,
    },
  };

  // --------- RENDER HELPERS ---------

  function renderMainView(viewKey) {
    const titleEl = document.getElementById("settingsMainTitle");
    const subtitleEl = document.getElementById("settingsMainSubtitle");
    const bodyEl = document.getElementById("settingsMainBody");

    if (!titleEl || !subtitleEl || !bodyEl) return;

    const view = SETTINGS_VIEWS[viewKey];

    if (!view) {
      titleEl.textContent = "Password & Security";
      subtitleEl.textContent = "Select an item on the left to view and update its settings.";
      bodyEl.innerHTML = "";
      return;
    }

    titleEl.textContent = view.title;
    subtitleEl.textContent = view.subtitle || "";
    bodyEl.innerHTML = view.body || "";
  }

  function buildSidebar(activeViewKey) {
    const sidebar = document.getElementById("settingsSidebar");
    if (!sidebar) return;

    // Simple single group for now (like screenshot)
    const items = [
      { key: "password_security", label: "Password & Security" },
      { key: "notifications", label: "Notifications" },
      { key: "system_updates", label: "System updates" },
      { key: "network", label: "Network" },
    ];

    sidebar.innerHTML = `
      <div class="settings-sidebar-header">
        <span class="settings-sidebar-title">Settings</span>
      </div>
      <ul class="settings-nav-list">
        ${items
          .map(
            (item) => `
          <li
            class="settings-nav-item ${
              item.key === activeViewKey ? "is-active" : ""
            }"
            data-settings-view="${item.key}"
          >
            <span class="settings-nav-label">${item.label}</span>
          </li>
        `
          )
          .join("")}
      </ul>
    `;

    sidebar.addEventListener("click", function (e) {
      const item = e.target.closest("[data-settings-view]");
      if (!item) return;

      const viewKey = item.getAttribute("data-settings-view");
      const navItems = sidebar.querySelectorAll(".settings-nav-item");
      navItems.forEach((el) => el.classList.remove("is-active"));
      item.classList.add("is-active");

      renderMainView(viewKey);
    });
  }

  function updateSettingsUserLabel() {
    const el = document.getElementById("settingsUserLabel");
    if (!el) return;

    const state = getState();
    const user =
      state && typeof state.getCurrentUser === "function"
        ? state.getCurrentUser()
        : null;

    const name =
      (user && (user.name || user.full_name || user.email)) || "Guest";
    el.textContent = `Customer: ${name}`;
  }

  function wireToggleDemoHandlers() {
    const mainCard = document.getElementById("settingsMainCard");
    if (!mainCard) return;

    mainCard.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-demo-toggle]");
      if (!btn || btn.disabled) return;
      btn.classList.toggle("toggle-on");
    });
  }

  // --------- PAGE INIT ---------

  window.initSettingsPage = function () {
    const defaultView = "password_security";
    buildSidebar(defaultView);
    renderMainView(defaultView);
    updateSettingsUserLabel();
    wireToggleDemoHandlers();
  };
})();